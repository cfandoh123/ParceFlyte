import clientPromise from '@/lib/db';
import { getAccessToken, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { NextResponse } from 'next/server';

export const GET = withApiAuthRequired(async function getMatches(req) {
  try {
    const { accessToken } = await getAccessToken(req, {
      scopes: ['read:matches'],
    });

    const client = await clientPromise;
    const db = client.db('parceflyte');
    
    // Get query parameters
    const { searchParams } = new URL(req.url);
    const parcelId = searchParams.get('parcelId');
    const travelId = searchParams.get('travelId');
    const senderId = searchParams.get('senderId');
    const carrierId = searchParams.get('carrierId');
    const status = searchParams.get('status');
    const minScore = searchParams.get('minScore');
    const maxFee = searchParams.get('maxFee');
    const limit = parseInt(searchParams.get('limit')) || 20;
    const page = parseInt(searchParams.get('page')) || 1;
    const skip = (page - 1) * limit;

    // Build query
    const query = {};
    if (parcelId) query.parcelId = parcelId;
    if (travelId) query.travelId = travelId;
    if (senderId) query.senderId = senderId;
    if (carrierId) query.carrierId = carrierId;
    if (status) query.status = status;
    if (minScore) query.matchScore = { $gte: parseFloat(minScore) };
    if (maxFee) query['negotiation.finalFee'] = { $lte: parseFloat(maxFee) };

    const matches = await db.collection('matches')
      .find(query)
      .sort({ matchScore: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await db.collection('matches').countDocuments(query);

    return NextResponse.json({
      matches,
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

export const POST = withApiAuthRequired(async function createMatch(req) {
  try {
    const { accessToken } = await getAccessToken(req, {
      scopes: ['write:matches'],
    });

    const body = await req.json();
    const client = await clientPromise;
    const db = client.db('parceflyte');

    // Validate required fields
    const requiredFields = ['parcelId', 'travelId', 'senderId', 'carrierId', 'negotiation'];
    
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
      }
    }

    // Check if parcel exists and is available
    const parcel = await db.collection('parcels').findOne({ _id: body.parcelId });
    if (!parcel) {
      return NextResponse.json({ error: 'Parcel not found' }, { status: 404 });
    }
    if (parcel.status !== 'pending') {
      return NextResponse.json({ error: 'Parcel is not available for matching' }, { status: 400 });
    }

    // Check if travel exists and is available
    const travel = await db.collection('travels').findOne({ _id: body.travelId });
    if (!travel) {
      return NextResponse.json({ error: 'Travel not found' }, { status: 404 });
    }
    if (travel.status !== 'planned' && travel.status !== 'confirmed') {
      return NextResponse.json({ error: 'Travel is not available for matching' }, { status: 400 });
    }

    // Check if there's already a match for this parcel and travel
    const existingMatch = await db.collection('matches').findOne({
      parcelId: body.parcelId,
      travelId: body.travelId,
      status: { $in: ['proposed', 'accepted'] }
    });
    if (existingMatch) {
      return NextResponse.json({ error: 'Match already exists for this parcel and travel' }, { status: 409 });
    }

    // Calculate match score based on various factors
    const matchScore = calculateMatchScore(parcel, travel);

    // Set expiration date (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Create new match
    const newMatch = {
      ...body,
      status: 'proposed',
      matchScore,
      expiresAt,
      proposedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('matches').insertOne(newMatch);
    newMatch._id = result.insertedId;

    return NextResponse.json(newMatch, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
});

// Helper function to calculate match score
function calculateMatchScore(parcel, travel) {
  let score = 0;
  
  // Route match (40 points)
  const departureMatch = parcel.recipient.address?.city === travel.departureLocation.city &&
                        parcel.recipient.address?.country === travel.departureLocation.country;
  const arrivalMatch = parcel.recipient.address?.city === travel.arrivalLocation.city &&
                      parcel.recipient.address?.country === travel.arrivalLocation.country;
  
  if (departureMatch) score += 20;
  if (arrivalMatch) score += 20;
  
  // Capacity match (30 points)
  const weightCapacity = travel.availableCapacity.weight >= parcel.weight;
  const volumeCapacity = travel.availableCapacity.volume >= parcel.volume;
  
  if (weightCapacity) score += 15;
  if (volumeCapacity) score += 15;
  
  // Timing match (20 points)
  const deliveryDeadline = new Date(parcel.deliveryDeadline);
  const travelArrival = new Date(travel.arrivalDate);
  
  if (deliveryDeadline >= travelArrival) score += 20;
  
  // Price match (10 points)
  const baseFee = travel.baseDeliveryFee;
  const maxFee = parcel.declaredValue * 0.1; // 10% of parcel value as max fee
  
  if (baseFee <= maxFee) score += 10;
  
  return Math.min(score, 100);
} 