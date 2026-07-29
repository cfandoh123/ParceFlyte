import { getDb, toId, idString } from '@/lib/db';
import { withAuth, currentUser } from '@/lib/auth';
import { ok, notFound, forbidden, badRequest } from '@/lib/api';
import { hydrateMatches } from '@/lib/matches';

export const GET = withAuth(['read:matches'], async (req, { params }) => {
  const db = await getDb();
  const match = await db.collection('matches').findOne({ _id: toId(params.id) });
  if (!match) return notFound('Match not found');

  const [hydrated] = await hydrateMatches(db, [match]);
  return ok({ match: hydrated });
});

export const PUT = withAuth(['write:matches'], async (req, { params, user }) => {
  const db = await getDb();
  const match = await db.collection('matches').findOne({ _id: toId(params.id) });
  if (!match) return notFound('Match not found');

  const profile = await currentUser(db, user);
  const isParty =
    idString(match.senderId) === idString(profile?._id) ||
    idString(match.carrierId) === idString(profile?._id);
  if (!isParty) return forbidden('Only the sender or carrier can edit this match');

  const body = await req.json();
  // Status transitions go through /accept, /reject and /negotiate so their
  // side effects (capacity, payments, tracking) always run.
  const editable = ['agreement', 'messages'];
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

export const DELETE = withAuth(['write:matches'], async (req, { params, user }) => {
  const db = await getDb();
  const match = await db.collection('matches').findOne({ _id: toId(params.id) });
  if (!match) return notFound('Match not found');

  const profile = await currentUser(db, user);
  const isParty =
    idString(match.senderId) === idString(profile?._id) ||
    idString(match.carrierId) === idString(profile?._id);
  if (!isParty) return forbidden('Only the sender or carrier can cancel this match');

  if (match.status === 'accepted') {
    return badRequest('Accepted matches cannot be cancelled here — open a dispute instead');
  }

  await db.collection('matches').updateOne(
    { _id: match._id },
    { $set: { status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() } }
  );

  return ok({ message: 'Match cancelled' });
});
