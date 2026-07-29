import { getDb, toId } from '@/lib/db';
import { withAuth } from '@/lib/auth';
import { ok, notFound, badRequest } from '@/lib/api';

/** Look a user up by ObjectId or by Auth0 id — both are used as handles. */
async function findUser(db, id) {
  return (
    (await db.collection('users').findOne({ _id: toId(id) })) ||
    (await db.collection('users').findOne({ auth0Id: id }))
  );
}

export const GET = withAuth(['read:users'], async (req, { params }) => {
  const db = await getDb();
  const user = await findUser(db, params.id);
  if (!user) return notFound('User not found');
  return ok({ user });
});

export const PUT = withAuth(['write:users'], async (req, { params }) => {
  const db = await getDb();
  const user = await findUser(db, params.id);
  if (!user) return notFound('User not found');

  const body = await req.json();

  // Identity, verification state and reputation are not client-editable.
  const immutable = ['_id', 'auth0Id', 'kycStatus', 'rating', 'createdAt'];
  const updates = Object.fromEntries(Object.entries(body).filter(([key]) => !immutable.includes(key)));
  if (!Object.keys(updates).length) return badRequest('No editable fields supplied');

  await db.collection('users').updateOne(
    { _id: user._id },
    { $set: { ...updates, updatedAt: new Date() } }
  );

  const updated = await db.collection('users').findOne({ _id: user._id });
  return ok({ message: 'User updated', user: updated });
});

export const DELETE = withAuth(['write:users'], async (req, { params }) => {
  const db = await getDb();
  const user = await findUser(db, params.id);
  if (!user) return notFound('User not found');

  // Soft delete — matches and ratings reference this user.
  await db.collection('users').updateOne(
    { _id: user._id },
    { $set: { isActive: false, deactivatedAt: new Date(), updatedAt: new Date() } }
  );

  return ok({ message: 'User deactivated' });
});
