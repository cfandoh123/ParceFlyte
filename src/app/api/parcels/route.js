import { getDb, toId } from '@/lib/db';
import { withAuth, restrictToParty } from '@/lib/auth';
import { ok, badRequest, pagination, paginated, requireFields, positiveNumber, parseDate } from '@/lib/api';
import { CITIES } from '@/lib/demo-data';

const CATEGORIES = ['electronics', 'clothing', 'documents', 'books', 'food', 'cosmetics', 'other'];
const HANDLING = ['fragile', 'temperature_controlled', 'urgent', 'signature_required', 'photo_proof'];

function withCoordinates(place) {
  if (!place?.city) return place;
  const known = CITIES[place.city];
  if (!known) return place;
  return {
    ...place,
    country: place.country || known.country,
    coordinates: place.coordinates || { latitude: known.lat, longitude: known.lon },
  };
}

export const GET = withAuth(async (req, { profile }) => {
  const db = await getDb();
  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = pagination(searchParams);
  const get = (key) => searchParams.get(key);

  const query = {};
  if (get('senderId')) query.senderId = toId(get('senderId'));
  if (get('matchedCarrierId')) query.matchedCarrierId = toId(get('matchedCarrierId'));
  if (get('status')) query.status = get('status');
  if (get('category')) query.category = get('category');
  if (get('minWeight') || get('maxWeight')) {
    query.weight = {};
    if (get('minWeight')) query.weight.$gte = parseFloat(get('minWeight'));
    if (get('maxWeight')) query.weight.$lte = parseFloat(get('maxWeight'));
  }
  if (get('minValue') || get('maxValue')) {
    query.declaredValue = {};
    if (get('minValue')) query.declaredValue.$gte = parseFloat(get('minValue'));
    if (get('maxValue')) query.declaredValue.$lte = parseFloat(get('maxValue'));
  }
  if (get('deliveryDeadline')) query.deliveryDeadline = { $lte: new Date(get('deliveryDeadline')) };

  // Parcels carry the recipient's name and address, so a list only ever
  // contains parcels the caller sent or is carrying.
  const scoped = restrictToParty(query, profile, ['senderId', 'matchedCarrierId']);

  const [parcels, total] = await Promise.all([
    db.collection('parcels').find(scoped).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    db.collection('parcels').countDocuments(scoped),
  ]);

  return ok(paginated(parcels, total, { page, limit }));
});

export const POST = withAuth(async (req, { profile }) => {
  const db = await getDb();
  const body = await req.json();

  const missing = requireFields(body, [
    'title',
    'origin.city',
    'recipient.name',
    'recipient.address.city',
    'weight',
    'volume',
    'declaredValue',
    'deliveryDeadline',
  ]);
  if (missing) return missing;

  const weight = positiveNumber(body.weight);
  const volume = positiveNumber(body.volume);
  const declaredValue = positiveNumber(body.declaredValue);
  if (!weight) return badRequest('weight must be a positive number');
  if (!volume) return badRequest('volume must be a positive number');
  if (!declaredValue) return badRequest('declaredValue must be a positive number');

  const deadline = parseDate(body.deliveryDeadline);
  if (!deadline) return badRequest('deliveryDeadline must be a valid date');
  if (deadline < new Date()) return badRequest('deliveryDeadline cannot be in the past');

  const category = body.category || 'other';
  if (!CATEGORIES.includes(category)) {
    return badRequest(`category must be one of: ${CATEGORIES.join(', ')}`);
  }

  const specialHandling = Array.isArray(body.specialHandling) ? body.specialHandling : [];
  const invalidHandling = specialHandling.filter((h) => !HANDLING.includes(h));
  if (invalidHandling.length) {
    return badRequest(`Unknown specialHandling: ${invalidHandling.join(', ')}`);
  }

  const origin = withCoordinates(body.origin);
  const destination = withCoordinates(body.recipient.address);
  if (origin.city === destination.city) {
    return badRequest('Origin and destination cities must differ');
  }

  const now = new Date();
  const newParcel = {
    senderId: profile._id,
    title: body.title,
    description: body.description || '',
    origin,
    weight,
    volume,
    dimensions: body.dimensions || {},
    declaredValue,
    category,
    specialHandling,
    recipient: { ...body.recipient, address: destination },
    deliveryDeadline: deadline,
    preferredDeliveryTime: body.preferredDeliveryTime || 'anytime',
    status: 'pending',
    paymentStatus: 'pending',
    insuranceRequired: Boolean(body.insuranceRequired),
    insuranceAmount: body.insuranceRequired
      ? positiveNumber(body.insuranceAmount) || Math.round(declaredValue * 0.02 * 100) / 100
      : null,
    trackingHistory: [{ status: 'created', timestamp: now, note: 'Parcel listed' }],
    disputes: [],
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection('parcels').insertOne(newParcel);
  const created = await db.collection('parcels').findOne({ _id: toId(result.insertedId) });

  return ok({ message: 'Parcel listed', parcel: created }, { status: 201 });
});
