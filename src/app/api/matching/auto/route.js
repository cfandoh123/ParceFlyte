import { getDb, toId, idString } from '@/lib/db';
import { withAuth, currentUser } from '@/lib/auth';
import { ok, badRequest, notFound, requireFields } from '@/lib/api';
import matchingService from '@/lib/matching-service';
import { hydrateMatches, MATCH_TTL_DAYS } from '@/lib/matches';

/** Preview the top auto-match candidates without creating anything. */
export const GET = withAuth(['read:matches'], async (req) => {
  const { searchParams } = new URL(req.url);
  const parcelId = searchParams.get('parcelId');
  if (!parcelId) return badRequest('parcelId is required');

  const limit = parseInt(searchParams.get('limit')) || 5;
  const suggestions = await matchingService.autoMatchParcel(parcelId, { limit });

  return ok({
    parcelId,
    threshold: matchingService.autoMatchThreshold,
    count: suggestions.length,
    suggestions,
  });
});

/** Create match proposals for every candidate above the auto-match threshold. */
export const POST = withAuth(['write:matches'], async (req, { user }) => {
  const db = await getDb();
  const body = await req.json();

  const missing = requireFields(body, ['parcelId']);
  if (missing) return missing;

  const parcel = await db.collection('parcels').findOne({ _id: toId(body.parcelId) });
  if (!parcel) return notFound('Parcel not found');
  if (parcel.status !== 'pending') return badRequest('This parcel is no longer open for matching');

  const profile = await currentUser(db, user);
  const candidates = await matchingService.autoMatchParcel(body.parcelId, {
    ...(body.criteria || {}),
    limit: body.limit || 5,
  });

  if (!candidates.length) {
    return ok({
      message: `No travels scored above ${matchingService.autoMatchThreshold}. Try widening the deadline or the fee ceiling.`,
      created: [],
      threshold: matchingService.autoMatchThreshold,
    });
  }

  const now = new Date();
  const createdIds = [];
  const skipped = [];

  for (const candidate of candidates) {
    const { travel } = candidate;

    const existing = await db.collection('matches').findOne({
      parcelId: parcel._id,
      travelId: travel._id,
      status: { $in: ['proposed', 'accepted'] },
    });
    if (existing) {
      skipped.push({ travelId: travel._id, reason: 'Match already exists' });
      continue;
    }

    const result = await db.collection('matches').insertOne({
      parcelId: parcel._id,
      travelId: travel._id,
      senderId: parcel.senderId,
      carrierId: travel.carrierId,
      status: 'proposed',
      matchScore: candidate.matchScore,
      proposedBy: profile?._id ?? parcel.senderId,
      autoMatched: true,
      negotiation: {
        initialFee: candidate.estimatedDeliveryFee,
        proposedFee: null,
        finalFee: null,
        currency: travel.currency || 'USD',
        suggestedRange: candidate.pricing.negotiationRange,
        negotiationHistory: [],
      },
      agreement: {
        pickupLocation: travel.departureLocation.city,
        pickupDate: travel.departureDate,
        deliveryLocation: travel.arrivalLocation.city,
        deliveryDate: travel.arrivalDate,
        specialInstructions: '',
        insuranceRequired: Boolean(parcel.insuranceRequired),
        insuranceAmount: parcel.insuranceAmount || null,
      },
      messages: [],
      expiresAt: new Date(
        Math.min(now.getTime() + MATCH_TTL_DAYS * 86400000, new Date(travel.departureDate).getTime())
      ),
      createdAt: now,
      updatedAt: now,
    });
    createdIds.push(idString(result.insertedId));
  }

  const created = await db
    .collection('matches')
    .find({ _id: { $in: createdIds.map(toId) } })
    .toArray();

  return ok({
    message: `${createdIds.length} match${createdIds.length === 1 ? '' : 'es'} proposed`,
    created: await hydrateMatches(db, created),
    skipped,
    threshold: matchingService.autoMatchThreshold,
  });
});
