import { NextResponse } from 'next/server';
import { isAuth0Configured } from '@/lib/auth';

/**
 * Auth0 route handler — serves /api/auth/login, /signup, /logout, /callback
 * and /me.
 *
 * When Auth0 is not configured the app is running on the demo session, so
 * these endpoints redirect rather than crashing on a missing AUTH0_SECRET.
 */
async function handler(req, ctx) {
  if (!isAuth0Configured()) {
    const params = await ctx?.params;
    const action = params?.auth0;
    if (action === 'me') {
      return NextResponse.json({ error: 'Auth0 is not configured — running on the demo session' }, { status: 401 });
    }
    // login / signup / logout / callback all land back in the app in demo mode.
    return NextResponse.redirect(new URL(action === 'logout' ? '/' : '/dashboard', req.url));
  }

  const { handleAuth, handleLogin } = require('@auth0/nextjs-auth0');
  return handleAuth({
    // Same flow as login, but opens Auth0's hosted page on its sign-up tab.
    signup: handleLogin({ authorizationParams: { screen_hint: 'signup' }, returnTo: '/dashboard' }),
  })(req, ctx);
}

export const GET = handler;
export const POST = handler;
