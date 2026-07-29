import { getDb, toId, idString } from '@/lib/db';
import { withAuth, currentUser } from '@/lib/auth';
import { ok, notFound, forbidden, badRequest } from '@/lib/api';

const TRACKING_STATUSES = [
  'created',
  'matched',
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

export const GET = withAuth(['read:parcels'], async (req, { params }) => {
  const db = await getDb();
  const parcel = await db.collection('parcels').findOne({ _id: toId(params.id) });
  if (!parcel) return notFound('Parcel not found');

  const [sender, carrier] = await Promise.all([
    db.collection('users').findOne({ _id: toId(parcel.senderId) }),
    parcel.matchedCarrierId
      ? db.collection('users').findOne({ _id: toId(parcel.matchedCarrierId) })
      : Promise.resolve(null),
  ]);

  return ok({ parcel: { ...parcel, sender, carrier } });
});

/** Advance a parcel through its delivery lifecycle by appending a tracking event. */
export const POST = withAuth(['write:parcels'], async (req, { params, user }) => {
  const db = await getDb();
  const parcel = await db.collection('parcels').findOne({ _id: toId(params.id) });
  if (!parcel) return notFound('Parcel not found');

  const profile = await currentUser(db, user);
  const isParticipant =
    idString(parcel.senderId) === idString(profile?._id) ||
    idString(parcel.matchedCarrierId) === idString(profile?._id);
  if (!isParticipant) return forbidden('Only the sender or the matched carrier can update tracking');

  const body = await req.json();
  if (!TRACKING_STATUSES.includes(body.status)) {
    return badRequest(`status must be one of: ${TRACKING_STATUSES.join(', ')}`);
  }
  if (parcel.status === 'delivered') return badRequest('This parcel has already been delivered');

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

export const DELETE = withAuth(['write:parcels'], async (req, { params, user }) => {
  const db = await getDb();
  const parcel = await db.collection('parcels').findOne({ _id: toId(params.id) });
  if (!parcel) return notFound('Parcel not found');

  const profile = await currentUser(db, user);
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
