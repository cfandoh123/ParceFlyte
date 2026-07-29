import { getDb, toId, idString } from '@/lib/db';
import { withAuth, currentUser } from '@/lib/auth';
import { ok, notFound, forbidden, badRequest } from '@/lib/api';

export const GET = withAuth(['read:travels'], async (req, { params }) => {
  const db = await getDb();
  const travel = await db.collection('travels').findOne({ _id: toId(params.id) });
  if (!travel) return notFound('Travel not found');

  const carrier = await db.collection('users').findOne({ _id: toId(travel.carrierId) });
  return ok({ travel: { ...travel, carrier } });
});

export const PUT = withAuth(['write:travels'], async (req, { params, user }) => {
  const db = await getDb();
  const travel = await db.collection('travels').findOne({ _id: toId(params.id) });
  if (!travel) return notFound('Travel not found');

  const profile = await currentUser(db, user);
  if (idString(travel.carrierId) !== idString(profile?._id)) {
    return forbidden('Only the carrier can edit this travel');
  }

  const body = await req.json();
  const editable = ['status', 'notes', 'baseDeliveryFee', 'availableCapacity', 'transportDetails'];
  const updates = Object.fromEntries(Object.entries(body).filter(([key]) => editable.includes(key)));
  if (!Object.keys(updates).length) return badRequest('No editable fields supplied');

  await db.collection('travels').updateOne(
    { _id: travel._id },
    { $set: { ...updates, updatedAt: new Date() } }
  );

  const updated = await db.collection('travels').findOne({ _id: travel._id });
  return ok({ message: 'Travel updated', travel: updated });
});

export const DELETE = withAuth(['write:travels'], async (req, { params, user }) => {
  const db = await getDb();
  const travel = await db.collection('travels').findOne({ _id: toId(params.id) });
  if (!travel) return notFound('Travel not found');

  const profile = await currentUser(db, user);
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
