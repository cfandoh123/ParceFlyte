import { getDb, toId, idString } from '@/lib/db';
import { withAuth, currentUser } from '@/lib/auth';
import { ok, notFound, forbidden, badRequest, requireFields, positiveNumber } from '@/lib/api';
import matchingService from '@/lib/matching-service';

/** Append a counter-offer to a match's negotiation thread. */
export const POST = withAuth(['write:matches'], async (req, { params, user }) => {
  const db = await getDb();
  const match = await db.collection('matches').findOne({ _id: toId(params.id) });
  if (!match) return notFound('Match not found');

  if (match.status !== 'proposed') {
    return badRequest(`This match is ${match.status} and can no longer be negotiated`);
  }
  if (new Date() > new Date(match.expiresAt)) {
    return badRequest('This match has expired');
  }

  const body = await req.json();
  const missing = requireFields(body, ['proposedFee']);
  if (missing) return missing;

  const proposedFee = positiveNumber(body.proposedFee);
  if (!proposedFee) return badRequest('proposedFee must be a positive number');

  // The proposer is the caller — never taken from the request body, which would
  // let anyone post offers as the other party.
  const profile = await currentUser(db, user);
  const proposerId = profile?._id;
  const isSender = idString(match.senderId) === idString(proposerId);
  const isCarrier = idString(match.carrierId) === idString(proposerId);
  if (!isSender && !isCarrier) return forbidden('Only the sender or carrier can negotiate this match');

  const parcel = await db.collection('parcels').findOne({ _id: toId(match.parcelId) });
  if (!parcel) return notFound('Parcel not found');

  const maxAcceptableFee = matchingService.maxAcceptableFee(parcel);
  if (proposedFee > maxAcceptableFee) {
    return badRequest('Proposed fee exceeds the maximum acceptable fee for this parcel', { maxAcceptableFee });
  }

  const history = match.negotiation?.negotiationHistory || [];
  const last = history[history.length - 1];
  if (last && idString(last.proposedBy) === idString(proposerId)) {
    return badRequest('You already have an offer on the table — wait for a response');
  }

  const now = new Date();
  const entry = {
    proposedBy: proposerId,
    proposedByRole: isSender ? 'sender' : 'carrier',
    amount: proposedFee,
    message: body.message || '',
    timestamp: now,
  };

  await db.collection('matches').updateOne(
    { _id: match._id },
    {
      $set: { 'negotiation.proposedFee': proposedFee, updatedAt: now },
      $push: { 'negotiation.negotiationHistory': entry },
    }
  );

  const updated = await db.collection('matches').findOne({ _id: match._id });
  return ok({ message: 'Counter-offer sent', match: updated, negotiationEntry: entry });
});

/** The full negotiation thread, plus the band the engine recommends. */
export const GET = withAuth(['read:matches'], async (req, { params }) => {
  const db = await getDb();
  const match = await db.collection('matches').findOne({ _id: toId(params.id) });
  if (!match) return notFound('Match not found');

  const [parcel, travel] = await Promise.all([
    db.collection('parcels').findOne({ _id: toId(match.parcelId) }),
    db.collection('travels').findOne({ _id: toId(match.travelId) }),
  ]);

  return ok({
    matchId: match._id,
    status: match.status,
    expiresAt: match.expiresAt,
    negotiation: match.negotiation,
    pricing: parcel && travel ? matchingService.suggestPricing(parcel, travel) : null,
    maxAcceptableFee: parcel ? matchingService.maxAcceptableFee(parcel) : null,
  });
});
