import { getDb, toId, idString } from '@/lib/db';
import { withAuth, currentUser } from '@/lib/auth';
import { ok, notFound, forbidden, badRequest } from '@/lib/api';
import { hydrateMatches } from '@/lib/matches';

/**
 * Accept a match. This is the point the deal becomes real, so it also:
 *  - locks the final fee
 *  - moves the parcel to `matched` and records a tracking event
 *  - decrements the travel's remaining capacity
 *  - funds escrow for the agreed amount
 *  - expires every other open match competing for the same parcel
 */
export const POST = withAuth(['write:matches'], async (req, { params, user }) => {
  const db = await getDb();
  const match = await db.collection('matches').findOne({ _id: toId(params.id) });
  if (!match) return notFound('Match not found');

  if (match.status !== 'proposed') {
    return badRequest(`This match is already ${match.status}`);
  }
  if (new Date() > new Date(match.expiresAt)) {
    return badRequest('This match has expired');
  }

  const profile = await currentUser(db, user);
  const isSender = idString(match.senderId) === idString(profile?._id);
  const isCarrier = idString(match.carrierId) === idString(profile?._id);
  if (!isSender && !isCarrier) return forbidden('Only the sender or carrier can accept this match');

  // You cannot accept your own outstanding offer — the other side must respond.
  const history = match.negotiation?.negotiationHistory || [];
  const lastOffer = history[history.length - 1];
  if (lastOffer && idString(lastOffer.proposedBy) === idString(profile?._id)) {
    return badRequest('You cannot accept your own offer — wait for the other party');
  }

  const [parcel, travel] = await Promise.all([
    db.collection('parcels').findOne({ _id: toId(match.parcelId) }),
    db.collection('travels').findOne({ _id: toId(match.travelId) }),
  ]);
  if (!parcel) return notFound('Parcel not found');
  if (!travel) return notFound('Travel not found');

  if (parcel.status !== 'pending') return badRequest('This parcel has already been matched');
  if (travel.availableCapacity.weight < parcel.weight || travel.availableCapacity.volume < parcel.volume) {
    return badRequest('This travel no longer has capacity for the parcel');
  }

  const now = new Date();
  const finalFee = match.negotiation?.proposedFee ?? match.negotiation?.initialFee;

  await db.collection('matches').updateOne(
    { _id: match._id },
    {
      $set: {
        status: 'accepted',
        'negotiation.finalFee': finalFee,
        acceptedAt: now,
        acceptedBy: profile?._id,
        updatedAt: now,
      },
    }
  );

  await db.collection('parcels').updateOne(
    { _id: parcel._id },
    {
      $set: {
        status: 'matched',
        matchedCarrierId: match.carrierId,
        matchId: match._id,
        paymentStatus: 'paid',
        updatedAt: now,
      },
      $push: {
        trackingHistory: {
          status: 'matched',
          timestamp: now,
          note: `Matched with carrier for $${finalFee}`,
        },
      },
    }
  );

  await db.collection('travels').updateOne(
    { _id: travel._id },
    {
      $set: {
        'availableCapacity.weight': Math.round((travel.availableCapacity.weight - parcel.weight) * 100) / 100,
        'availableCapacity.volume': Math.round((travel.availableCapacity.volume - parcel.volume) * 100) / 100,
        updatedAt: now,
      },
    }
  );

  // Fund escrow, unless a payment already exists for this match.
  const existingPayment = await db.collection('payments').findOne({ matchId: match._id });
  if (!existingPayment) {
    await db.collection('payments').insertOne({
      matchId: match._id,
      parcelId: parcel._id,
      senderId: match.senderId,
      carrierId: match.carrierId,
      amount: finalFee,
      currency: match.negotiation?.currency || 'USD',
      paymentMethod: 'stripe',
      status: 'completed',
      escrowStatus: 'funded',
      releaseCondition: 'delivery_confirmed',
      disputes: [],
      createdAt: now,
      updatedAt: now,
    });
  }

  // Any other open proposal for this parcel is now moot.
  const competing = await db
    .collection('matches')
    .find({ parcelId: parcel._id, status: 'proposed' })
    .toArray();
  for (const other of competing) {
    if (idString(other._id) === idString(match._id)) continue;
    await db.collection('matches').updateOne(
      { _id: other._id },
      { $set: { status: 'expired', expiredReason: 'Parcel matched with another carrier', updatedAt: now } }
    );
  }

  const updated = await db.collection('matches').findOne({ _id: match._id });
  const [hydrated] = await hydrateMatches(db, [updated]);

  return ok({
    message: 'Match accepted — payment held in escrow until delivery is confirmed',
    match: hydrated,
    finalFee,
  });
});
