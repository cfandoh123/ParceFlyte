import { getDb, isDemoMode } from '@/lib/db';
import { withAuth, currentUser } from '@/lib/auth';
import { ok } from '@/lib/api';

/** These handlers read the request and the session, so they are never prerendered. */
export const dynamic = 'force-dynamic';

/**
 * Who am I? The client bootstraps from this — it returns the signed-in user's
 * ParceFlyte profile plus whether the app is running against demo data.
 */
export const GET = withAuth(['read:users'], async (req, { user }) => {
  const db = await getDb();
  const profile = await currentUser(db, user);

  return ok({
    demoMode: isDemoMode(),
    authenticated: Boolean(profile),
    user: profile,
  });
});
