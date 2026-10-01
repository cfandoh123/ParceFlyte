import { getDb, toId, idString } from '@/lib/db';
import { withAuth, publicUser } from '@/lib/auth';
import { ok, notFound, forbidden, badRequest, positiveNumber } from '@/lib/api';

const TRAVEL_STATUSES = ['planned', 'confirmed', 'in_progress', 'completed', 'cancelled'];

export const GET = withAuth(async (req, { params }) => {
  const db = await getDb();
  const travel = await db.collection('travels').findOne({ _id: toId(params.id) });
  if (!travel) return notFound('Travel not found');

  const carrier = await db.collection('users').findOne({ _id: toId(travel.carrierId) });
  return ok({ travel: { ...travel, carrier: publicUser(carrier) } });
});

export const PUT = withAuth(async (req, { params, profile }) => {
  const db = await getDb();
  const travel = await db.collection('travels').findOne({ _id: toId(params.id) });
  if (!travel) return notFound('Travel not found');

  if (idString(travel.carrierId) !== idString(profile?._id)) {
    return forbidden('Only the carrier can edit this travel');
  }

  const body = await req.json();
  const editable = ['status', 'notes', 'baseDeliveryFee', 'availableCapacity', 'transportDetails'];
  const updates = Object.fromEntries(Object.entries(body).filter(([key]) => editable.includes(key)));
  if (!Object.keys(updates).length) return badRequest('No editable fields supplied');

  if ('status' in updates && !TRAVEL_STATUSES.includes(updates.status)) {
    return badRequest(`status must be one of: ${TRAVEL_STATUSES.join(', ')}`);
  }
  if ('baseDeliveryFee' in updates) {
    updates.baseDeliveryFee = positiveNumber(updates.baseDeliveryFee);
    if (!updates.baseDeliveryFee) return badRequest('baseDeliveryFee must be a positive number');
  }
  if ('availableCapacity' in updates) {
    const weight = Number(updates.availableCapacity?.weight);
    const volume = Number(updates.availableCapacity?.volume);
    if (!(weight >= 0) || !(volume >= 0)) {
      return badRequest('availableCapacity weight and volume must be numbers of zero or more');
    }
    updates.availableCapacity = { weight, volume };
  }

  await db.collection('travels').updateOne(
    { _id: travel._id },
    { $set: { ...updates, updatedAt: new Date() } }
  );

  const updated = await db.collection('travels').findOne({ _id: travel._id });
  return ok({ message: 'Travel updated', travel: updated });
});

export const DELETE = withAuth(async (req, { params, profile }) => {
  const db = await getDb();
  const travel = await db.collection('travels').findOne({ _id: toId(params.id) });
  if (!travel) return notFound('Travel not found');

  if (idString(travel.carrierId) !== idString(profile?._id)) {
    return forbidden('Only the carrier can cancel this travel');
  }

  const activeMatches = await db.collection('matches').countDocuments({
    travelId: travel._id,
    status: 'accepted',
  });
  if (activeMatches > 0) {
    return badRequest('This travel has accepted matches — cancel those first');
  }

  await db.collection('travels').updateOne(
    { _id: travel._id },
    { $set: { status: 'cancelled', updatedAt: new Date() } }
  );

  return ok({ message: 'Travel cancelled' });
});
