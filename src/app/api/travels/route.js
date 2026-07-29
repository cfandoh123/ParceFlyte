import { getDb, toId } from '@/lib/db';
import { withAuth, currentUser } from '@/lib/auth';
import { ok, badRequest, pagination, paginated, requireFields, positiveNumber, parseDate } from '@/lib/api';
import { CITIES } from '@/lib/demo-data';

const TRAVEL_MODES = ['air', 'land', 'sea', 'mixed'];
const TRAVEL_STATUSES = ['planned', 'confirmed', 'in_progress', 'completed', 'cancelled'];

/** Attach known coordinates to a place so distance scoring works. */
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

export const GET = withAuth(['read:travels'], async (req) => {
  const db = await getDb();
  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = pagination(searchParams);

  const query = {};
  const get = (key) => searchParams.get(key);

  if (get('carrierId')) query.carrierId = toId(get('carrierId'));
  if (get('departureCity')) query['departureLocation.city'] = get('departureCity');
  if (get('arrivalCity')) query['arrivalLocation.city'] = get('arrivalCity');
  if (get('departureCountry')) query['departureLocation.country'] = get('departureCountry');
  if (get('arrivalCountry')) query['arrivalLocation.country'] = get('arrivalCountry');
  if (get('travelMode')) query.travelMode = get('travelMode');
  if (get('status')) query.status = get('status');
  if (get('minCapacity')) query['availableCapacity.weight'] = { $gte: parseFloat(get('minCapacity')) };
  if (get('maxFee')) query.baseDeliveryFee = { $lte: parseFloat(get('maxFee')) };
  if (get('departureDate')) query.departureDate = { $gte: new Date(get('departureDate')) };
  if (get('arrivalDate')) query.arrivalDate = { $lte: new Date(get('arrivalDate')) };
  if (get('upcoming') === 'true') query.departureDate = { $gte: new Date() };

  const [travels, total] = await Promise.all([
    db.collection('travels').find(query).sort({ departureDate: 1 }).skip(skip).limit(limit).toArray(),
    db.collection('travels').countDocuments(query),
  ]);

  // Join carriers in one query rather than one per travel.
  const carrierIds = [...new Set(travels.map((t) => String(t.carrierId)))];
  const carriers = carrierIds.length
    ? await db.collection('users').find({ _id: { $in: carrierIds.map(toId) } }).toArray()
    : [];
  const carrierMap = Object.fromEntries(carriers.map((c) => [String(c._id), c]));

  const withCarrier = travels.map((travel) => ({
    ...travel,
    carrier: carrierMap[String(travel.carrierId)] || null,
  }));

  return ok(paginated(withCarrier, total, { page, limit }));
});

export const POST = withAuth(['write:travels'], async (req, { user }) => {
  const db = await getDb();
  const body = await req.json();
  const profile = await currentUser(db, user);

  const missing = requireFields(body, [
    'departureLocation.city',
    'arrivalLocation.city',
    'travelMode',
    'departureDate',
    'arrivalDate',
    'availableCapacity.weight',
    'availableCapacity.volume',
    'baseDeliveryFee',
  ]);
  if (missing) return missing;

  if (!TRAVEL_MODES.includes(body.travelMode)) {
    return badRequest(`travelMode must be one of: ${TRAVEL_MODES.join(', ')}`);
  }
  if (body.status && !TRAVEL_STATUSES.includes(body.status)) {
    return badRequest(`status must be one of: ${TRAVEL_STATUSES.join(', ')}`);
  }

  const departureDate = parseDate(body.departureDate);
  const arrivalDate = parseDate(body.arrivalDate);
  if (!departureDate || !arrivalDate) return badRequest('departureDate and arrivalDate must be valid dates');
  if (arrivalDate < departureDate) return badRequest('arrivalDate cannot be before departureDate');

  const weight = positiveNumber(body.availableCapacity.weight);
  const volume = positiveNumber(body.availableCapacity.volume);
  if (!weight || !volume) return badRequest('availableCapacity weight and volume must be positive numbers');

  const fee = positiveNumber(body.baseDeliveryFee);
  if (!fee) return badRequest('baseDeliveryFee must be a positive number');

  const departure = withCoordinates(body.departureLocation);
  const arrival = withCoordinates(body.arrivalLocation);
  if (departure.city === arrival.city) return badRequest('Departure and arrival cities must differ');

  const now = new Date();
  const newTravel = {
    carrierId: body.carrierId ? toId(body.carrierId) : profile?._id,
    departureLocation: departure,
    arrivalLocation: arrival,
    travelMode: body.travelMode,
    transportDetails: body.transportDetails || {},
    departureDate,
    arrivalDate,
    availableCapacity: { weight, volume },
    baseDeliveryFee: fee,
    currency: body.currency || 'USD',
    status: body.status || 'planned',
    verificationMethod: body.verificationMethod || 'manual',
    notes: body.notes || '',
    createdAt: now,
    updatedAt: now,
  };

  if (!newTravel.carrierId) return badRequest('Could not resolve the carrier for this travel');

  const result = await db.collection('travels').insertOne(newTravel);
  const created = await db.collection('travels').findOne({ _id: toId(result.insertedId) });

  return ok({ message: 'Travel posted', travel: created }, { status: 201 });
});
