import { getDb, toId } from '@/lib/db';
import { withAuth } from '@/lib/auth';
import { ok, badRequest, conflict, pagination, paginated, requireFields } from '@/lib/api';

export const GET = withAuth(['read:users'], async (req) => {
  const db = await getDb();
  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = pagination(searchParams);

  const query = { isActive: { $ne: false } };
  if (searchParams.get('role')) query.roles = searchParams.get('role');
  if (searchParams.get('kycStatus')) query.kycStatus = searchParams.get('kycStatus');

  const [users, total] = await Promise.all([
    db.collection('users').find(query).sort({ 'rating.average': -1 }).skip(skip).limit(limit).toArray(),
    db.collection('users').countDocuments(query),
  ]);

  return ok(paginated(users, total, { page, limit }));
});

export const POST = withAuth(['write:users'], async (req) => {
  const db = await getDb();
  const body = await req.json();

  const missing = requireFields(body, ['auth0Id', 'email', 'firstName', 'lastName']);
  if (missing) return missing;

  const existing = await db.collection('users').findOne({
    $or: [{ auth0Id: body.auth0Id }, { email: body.email }],
  });
  if (existing) return conflict('A user with that Auth0 id or email already exists');

  const roles = Array.isArray(body.roles) && body.roles.length ? body.roles : ['sender'];
  if (roles.some((role) => !['sender', 'carrier', 'admin'].includes(role))) {
    return badRequest('roles must be any of: sender, carrier, admin');
  }

  const now = new Date();
  const newUser = {
    auth0Id: body.auth0Id,
    email: body.email,
    firstName: body.firstName,
    lastName: body.lastName,
    phoneNumber: body.phoneNumber || null,
    dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
    address: body.address || {},
    kycStatus: 'pending',
    kycDocuments: [],
    roles,
    rating: { average: 0, totalReviews: 0, completedDeliveries: 0, successfulDeliveries: 0 },
    paymentMethods: [],
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection('users').insertOne(newUser);
  const created = await db.collection('users').findOne({ _id: toId(result.insertedId) });

  return ok({ message: 'User created', user: created }, { status: 201 });
});
