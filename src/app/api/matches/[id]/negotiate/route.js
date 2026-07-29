import clientPromise from '@/lib/db';
import { getAccessToken, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';

export const POST = withApiAuthRequired(async function negotiateMatch(req, { params }) {
  try {
    const { accessToken } = await getAccessToken(req, {
      scopes: ['write:matches'],
    });

    const { id } = params;
    const body = await req.json();
    const client = await clientPromise;
    const db = client.db('parceflyte');

    // Validate required fields
    if (!body.proposedFee || !body.proposedBy) {
      return NextResponse.json({ error: 'Proposed fee and proposer are required' }, { status: 400 });
    }

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

    // Validate proposer is either sender or carrier
    if (body.proposedBy !== match.senderId && body.proposedBy !== match.carrierId) {
      return NextResponse.json({ error: 'Invalid proposer' }, { status: 400 });
    }

    // Get parcel details for validation
    const parcel = await db.collection('parcels').findOne({ _id: match.parcelId });
    if (!parcel) {
      return NextResponse.json({ error: 'Parcel not found' }, { status: 404 });
    }

    // Validate proposed fee
    const maxAcceptableFee = parcel.declaredValue * 0.15; // 15% of parcel value
    if (body.proposedFee > maxAcceptableFee) {
      return NextResponse.json({ 
        error: 'Proposed fee exceeds maximum acceptable fee',
        maxAcceptableFee 
      }, { status: 400 });
    }

    // Add negotiation history entry
    const negotiationEntry = {
      proposedBy: body.proposedBy,
      amount: body.proposedFee,
      message: body.message || '',
      timestamp: new Date(),
    };

    // Update match with new negotiation
    const updateData = {
      'negotiation.proposedFee': body.proposedFee,
      'negotiation.negotiationHistory': [
        ...(match.negotiation?.negotiationHistory || []),
        negotiationEntry
      ],
      updatedAt: new Date(),
    };

    const result = await db.collection('matches').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    // Get updated match
    const updatedMatch = await db.collection('matches').findOne({ _id: new ObjectId(id) });

    return NextResponse.json({
      message: 'Negotiation proposal added successfully',
      match: updatedMatch,
      negotiationEntry,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
});

export const GET = withApiAuthRequired(async function getNegotiationHistory(req, { params }) {
  try {
    const { accessToken } = await getAccessToken(req, {
      scopes: ['read:matches'],
    });

    const { id } = params;
    const client = await clientPromise;
    const db = client.db('parceflyte');

    const match = await db.collection('matches').findOne({ _id: new ObjectId(id) });
    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    return NextResponse.json({
      negotiation: match.negotiation,
      history: match.negotiation?.negotiationHistory || [],
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}); 