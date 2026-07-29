/**
 * Auth wrapper for API routes.
 *
 * Routes call `withAuth(scopes, handler)` rather than Auth0's
 * `withApiAuthRequired` directly. When Auth0 is configured this delegates to it
 * and requests a scoped access token exactly as before. When it is not — the
 * default on a clean checkout — the request is served against a fixed demo
 * user so the whole app is explorable without an Auth0 tenant.
 */

import { NextResponse } from 'next/server';
import { DEMO_USER_ID, users as demoUsers } from './demo-data';

/** Auth0 is only usable when the full set of credentials is present. */
export function isAuth0Configured() {
  return Boolean(
    process.env.AUTH0_SECRET &&
      process.env.AUTH0_BASE_URL &&
      process.env.AUTH0_ISSUER_BASE_URL &&
      process.env.AUTH0_CLIENT_ID &&
      process.env.AUTH0_CLIENT_SECRET
  );
}

const demoUser = demoUsers.find((u) => u._id === DEMO_USER_ID);

/** The identity a demo-mode request runs as. */
export const DEMO_SESSION_USER = {
  sub: demoUser.auth0Id,
  userId: DEMO_USER_ID,
  email: demoUser.email,
  name: `${demoUser.firstName} ${demoUser.lastName}`,
  given_name: demoUser.firstName,
  family_name: demoUser.lastName,
  roles: demoUser.roles,
  isDemo: true,
};

/**
 * Wrap a route handler with authentication.
 *
 * @param {string[]} scopes  Auth0 scopes the handler needs.
 * @param {(req, ctx) => Promise<Response>} handler  Receives `ctx.user`.
 */
export function withAuth(scopes, handler) {
  if (!isAuth0Configured()) {
    return async function demoHandler(req, ctx = {}) {
      try {
        return await handler(req, { ...ctx, user: DEMO_SESSION_USER, accessToken: null });
      } catch (error) {
        return errorResponse(error);
      }
    };
  }

  const { withApiAuthRequired, getAccessToken, getSession } = require('@auth0/nextjs-auth0');

  return withApiAuthRequired(async function authedHandler(req, ctx = {}) {
    try {
      const { accessToken } = await getAccessToken(req, { scopes });
      const session = await getSession(req);
      return await handler(req, { ...ctx, user: session?.user, accessToken });
    } catch (error) {
      return errorResponse(error);
    }
  });
}

/** Consistent JSON error shape across every route. */
export function errorResponse(error) {
  const status = error?.status || error?.statusCode || 500;
  const message = error?.message || 'Unexpected server error';
  if (status >= 500) console.error('[api]', error);
  return NextResponse.json({ error: message }, { status });
}

/** Resolve the caller's ParceFlyte user document from the session. */
export async function currentUser(db, sessionUser) {
  if (!sessionUser) return null;
  if (sessionUser.isDemo) {
    return db.collection('users').findOne({ _id: DEMO_USER_ID });
  }
  return db.collection('users').findOne({ auth0Id: sessionUser.sub });
}
