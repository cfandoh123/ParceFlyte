import { getDb, toId, idString } from '@/lib/db';
import { withAuth, isAdmin, restrictToParty } from '@/lib/auth';
import { ok, badRequest, notFound, forbidden, conflict, pagination, paginated, requireFields } from '@/lib/api';

const METHODS = ['stripe', 'paypal', 'bank_transfer', 'crypto'];

export const GET = withAuth(async (req, { profile }) => {
  const db = await getDb();
  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = pagination(searchParams);
  const get = (key) => searchParams.get(key);

  const query = {};
  if (get('parcelId')) query.parcelId = toId(get('parcelId'));
  if (get('matchId')) query.matchId = toId(get('matchId'));
  if (get('senderId')) query.senderId = toId(get('senderId'));
  if (get('carrierId')) query.carrierId = toId(get('carrierId'));
  if (get('status')) query.status = get('status');
  if (get('escrowStatus')) query.escrowStatus = get('escrowStatus');
  if (get('minAmount') || get('maxAmount')) {
    query.amount = {};
    if (get('minAmount')) query.amount.$gte = parseFloat(get('minAmount'));
    if (get('maxAmount')) query.amount.$lte = parseFloat(get('maxAmount'));
  }

  if (get('mine') === 'true') {
    if (profile) query.$or = [{ senderId: profile._id }, { carrierId: profile._id }];
  }

  const scoped = restrictToParty(query, profile, ['senderId', 'carrierId']);

  const [payments, total] = await Promise.all([
    db.collection('payments').find(scoped).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    db.collection('payments').countDocuments(scoped),
  ]);

  return ok(paginated(payments, total, { page, limit }));
});

/** Fund escrow for an accepted match. */
export const POST = withAuth(async (req, { profile }) => {
  const db = await getDb();
  const body = await req.json();

  const missing = requireFields(body, ['matchId']);
  if (missing) return missing;

  const match = await db.collection('matches').findOne({ _id: toId(body.matchId) });
  if (!match) return notFound('Match not found');
  if (idString(match.senderId) !== idString(profile._id)) {
    return forbidden('Only the sender pays for a match');
  }
  if (match.status !== 'accepted') return badRequest('Only accepted matches can be paid for');

  const existing = await db.collection('payments').findOne({ matchId: match._id });
  if (existing) return conflict('This match already has a payment', { paymentId: existing._id });

  const paymentMethod = body.paymentMethod || 'stripe';
  if (!METHODS.includes(paymentMethod)) {
    return badRequest(`paymentMethod must be one of: ${METHODS.join(', ')}`);
  }

  const amount = match.negotiation?.finalFee ?? match.negotiation?.initialFee;
  if (!amount) return badRequest('This match has no agreed fee');

  const now = new Date();
  const result = await db.collection('payments').insertOne({
    matchId: match._id,
    parcelId: match.parcelId,
    senderId: match.senderId,
    carrierId: match.carrierId,
    amount,
    currency: match.negotiation?.currency || 'USD',
    paymentMethod,
    status: 'completed',
    escrowStatus: 'funded',
    releaseCondition: 'delivery_confirmed',
    disputes: [],
    createdAt: now,
    updatedAt: now,
  });

  await db.collection('parcels').updateOne(
    { _id: toId(match.parcelId) },
    { $set: { paymentStatus: 'paid', updatedAt: now } }
  );

  const payment = await db.collection('payments').findOne({ _id: toId(result.insertedId) });
  return ok({ message: 'Payment held in escrow', payment }, { status: 201 });
});

/** Release escrow to the carrier, or refund the sender. */
export const PUT = withAuth(async (req, { profile }) => {
  const db = await getDb();
  const body = await req.json();

  const missing = requireFields(body, ['paymentId', 'action']);
  if (missing) return missing;

  if (!['release', 'refund', 'dispute'].includes(body.action)) {
    return badRequest('action must be one of: release, refund, dispute');
  }

  const payment = await db.collection('payments').findOne({ _id: toId(body.paymentId) });
  if (!payment) return notFound('Payment not found');
  if (payment.escrowStatus !== 'funded') {
    return badRequest(`Escrow is already ${payment.escrowStatus}`);
  }

  const isSender = idString(payment.senderId) === idString(profile._id);
  const isCarrier = idString(payment.carrierId) === idString(profile._id);
  const admin = isAdmin(profile);
  if (!isSender && !isCarrier && !admin) return forbidden('You are not a party to this payment');
  // Money only moves away from whoever asks: the sender can release it to the
  // carrier, the carrier can hand it back. Anything else is a dispute.
  if (body.action === 'release' && !isSender && !admin) {
    return forbidden('Only the sender can release payment to the carrier');
  }
  if (body.action === 'refund' && !isCarrier && !admin) {
    return forbidden('Only the carrier can refund the sender — open a dispute instead');
  }

  const now = new Date();

  if (body.action === 'dispute') {
    await db.collection('payments').updateOne(
      { _id: payment._id },
      {
        $set: { escrowStatus: 'disputed', status: 'disputed', updatedAt: now },
        $push: {
          disputes: {
            reason: body.reason || 'other',
            description: body.description || '',
            status: 'open',
            priority: body.priority || 'medium',
            raisedBy: profile?._id,
            raisedAt: now,
          },
        },
      }
    );
    return ok({ message: 'Dispute opened — an admin will review this payment' });
  }

  const isRelease = body.action === 'release';
  await db.collection('payments').updateOne(
    { _id: payment._id },
    {
      $set: {
        escrowStatus: isRelease ? 'released' : 'refunded',
        status: isRelease ? 'completed' : 'refunded',
        [isRelease ? 'releasedAt' : 'refundedAt']: now,
        updatedAt: now,
      },
    }
  );

  await db.collection('parcels').updateOne(
    { _id: toId(payment.parcelId) },
    { $set: { paymentStatus: isRelease ? 'released' : 'refunded', updatedAt: now } }
  );

  const updated = await db.collection('payments').findOne({ _id: payment._id });
  return ok({
    message: isRelease ? 'Escrow released to the carrier' : 'Payment refunded to the sender',
    payment: updated,
  });
});
