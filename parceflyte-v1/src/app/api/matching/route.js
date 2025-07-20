import { getAccessToken, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/db';
import matchingService from '@/lib/matching-service';

export const GET = withApiAuthRequired(async function getMatches(req) {
  try {
    const { accessToken } = await getAccessToken(req, {
      scopes: ['read:matches'],
    });

    const { searchParams } = new URL(req.url);
    const parcelId = searchParams.get('parcelId');
    const departureCity = searchParams.get('departureCity');
    const arrivalCity = searchParams.get('arrivalCity');
    const departureCountry = searchParams.get('departureCountry');
    const arrivalCountry = searchParams.get('arrivalCountry');
    const weight = searchParams.get('weight');
    const volume = searchParams.get('volume');
    const maxFee = searchParams.get('maxFee');
    const deliveryDeadline = searchParams.get('deliveryDeadline');
    const travelMode = searchParams.get('travelMode');
    const minRating = searchParams.get('minRating');
    const limit = parseInt(searchParams.get('limit')) || 20;
    const page = parseInt(searchParams.get('page')) || 1;
    const skip = (page - 1) * limit;

    let results = [];

    if (parcelId) {
      // Find matches for a specific parcel
      const options = {
        maxFee: maxFee ? parseFloat(maxFee) : undefined,
        minRating: minRating ? parseFloat(minRating) : undefined,
        travelMode,
        departureCountry,
        arrivalCountry,
        limit: 50, // Get more results for better matching
      };

      results = await matchingService.findMatchesForParcel(parcelId, options);
    } else {
      // Search for available travels based on criteria
      const criteria = {
        departureCity,
        arrivalCity,
        departureCountry,
        arrivalCountry,
        weight: weight ? parseFloat(weight) : undefined,
        volume: volume ? parseFloat(volume) : undefined,
        maxFee: maxFee ? parseFloat(maxFee) : undefined,
        deliveryDeadline,
        travelMode,
      };

      const options = {
        skip,
        limit,
      };

      results = await matchingService.findAvailableTravels(criteria, options);
    }

    // Apply pagination
    const total = results.length;
    const paginatedResults = results.slice(skip, skip + limit);

    return NextResponse.json({
      matches: paginatedResults,
      total,
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
    const requiredFields = ['parcelId', 'travelId', 'senderId', 'carrierId'];
    
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
      }
    }

    // Get parcel and travel details for validation
    const parcel = await db.collection('parcels').findOne({ _id: body.parcelId });
    const travel = await db.collection('travels').findOne({ _id: body.travelId });
    const carrier = await db.collection('users').findOne({ _id: body.carrierId });

    if (!parcel) {
      return NextResponse.json({ error: 'Parcel not found' }, { status: 404 });
    }
    if (!travel) {
      return NextResponse.json({ error: 'Travel not found' }, { status: 404 });
    }
    if (!carrier) {
      return NextResponse.json({ error: 'Carrier not found' }, { status: 404 });
    }

    // Calculate match score using the matching service
    const matchScore = matchingService.calculateMatchScore(parcel, travel, carrier);
    const matchDetails = matchingService.getMatchDetails(parcel, travel, carrier);
    const pricing = matchingService.suggestPricing(parcel, travel, carrier);

    // Check if there's already a match for this parcel and travel
    const existingMatch = await db.collection('matches').findOne({
      parcelId: body.parcelId,
      travelId: body.travelId,
      status: { $in: ['proposed', 'accepted'] }
    });
    if (existingMatch) {
      return NextResponse.json({ error: 'Match already exists for this parcel and travel' }, { status: 409 });
    }

    // Set expiration date (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Create new match with enhanced data
    const newMatch = {
      ...body,
      status: 'proposed',
      matchScore,
      matchDetails,
      pricing,
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