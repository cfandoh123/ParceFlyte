import { getDb } from '@/lib/db';
import { withAdmin } from '@/lib/auth';
import { ok, pagination, paginated } from '@/lib/api';

/** These handlers read the request and the session, so they are never prerendered. */
export const dynamic = 'force-dynamic';

/**
 * The user directory, with contact details — administrators only. Profiles are
 * created automatically on first sign-in, so there is no create endpoint.
 */
export const GET = withAdmin(async (req) => {
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
