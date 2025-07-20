import clientPromise from '@/lib/db';
import { getAccessToken, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';

export const POST = withApiAuthRequired(async function rejectMatch(req, { params }) {
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

    // Update match status to rejected
    const updateData = {
      status: 'rejected',
      rejectedAt: new Date(),
      updatedAt: new Date(),
    };

    // Add rejection reason if provided
    if (body.reason) {
      updateData.rejectionReason = body.reason;
    }

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
      message: 'Match rejected successfully',
      match: updatedMatch,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}); 