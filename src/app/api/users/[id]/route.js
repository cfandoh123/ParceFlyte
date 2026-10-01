import { getDb, toId, idString } from '@/lib/db';
import { withAuth, isAdmin, publicUser } from '@/lib/auth';
import { ok, notFound, badRequest, forbidden } from '@/lib/api';

const ROLES = ['sender', 'carrier', 'admin'];

/** Fields an account holder may change about themselves. */
const SELF_EDITABLE = ['firstName', 'lastName', 'phoneNumber', 'dateOfBirth', 'address', 'avatarColor'];
/** Fields only an administrator may change. */
const ADMIN_EDITABLE = [...SELF_EDITABLE, 'roles', 'isActive'];

function isSelf(profile, user) {
  return idString(profile._id) === idString(user._id);
}

/** Anyone signed in can see a public profile; the full record is for its owner and admins. */
export const GET = withAuth(async (req, { params, profile }) => {
  const db = await getDb();
  const user = await db.collection('users').findOne({ _id: toId(params.id) });
  if (!user) return notFound('User not found');

  const full = isSelf(profile, user) || isAdmin(profile);
  return ok({ user: full ? user : publicUser(user) });
});

export const PUT = withAuth(async (req, { params, profile }) => {
  const db = await getDb();
  const user = await db.collection('users').findOne({ _id: toId(params.id) });
  if (!user) return notFound('User not found');

  const admin = isAdmin(profile);
  if (!isSelf(profile, user) && !admin) return forbidden('You can only edit your own profile');

  const body = await req.json();
  const editable = admin ? ADMIN_EDITABLE : SELF_EDITABLE;
  const updates = Object.fromEntries(Object.entries(body).filter(([key]) => editable.includes(key)));
  if (!Object.keys(updates).length) return badRequest('No editable fields supplied');

  if ('roles' in updates) {
    if (!Array.isArray(updates.roles) || updates.roles.some((role) => !ROLES.includes(role))) {
      return badRequest(`roles must be any of: ${ROLES.join(', ')}`);
    }
  }
  if ('isActive' in updates) updates.isActive = Boolean(updates.isActive);
  if (updates.dateOfBirth) {
    const dob = new Date(updates.dateOfBirth);
    if (Number.isNaN(dob.getTime())) return badRequest('dateOfBirth must be a valid date');
    updates.dateOfBirth = dob;
  }

  await db.collection('users').updateOne({ _id: user._id }, { $set: { ...updates, updatedAt: new Date() } });

  const updated = await db.collection('users').findOne({ _id: user._id });
  return ok({ message: 'User updated', user: updated });
});

export const DELETE = withAuth(async (req, { params, profile }) => {
  const db = await getDb();
  const user = await db.collection('users').findOne({ _id: toId(params.id) });
  if (!user) return notFound('User not found');

  if (!isSelf(profile, user) && !isAdmin(profile)) {
    return forbidden('You can only deactivate your own account');
  }

  // Soft delete — matches and ratings reference this user.
  await db.collection('users').updateOne(
    { _id: user._id },
    { $set: { isActive: false, deactivatedAt: new Date(), updatedAt: new Date() } }
  );

  return ok({ message: 'User deactivated' });
});
