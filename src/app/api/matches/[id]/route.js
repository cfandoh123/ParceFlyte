import { getDb, toId, idString } from '@/lib/db';
import { withAuth, isAdmin } from '@/lib/auth';
import { ok, notFound, forbidden, badRequest } from '@/lib/api';
import { hydrateMatches } from '@/lib/matches';

/** A match is between two people; only they and admins may see or change it. */
function isParty(match, profile) {
  const me = idString(profile._id);
  return idString(match.senderId) === me || idString(match.carrierId) === me;
}

export const GET = withAuth(async (req, { params, profile }) => {
  const db = await getDb();
  const match = await db.collection('matches').findOne({ _id: toId(params.id) });
  if (!match) return notFound('Match not found');
  if (!isParty(match, profile) && !isAdmin(profile)) return forbidden('You are not a party to this match');

  const [hydrated] = await hydrateMatches(db, [match]);
  return ok({ match: hydrated });
});

export const PUT = withAuth(async (req, { params, profile }) => {
  const db = await getDb();
  const match = await db.collection('matches').findOne({ _id: toId(params.id) });
  if (!match) return notFound('Match not found');

  if (!isParty(match, profile)) return forbidden('Only the sender or carrier can edit this match');
  // Once accepted, the agreement is what both sides signed up to.
  if (match.status !== 'proposed') {
    return badRequest(`This match is ${match.status} and its agreement can no longer be changed`);
  }

  const body = await req.json();
  // Status transitions go through /accept, /reject and /negotiate so their
  // side effects (capacity, payments, tracking) always run.
  const editable = ['agreement'];
  const updates = Object.fromEntries(Object.entries(body).filter(([key]) => editable.includes(key)));
  if (!Object.keys(updates).length) {
    return badRequest('Only agreement details are editable here — use /accept, /reject or /negotiate to change status');
  }

  await db.collection('matches').updateOne(
    { _id: match._id },
    { $set: { ...updates, updatedAt: new Date() } }
  );

  const updated = await db.collection('matches').findOne({ _id: match._id });
  const [hydrated] = await hydrateMatches(db, [updated]);
  return ok({ message: 'Match updated', match: hydrated });
});

export const DELETE = withAuth(async (req, { params, profile }) => {
  const db = await getDb();
  const match = await db.collection('matches').findOne({ _id: toId(params.id) });
  if (!match) return notFound('Match not found');

  if (!isParty(match, profile)) return forbidden('Only the sender or carrier can cancel this match');

  if (match.status === 'accepted') {
    return badRequest('Accepted matches cannot be cancelled here — open a dispute instead');
  }

  await db.collection('matches').updateOne(
    { _id: match._id },
    { $set: { status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() } }
  );

  return ok({ message: 'Match cancelled' });
});
