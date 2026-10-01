import { isDemoMode } from '@/lib/db';
import { getAuthContext, isAuth0Configured, errorResponse } from '@/lib/auth';
import { ok } from '@/lib/api';

/** These handlers read the request and the session, so they are never prerendered. */
export const dynamic = 'force-dynamic';

/**
 * Who am I? The client bootstraps from this. Unlike every other route it
 * answers anonymous callers too, so public pages can tell "signed out" apart
 * from "failed to load".
 */
export async function GET() {
  try {
    const auth = await getAuthContext();
    return ok({
      demoMode: isDemoMode(),
      authEnabled: isAuth0Configured(),
      authenticated: Boolean(auth?.profile),
      user: auth?.profile || null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
