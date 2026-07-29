import clientPromise from '@/lib/db';
import { getAccessToken, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';

export const GET = withApiAuthRequired(async function getMatch(req, { params }) {
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

    return NextResponse.json(match);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
});

export const PUT = withApiAuthRequired(async function updateMatch(req, { params }) {
  try {
    const { accessToken } = await getAccessToken(req, {
      scopes: ['write:matches'],
    });

    const { id } = params;
    const body = await req.json();
    const client = await clientPromise;
    const db = client.db('parceflyte');

    const match = await db.collection('matches').findOne({ _id: new ObjectId(id) });
    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    // Update match
    const updateData = {
      ...body,
      updatedAt: new Date(),
    };

    // Remove fields that shouldn't be updated
    delete updateData._id;
    delete updateData.createdAt;

    const result = await db.collection('matches').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    // Get updated match
    const updatedMatch = await db.collection('matches').findOne({ _id: new ObjectId(id) });
    return NextResponse.json(updatedMatch);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
});

export const DELETE = withApiAuthRequired(async function deleteMatch(req, { params }) {
  try {
    const { accessToken } = await getAccessToken(req, {
      scopes: ['write:matches'],
    });

    const { id } = params;
    const client = await clientPromise;
    const db = client.db('parceflyte');

    const match = await db.collection('matches').findOne({ _id: new ObjectId(id) });
    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    // Soft delete - mark as cancelled
    const result = await db.collection('matches').updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'cancelled', updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Match cancelled successfully' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}); 