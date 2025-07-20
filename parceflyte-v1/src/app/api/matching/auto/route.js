import { getAccessToken, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/db';
import matchingService from '@/lib/matching-service';

export const POST = withApiAuthRequired(async function autoMatch(req) {
  try {
    const { accessToken } = await getAccessToken(req, {
      scopes: ['write:matches'],
    });

    const body = await req.json();
    const { parcelId, criteria = {} } = body;

    if (!parcelId) {
      return NextResponse.json({ error: 'Parcel ID is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('parceflyte');

    // Get parcel details
    const parcel = await db.collection('parcels').findOne({ _id: parcelId });
    if (!parcel) {
      return NextResponse.json({ error: 'Parcel not found' }, { status: 404 });
    }

    if (parcel.status !== 'pending') {
      return NextResponse.json({ error: 'Parcel is not available for matching' }, { status: 400 });
    }

    // Find high-quality matches using the matching service
    const matches = await matchingService.autoMatchParcel(parcelId, criteria);

    // Create match proposals for high-quality matches
    const createdMatches = [];
    for (const match of matches) {
      const pricing = matchingService.suggestPricing(parcel, match.travel, match.carrier);
      
      // Set expiration date (24 hours from now)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const newMatch = {
        parcelId,
        travelId: match.travel._id,
        senderId: parcel.senderId,
        carrierId: match.carrier._id,
        status: 'proposed',
        matchScore: match.matchScore,
        matchDetails: match.matchDetails,
        pricing,
        expiresAt,
        proposedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Check if match already exists
      const existingMatch = await db.collection('matches').findOne({
        parcelId,
        travelId: match.travel._id,
        status: { $in: ['proposed', 'accepted'] }
      });

      if (!existingMatch) {
        const result = await db.collection('matches').insertOne(newMatch);
        newMatch._id = result.insertedId;
        createdMatches.push(newMatch);
      }
    }

    return NextResponse.json({
      message: `Created ${createdMatches.length} match proposals`,
      matches: createdMatches,
      totalMatches: matches.length,
      createdMatches: createdMatches.length,
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
});

export const GET = withApiAuthRequired(async function getAutoMatchSuggestions(req) {
  try {
    const { accessToken } = await getAccessToken(req, {
      scopes: ['read:matches'],
    });

    const { searchParams } = new URL(req.url);
    const parcelId = searchParams.get('parcelId');
    const limit = parseInt(searchParams.get('limit')) || 5;

    if (!parcelId) {
      return NextResponse.json({ error: 'Parcel ID is required' }, { status: 400 });
    }

    // Get auto-match suggestions
    const suggestions = await matchingService.autoMatchParcel(parcelId, { limit });

    return NextResponse.json({
      suggestions,
      total: suggestions.length,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}); 