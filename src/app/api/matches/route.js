import { getDb, toId, idString } from '@/lib/db';
import { withAuth, currentUser } from '@/lib/auth';
import { ok, badRequest, notFound, conflict, pagination, paginated, requireFields } from '@/lib/api';
import matchingService from '@/lib/matching-service';
import { hydrateMatches, MATCH_TTL_DAYS } from '@/lib/matches';

export const GET = withAuth(['read:matches'], async (req, { user }) => {
  const db = await getDb();
  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = pagination(searchParams);
  const get = (key) => searchParams.get(key);

  const query = {};
  if (get('parcelId')) query.parcelId = toId(get('parcelId'));
  if (get('travelId')) query.travelId = toId(get('travelId'));
  if (get('senderId')) query.senderId = toId(get('senderId'));
  if (get('carrierId')) query.carrierId = toId(get('carrierId'));
  if (get('status')) query.status = get('status');
  if (get('minScore')) query.matchScore = { $gte: parseFloat(get('minScore')) };

  // `mine=true` returns everything the caller is a party to, either side.
  if (get('mine') === 'true') {
    const profile = await currentUser(db, user);
    if (profile) query.$or = [{ senderId: profile._id }, { carrierId: profile._id }];
  }

  const [matches, total] = await Promise.all([
    db.collection('matches').find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    db.collection('matches').countDocuments(query),
  ]);

  return ok(paginated(await hydrateMatches(db, matches), total, { page, limit }));
});

export const POST = withAuth(['write:matches'], async (req, { user }) => {
  const db = await getDb();
  const body = await req.json();

  const missing = requireFields(body, ['parcelId', 'travelId']);
  if (missing) return missing;

  const [parcel, travel] = await Promise.all([
    db.collection('parcels').findOne({ _id: toId(body.parcelId) }),
    db.collection('travels').findOne({ _id: toId(body.travelId) }),
  ]);
  if (!parcel) return notFound('Parcel not found');
  if (!travel) return notFound('Travel not found');

  if (parcel.status !== 'pending') return badRequest('This parcel is no longer open for matching');
  if (!['planned', 'confirmed'].includes(travel.status)) {
    return badRequest('This travel is not accepting parcels');
  }
  if (idString(parcel.senderId) === idString(travel.carrierId)) {
    return badRequest('You cannot carry your own parcel');
  }

  // Capacity must still be there at the moment of proposing.
  if (travel.availableCapacity.weight < parcel.weight || travel.availableCapacity.volume < parcel.volume) {
    return badRequest('This travel no longer has capacity for the parcel');
  }

  const existing = await db.collection('matches').findOne({
    parcelId: parcel._id,
    travelId: travel._id,
    status: { $in: ['proposed', 'accepted'] },
  });
  if (existing) return conflict('A match already exists for this parcel and travel', { matchId: existing._id });

  const profile = await currentUser(db, user);
  const carrier = await db.collection('users').findOne({ _id: toId(travel.carrierId) });
  const score = matchingService.calculateMatchScore(parcel, travel, carrier);
  const pricing = matchingService.suggestPricing(parcel, travel);

  const now = new Date();
  const initialFee = body.proposedFee ?? matchingService.calculateEstimatedFee(parcel, travel);
  const ceiling = matchingService.maxAcceptableFee(parcel);
  if (initialFee > ceiling) {
    return badRequest('Opening fee exceeds the 15%-of-declared-value cap for this parcel', {
      maxAcceptableFee: ceiling,
    });
  }

  const newMatch = {
    parcelId: parcel._id,
    travelId: travel._id,
    senderId: parcel.senderId,
    carrierId: travel.carrierId,
    status: 'proposed',
    matchScore: score,
    proposedBy: profile?._id ?? parcel.senderId,
    negotiation: {
      initialFee,
      proposedFee: null,
      finalFee: null,
      currency: travel.currency || 'USD',
      suggestedRange: pricing.negotiationRange,
      negotiationHistory: [],
    },
    agreement: {
      pickupLocation: body.pickupLocation || `${travel.departureLocation.city}`,
      pickupDate: travel.departureDate,
      deliveryLocation: body.deliveryLocation || `${travel.arrivalLocation.city}`,
      deliveryDate: travel.arrivalDate,
      specialInstructions: body.specialInstructions || '',
      insuranceRequired: Boolean(parcel.insuranceRequired),
      insuranceAmount: parcel.insuranceAmount || null,
    },
    messages: [],
    expiresAt: new Date(Math.min(now.getTime() + MATCH_TTL_DAYS * 86400000, new Date(travel.departureDate).getTime())),
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection('matches').insertOne(newMatch);
  const created = await db.collection('matches').findOne({ _id: toId(result.insertedId) });
  const [hydrated] = await hydrateMatches(db, [created]);

  return ok({ message: 'Match proposed', match: hydrated }, { status: 201 });
});
