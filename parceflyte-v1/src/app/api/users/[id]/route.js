import clientPromise from '@/lib/db';
import { getAccessToken, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';

export const GET = withApiAuthRequired(async function getUser(req, { params }) {
  try {
    const { accessToken } = await getAccessToken(req, {
      scopes: ['read:users'],
    });

    const { id } = params;
    const client = await clientPromise;
    const db = client.db('parceflyte');

    // Try to find user by ObjectId first, then by auth0Id
    let user;
    if (ObjectId.isValid(id)) {
      user = await db.collection('users').findOne({ _id: new ObjectId(id) });
    } else {
      user = await db.collection('users').findOne({ auth0Id: id });
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
});

export const PUT = withApiAuthRequired(async function updateUser(req, { params }) {
  try {
    const { accessToken } = await getAccessToken(req, {
      scopes: ['write:users'],
    });

    const { id } = params;
    const body = await req.json();
    const client = await clientPromise;
    const db = client.db('parceflyte');

    // Find user
    let user;
    if (ObjectId.isValid(id)) {
      user = await db.collection('users').findOne({ _id: new ObjectId(id) });
    } else {
      user = await db.collection('users').findOne({ auth0Id: id });
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update user
    const updateData = {
      ...body,
      updatedAt: new Date(),
    };

    // Remove fields that shouldn't be updated
    delete updateData._id;
    delete updateData.auth0Id;
    delete updateData.createdAt;

    const result = await db.collection('users').updateOne(
      { _id: user._id },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get updated user
    const updatedUser = await db.collection('users').findOne({ _id: user._id });
    return NextResponse.json(updatedUser);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
});

export const DELETE = withApiAuthRequired(async function deleteUser(req, { params }) {
  try {
    const { accessToken } = await getAccessToken(req, {
      scopes: ['write:users'],
    });

    const { id } = params;
    const client = await clientPromise;
    const db = client.db('parceflyte');

    // Find user
    let user;
    if (ObjectId.isValid(id)) {
      user = await db.collection('users').findOne({ _id: new ObjectId(id) });
    } else {
      user = await db.collection('users').findOne({ auth0Id: id });
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Soft delete - mark as inactive instead of actually deleting
    const result = await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { isActive: false, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'User deactivated successfully' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}); 