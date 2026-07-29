import { getDb, toId, idString } from '@/lib/db';
import { withAuth, currentUser } from '@/lib/auth';
import { ok, notFound, forbidden, badRequest } from '@/lib/api';
import { hydrateMatches } from '@/lib/matches';

export const POST = withAuth(['write:matches'], async (req, { params, user }) => {
  const db = await getDb();
  const match = await db.collection('matches').findOne({ _id: toId(params.id) });
  if (!match) return notFound('Match not found');

  if (match.status !== 'proposed') {
    return badRequest(`This match is already ${match.status}`);
  }

  const profile = await currentUser(db, user);
  const isSender = idString(match.senderId) === idString(profile?._id);
  const isCarrier = idString(match.carrierId) === idString(profile?._id);
  if (!isSender && !isCarrier) return forbidden('Only the sender or carrier can reject this match');

  const body = await req.json().catch(() => ({}));
  const now = new Date();

  await db.collection('matches').updateOne(
    { _id: match._id },
    {
      $set: {
        status: 'rejected',
        rejectedAt: now,
        rejectedBy: profile?._id,
        rejectedByRole: isSender ? 'sender' : 'carrier',
        rejectionReason: body.reason || '',
        updatedAt: now,
      },
    }
  );

  const updated = await db.collection('matches').findOne({ _id: match._id });
  const [hydrated] = await hydrateMatches(db, [updated]);

  return ok({ message: 'Match rejected', match: hydrated });
});
