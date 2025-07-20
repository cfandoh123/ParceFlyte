import clientPromise from '@/lib/db';
import { getAccessToken, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';

export const POST = withApiAuthRequired(async function acceptMatch(req, { params }) {
  try {
    const { accessToken } = await getAccessToken(req, {
      scopes: ['write:matches'],
    });

    const { id } = params;
    const body = await req.json();
    const client = await clientPromise;
    const db = client.db('parceflyte');

    // Get match details
    const match = await db.collection('matches').findOne({ _id: new ObjectId(id) });
    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    if (match.status !== 'proposed') {
      return NextResponse.json({ error: 'Match is not in proposed status' }, { status: 400 });
    }

    // Check if match has expired
    if (new Date() > new Date(match.expiresAt)) {
      return NextResponse.json({ error: 'Match has expired' }, { status: 400 });
    }

    // Update match status to accepted
    const updateData = {
      status: 'accepted',
      acceptedAt: new Date(),
      updatedAt: new Date(),
    };

    // Add negotiation details if provided
    if (body.negotiation) {
      updateData.negotiation = {
        ...match.negotiation,
        ...body.negotiation,
        finalFee: body.negotiation.finalFee || match.negotiation.finalFee || match.negotiation.initialFee,
      };
    }

    // Add agreement details if provided
    if (body.agreement) {
      updateData.agreement = {
        ...match.agreement,
        ...body.agreement,
      };
    }

    const result = await db.collection('matches').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    // Update parcel status to matched
    await db.collection('parcels').updateOne(
      { _id: match.parcelId },
      { 
        $set: { 
          status: 'matched',
          matchedCarrierId: match.carrierId,
          matchedTravelId: match.travelId,
          updatedAt: new Date()
        }
      }
    );

    // Update travel capacity
    const parcel = await db.collection('parcels').findOne({ _id: match.parcelId });
    if (parcel) {
      await db.collection('travels').updateOne(
        { _id: match.travelId },
        { 
          $inc: { 
            totalParcels: 1,
            totalWeight: parcel.weight,
            totalValue: parcel.declaredValue,
          },
          $set: { updatedAt: new Date() }
        }
      );
    }

    // Get updated match
    const updatedMatch = await db.collection('matches').findOne({ _id: new ObjectId(id) });

    return NextResponse.json({
      message: 'Match accepted successfully',
      match: updatedMatch,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}); 