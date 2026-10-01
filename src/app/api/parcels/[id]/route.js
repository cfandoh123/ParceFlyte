import { getDb, toId, idString } from '@/lib/db';
import { withAuth, isAdmin, publicUser } from '@/lib/auth';
import { ok, notFound, forbidden, badRequest } from '@/lib/api';

/** Tracking events a participant can record. `created` and `matched` are set by the system. */
const TRACKING_STATUSES = [
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'failed_delivery',
];

/** Parcel status implied by the latest tracking event. */
const STATUS_FOR_TRACKING = {
  created: 'pending',
  matched: 'matched',
  picked_up: 'in_transit',
  in_transit: 'in_transit',
  out_for_delivery: 'in_transit',
  delivered: 'delivered',
  failed_delivery: 'matched',
};

/**
 * A parcel is visible to its sender, to admins, and to any carrier it has been
 * matched or proposed to — they need the details to decide on the offer.
 */
async function canView(db, parcel, profile) {
  const me = idString(profile._id);
  if (idString(parcel.senderId) === me || idString(parcel.matchedCarrierId) === me) return true;
  if (isAdmin(profile)) return true;
  const match = await db.collection('matches').findOne({ parcelId: parcel._id, carrierId: profile._id });
  return Boolean(match);
}

export const GET = withAuth(async (req, { params, profile }) => {
  const db = await getDb();
  const parcel = await db.collection('parcels').findOne({ _id: toId(params.id) });
  if (!parcel) return notFound('Parcel not found');
  if (!(await canView(db, parcel, profile))) return forbidden('You do not have access to this parcel');

  const [sender, carrier] = await Promise.all([
    db.collection('users').findOne({ _id: toId(parcel.senderId) }),
    parcel.matchedCarrierId
      ? db.collection('users').findOne({ _id: toId(parcel.matchedCarrierId) })
      : Promise.resolve(null),
  ]);

  return ok({ parcel: { ...parcel, sender: publicUser(sender), carrier: publicUser(carrier) } });
});

/** Advance a parcel through its delivery lifecycle by appending a tracking event. */
export const POST = withAuth(async (req, { params, profile }) => {
  const db = await getDb();
  const parcel = await db.collection('parcels').findOne({ _id: toId(params.id) });
  if (!parcel) return notFound('Parcel not found');

  const isParticipant =
    idString(parcel.senderId) === idString(profile?._id) ||
    idString(parcel.matchedCarrierId) === idString(profile?._id);
  if (!isParticipant) return forbidden('Only the sender or the matched carrier can update tracking');

  const body = await req.json();
  if (!TRACKING_STATUSES.includes(body.status)) {
    return badRequest(`status must be one of: ${TRACKING_STATUSES.join(', ')}`);
  }
  if (parcel.status === 'delivered') return badRequest('This parcel has already been delivered');
  if (!parcel.matchedCarrierId || !['matched', 'in_transit'].includes(parcel.status)) {
    return badRequest('Tracking starts once the parcel has been matched with a carrier');
  }
  // Confirming delivery releases the carrier's payment, so it is the sender's call.
  if (body.status === 'delivered' && idString(parcel.senderId) !== idString(profile._id) && !isAdmin(profile)) {
    return forbidden('Only the sender can confirm delivery');
  }

  const now = new Date();
  const event = { status: body.status, timestamp: now, location: body.location || '', note: body.note || '' };
  const parcelStatus = STATUS_FOR_TRACKING[body.status];

  const updates = { status: parcelStatus, updatedAt: now };

  // Delivery confirmation releases the escrowed payment.
  if (body.status === 'delivered') {
    updates.paymentStatus = 'released';
    updates.deliveredAt = now;
    await db.collection('payments').updateOne(
      { parcelId: parcel._id, escrowStatus: 'funded' },
      { $set: { escrowStatus: 'released', releasedAt: now, updatedAt: now } }
    );
  }

  await db.collection('parcels').updateOne(
    { _id: parcel._id },
    { $set: updates, $push: { trackingHistory: event } }
  );

  const updated = await db.collection('parcels').findOne({ _id: parcel._id });
  return ok({ message: `Parcel marked ${body.status.replace(/_/g, ' ')}`, parcel: updated });
});

export const DELETE = withAuth(async (req, { params, profile }) => {
  const db = await getDb();
  const parcel = await db.collection('parcels').findOne({ _id: toId(params.id) });
  if (!parcel) return notFound('Parcel not found');

  if (idString(parcel.senderId) !== idString(profile?._id)) {
    return forbidden('Only the sender can cancel this parcel');
  }
  if (['in_transit', 'delivered'].includes(parcel.status)) {
    return badRequest('A parcel already in transit cannot be cancelled');
  }

  await db.collection('parcels').updateOne(
    { _id: parcel._id },
    { $set: { status: 'cancelled', updatedAt: new Date() } }
  );

  return ok({ message: 'Parcel cancelled' });
});
