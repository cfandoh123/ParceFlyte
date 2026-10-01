/**
 * Authentication for API routes.
 *
 * Routes call `withAuth(handler)` (or `withAdmin(handler)`) rather than talking
 * to Auth0 directly. With Auth0 configured, the caller is the signed-in Auth0
 * user, and their ParceFlyte profile is created on first sign-in. Without it,
 * and only while the app is on the in-memory demo data, the request is served
 * as a fixed demo user so the whole app is explorable with no setup.
 *
 * Authorization is by ownership and role, checked in each route against the
 * profile in the database — never against anything the client sends.
 */

import { NextResponse } from 'next/server';
import { getDb, isDemoMode, toId } from './db';
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

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/**
 * The demo user stands in for a real sign-in only when nothing real is at
 * stake: on the in-memory dataset, or on a developer's machine. A production
 * deployment with a real database and no Auth0 must not hand every visitor an
 * admin account.
 */
function demoSessionAllowed() {
  return isDemoMode() || process.env.NODE_ENV !== 'production';
}

/** Emails listed in ADMIN_EMAILS are granted the admin role when they sign in. */
function adminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

const AVATAR_COLORS = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#059669', '#0891b2', '#4f46e5', '#b45309'];

function avatarColorFor(key) {
  let hash = 0;
  for (const char of String(key)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** Best available first/last name from the identity provider's claims. */
function namesFromClaims(claims) {
  if (claims.given_name || claims.family_name) {
    return { firstName: claims.given_name || '', lastName: claims.family_name || '' };
  }
  // Auth0 sets `name` to the email address for database signups — not a name.
  const name = claims.name && !claims.name.includes('@') ? claims.name : claims.nickname || '';
  const [firstName = '', ...rest] = name.trim().split(/\s+/);
  return { firstName: firstName || (claims.email || 'New').split('@')[0], lastName: rest.join(' ') };
}

/**
 * Find the profile for an Auth0 identity, creating it on first sign-in.
 *
 * A verified email that matches an existing profile links to it instead, so
 * signing in with a second method (say Google after email) lands in the same
 * account. Unverified emails never link — that would be an account takeover.
 */
async function findOrCreateProfile(db, claims) {
  const users = db.collection('users');
  const email = claims.email ? String(claims.email).toLowerCase() : null;
  const verified = Boolean(email && claims.email_verified);
  const now = new Date();

  let profile = await users.findOne({ auth0Id: claims.sub });

  if (!profile && verified) {
    const byEmail = await users.findOne({ email });
    if (byEmail) {
      await users.updateOne({ _id: byEmail._id }, { $set: { auth0Id: claims.sub, updatedAt: now } });
      profile = { ...byEmail, auth0Id: claims.sub };
    }
  }

  if (!profile) {
    const { firstName, lastName } = namesFromClaims(claims);
    const newUser = {
      auth0Id: claims.sub,
      email,
      firstName,
      lastName,
      phoneNumber: null,
      dateOfBirth: null,
      avatarColor: avatarColorFor(claims.sub),
      address: {},
      kycStatus: 'pending',
      kycDocuments: [],
      roles: ['sender', 'carrier'],
      rating: { average: 0, totalReviews: 0, completedDeliveries: 0, successfulDeliveries: 0 },
      paymentMethods: [],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    try {
      const result = await users.insertOne(newUser);
      profile = await users.findOne({ _id: toId(result.insertedId) });
    } catch (error) {
      // Two first requests raced; the unique index on auth0Id let one through.
      if (error?.code !== 11000) throw error;
      profile = await users.findOne({ auth0Id: claims.sub });
      // Otherwise the email belongs to another account, and without a verified
      // email there is no proof this is the same person.
      if (!profile) {
        throw httpError(
          409,
          'This email is already registered with a different sign-in method. Verify your email, then sign in again.'
        );
      }
    }
  }

  if (profile && verified && adminEmails().includes(email) && !profile.roles?.includes('admin')) {
    const roles = [...(profile.roles || []), 'admin'];
    await users.updateOne({ _id: profile._id }, { $set: { roles, updatedAt: now } });
    profile = { ...profile, roles };
  }

  return profile;
}

/**
 * Who is making this request?
 *
 * Resolves to `{ user, profile }` — the session claims and the ParceFlyte
 * profile — or `null` when nobody is signed in. Throws a 503 when sign-in is
 * required but has not been configured.
 */
export async function getAuthContext() {
  const db = await getDb();

  if (!isAuth0Configured()) {
    if (!demoSessionAllowed()) {
      throw httpError(503, 'Sign-in is not configured for this deployment');
    }
    const profile = await db.collection('users').findOne({ _id: toId(DEMO_USER_ID) });
    return { user: DEMO_SESSION_USER, profile };
  }

  const { getSession } = require('@auth0/nextjs-auth0');
  const session = await getSession();
  if (!session?.user) return null;

  const profile = await findOrCreateProfile(db, session.user);
  return { user: session.user, profile };
}

function wrap(handler, { adminOnly = false } = {}) {
  return async function authedHandler(req, ctx = {}) {
    try {
      const auth = await getAuthContext();
      if (!auth) throw httpError(401, 'Sign in to continue');
      if (!auth.profile) throw httpError(401, 'No ParceFlyte profile exists for this session');
      if (auth.profile.isActive === false) throw httpError(403, 'This account has been deactivated');
      if (adminOnly && !isAdmin(auth.profile)) throw httpError(403, 'Administrators only');

      return await handler(req, { ...ctx, user: auth.user, profile: auth.profile });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

/**
 * Wrap a route handler so it only runs for a signed-in user.
 *
 * @param {(req, ctx) => Promise<Response>} handler  Receives `ctx.user` (session
 *   claims) and `ctx.profile` (the caller's ParceFlyte user document).
 */
export function withAuth(handler) {
  return wrap(handler);
}

/** Like `withAuth`, but the caller must also hold the admin role. */
export function withAdmin(handler) {
  return wrap(handler, { adminOnly: true });
}

export function isAdmin(profile) {
  return Boolean(profile?.roles?.includes('admin'));
}

/**
 * Narrow a list query to documents the caller is a party to — `fields` are the
 * id fields that make someone a party. Admins see everything.
 */
export function restrictToParty(query, profile, fields) {
  if (isAdmin(profile)) return query;
  return { $and: [query, { $or: fields.map((field) => ({ [field]: profile._id })) }] };
}

/** Consistent JSON error shape across every route. */
export function errorResponse(error) {
  const status = error?.status || error?.statusCode || 500;
  const message = error?.message || 'Unexpected server error';
  if (status >= 500) console.error('[api]', error);
  return NextResponse.json({ error: message }, { status });
}

/**
 * The fields of a user that other users may see. Contact details, address and
 * identity documents stay private to the account holder and admins.
 */
export function publicUser(user) {
  if (!user) return null;
  return {
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarColor: user.avatarColor,
    kycStatus: user.kycStatus,
    rating: user.rating,
    createdAt: user.createdAt,
  };
}
