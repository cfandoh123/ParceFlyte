import clientPromise from '@/lib/db';
import { getAccessToken, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { NextResponse } from 'next/server';

export const GET = withApiAuthRequired(async function getRatings(req) {
  try {
    const { accessToken } = await getAccessToken(req, {
      scopes: ['read:ratings'],
    });

    const client = await clientPromise;
    const db = client.db('parceflyte');
    
    // Get query parameters
    const { searchParams } = new URL(req.url);
    const parcelId = searchParams.get('parcelId');
    const reviewerId = searchParams.get('reviewerId');
    const reviewedId = searchParams.get('reviewedId');
    const ratingType = searchParams.get('ratingType');
    const status = searchParams.get('status');
    const minRating = searchParams.get('minRating');
    const maxRating = searchParams.get('maxRating');
    const limit = parseInt(searchParams.get('limit')) || 20;
    const page = parseInt(searchParams.get('page')) || 1;
    const skip = (page - 1) * limit;

    // Build query
    const query = {};
    if (parcelId) query.parcelId = parcelId;
    if (reviewerId) query.reviewerId = reviewerId;
    if (reviewedId) query.reviewedId = reviewedId;
    if (ratingType) query.ratingType = ratingType;
    if (status) query.status = status;
    if (minRating) query.overallRating = { $gte: parseFloat(minRating) };
    if (maxRating) {
      if (query.overallRating) {
        query.overallRating.$lte = parseFloat(maxRating);
      } else {
        query.overallRating = { $lte: parseFloat(maxRating) };
      }
    }

    const ratings = await db.collection('ratings')
      .find(query)
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await db.collection('ratings').countDocuments(query);

    return NextResponse.json({
      ratings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
});

export const POST = withApiAuthRequired(async function createRating(req) {
  try {
    const { accessToken } = await getAccessToken(req, {
      scopes: ['write:ratings'],
    });

    const body = await req.json();
    const client = await clientPromise;
    const db = client.db('parceflyte');

    // Validate required fields
    const requiredFields = ['parcelId', 'reviewerId', 'reviewedId', 'overallRating', 'review'];
    
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
      }
    }

    // Validate rating range
    if (body.overallRating < 1 || body.overallRating > 5) {
      return NextResponse.json({ error: 'Overall rating must be between 1 and 5' }, { status: 400 });
    }

    // Check if parcel exists and is delivered
    const parcel = await db.collection('parcels').findOne({ _id: body.parcelId });
    if (!parcel) {
      return NextResponse.json({ error: 'Parcel not found' }, { status: 404 });
    }
    if (parcel.status !== 'delivered') {
      return NextResponse.json({ error: 'Can only rate delivered parcels' }, { status: 400 });
    }

    // Check if user has already rated this parcel
    const existingRating = await db.collection('ratings').findOne({
      parcelId: body.parcelId,
      reviewerId: body.reviewerId,
      ratingType: body.ratingType
    });
    if (existingRating) {
      return NextResponse.json({ error: 'You have already rated this parcel' }, { status: 409 });
    }

    // Generate unique rating ID
    const ratingId = `RATE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create new rating
    const newRating = {
      ratingId,
      ...body,
      status: 'published',
      moderation: {
        isFlagged: false,
      },
      helpfulVotes: {
        helpful: 0,
        notHelpful: 0,
        voters: [],
      },
      publishedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('ratings').insertOne(newRating);
    newRating._id = result.insertedId;

    // Update user's average rating
    await updateUserRating(db, body.reviewedId);

    return NextResponse.json(newRating, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
});

// Helper function to update user's average rating
async function updateUserRating(db, userId) {
  const ratings = await db.collection('ratings')
    .find({ 
      reviewedId: userId, 
      status: 'published',
      'moderation.isFlagged': false 
    })
    .toArray();

  if (ratings.length > 0) {
    const totalRating = ratings.reduce((sum, rating) => sum + rating.overallRating, 0);
    const averageRating = totalRating / ratings.length;

    await db.collection('users').updateOne(
      { _id: userId },
      { 
        $set: { 
          'rating.average': averageRating,
          'rating.totalReviews': ratings.length,
          updatedAt: new Date()
        }
      }
    );
  }
} 