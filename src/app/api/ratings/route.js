import { getDb, toId, idString } from '@/lib/db';
import { withAuth, currentUser } from '@/lib/auth';
import { ok, badRequest, notFound, conflict, forbidden, pagination, paginated, requireFields } from '@/lib/api';

const RATING_TYPES = ['sender_to_carrier', 'carrier_to_sender'];

/** Recompute a user's aggregate rating from their published reviews. */
async function recomputeUserRating(db, userId) {
  const reviews = await db
    .collection('ratings')
    .find({ reviewedId: toId(userId), status: 'published' })
    .toArray();

  const user = await db.collection('users').findOne({ _id: toId(userId) });
  if (!user) return;

  const totalReviews = reviews.length;
  const average = totalReviews
    ? Math.round((reviews.reduce((sum, r) => sum + r.score, 0) / totalReviews) * 10) / 10
    : 0;

  await db.collection('users').updateOne(
    { _id: user._id },
    {
      $set: {
        'rating.average': average,
        'rating.totalReviews': totalReviews,
        updatedAt: new Date(),
      },
    }
  );
}

export const GET = withAuth(['read:ratings'], async (req) => {
  const db = await getDb();
  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = pagination(searchParams);
  const get = (key) => searchParams.get(key);

  const query = { status: get('status') || 'published' };
  if (get('parcelId')) query.parcelId = toId(get('parcelId'));
  if (get('reviewerId')) query.reviewerId = toId(get('reviewerId'));
  if (get('reviewedId')) query.reviewedId = toId(get('reviewedId'));
  if (get('ratingType')) query.ratingType = get('ratingType');
  if (get('minRating') || get('maxRating')) {
    query.score = {};
    if (get('minRating')) query.score.$gte = parseFloat(get('minRating'));
    if (get('maxRating')) query.score.$lte = parseFloat(get('maxRating'));
  }

  const [ratings, total] = await Promise.all([
    db.collection('ratings').find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    db.collection('ratings').countDocuments(query),
  ]);

  // Attach reviewer identity so the UI can show who wrote each review.
  const reviewerIds = [...new Set(ratings.map((r) => String(r.reviewerId)))];
  const reviewers = reviewerIds.length
    ? await db.collection('users').find({ _id: { $in: reviewerIds.map(toId) } }).toArray()
    : [];
  const reviewerMap = Object.fromEntries(
    reviewers.map((u) => [
      String(u._id),
      { _id: u._id, firstName: u.firstName, lastName: u.lastName, avatarColor: u.avatarColor },
    ])
  );

  const withReviewer = ratings.map((r) => ({ ...r, reviewer: reviewerMap[String(r.reviewerId)] || null }));
  return ok(paginated(withReviewer, total, { page, limit }));
});

export const POST = withAuth(['write:ratings'], async (req, { user }) => {
  const db = await getDb();
  const body = await req.json();

  const missing = requireFields(body, ['parcelId', 'score']);
  if (missing) return missing;

  const score = Number(body.score);
  if (!Number.isFinite(score) || score < 1 || score > 5) {
    return badRequest('score must be a number between 1 and 5');
  }

  const parcel = await db.collection('parcels').findOne({ _id: toId(body.parcelId) });
  if (!parcel) return notFound('Parcel not found');
  if (parcel.status !== 'delivered') {
    return badRequest('You can only review a delivery once the parcel has been delivered');
  }

  const profile = await currentUser(db, user);
  const isSender = idString(parcel.senderId) === idString(profile?._id);
  const isCarrier = idString(parcel.matchedCarrierId) === idString(profile?._id);
  if (!isSender && !isCarrier) return forbidden('Only the sender or carrier can review this delivery');

  const ratingType = isSender ? 'sender_to_carrier' : 'carrier_to_sender';
  if (body.ratingType && !RATING_TYPES.includes(body.ratingType)) {
    return badRequest(`ratingType must be one of: ${RATING_TYPES.join(', ')}`);
  }

  const reviewedId = isSender ? parcel.matchedCarrierId : parcel.senderId;
  if (!reviewedId) return badRequest('This parcel has no counterparty to review');

  const existing = await db.collection('ratings').findOne({
    parcelId: parcel._id,
    reviewerId: profile._id,
    ratingType,
  });
  if (existing) return conflict('You have already reviewed this delivery');

  const now = new Date();
  const result = await db.collection('ratings').insertOne({
    parcelId: parcel._id,
    reviewerId: profile._id,
    reviewedId,
    ratingType,
    score,
    review: body.review || '',
    status: 'published',
    flags: [],
    helpfulness: [],
    createdAt: now,
    updatedAt: now,
  });

  await recomputeUserRating(db, reviewedId);

  const rating = await db.collection('ratings').findOne({ _id: toId(result.insertedId) });
  return ok({ message: 'Review published', rating }, { status: 201 });
});
