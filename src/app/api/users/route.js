import clientPromise from '@/lib/db';
import { getAccessToken, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { NextResponse } from 'next/server';
import { User } from '@/models';

export const GET = withApiAuthRequired(async function getUsers(req) {
  try {
    const { accessToken } = await getAccessToken(req, {
      scopes: ['read:users'],
    });

    const client = await clientPromise;
    const db = client.db('parceflyte');
    
    // Get query parameters
    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role');
    const kycStatus = searchParams.get('kycStatus');
    const limit = parseInt(searchParams.get('limit')) || 20;
    const page = parseInt(searchParams.get('page')) || 1;
    const skip = (page - 1) * limit;

    // Build query
    const query = {};
    if (role) query.roles = role;
    if (kycStatus) query.kycStatus = kycStatus;

    const users = await db.collection('users')
      .find(query)
      .sort({ 'rating.average': -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await db.collection('users').countDocuments(query);

    return NextResponse.json({
      users,
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

export const POST = withApiAuthRequired(async function createUser(req) {
  try {
    const { accessToken } = await getAccessToken(req, {
      scopes: ['write:users'],
    });

    const body = await req.json();
    const client = await clientPromise;
    const db = client.db('parceflyte');

    // Validate required fields
    const requiredFields = ['auth0Id', 'email', 'firstName', 'lastName', 'phoneNumber', 'dateOfBirth'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
      }
    }

    // Check if user already exists
    const existingUser = await db.collection('users').findOne({ auth0Id: body.auth0Id });
    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 409 });
    }

    // Create new user
    const newUser = {
      ...body,
      roles: body.roles || ['sender'],
      kycStatus: 'pending',
      isActive: true,
      isVerified: false,
      rating: {
        average: 0,
        totalReviews: 0,
        completedDeliveries: 0,
        successfulDeliveries: 0,
      },
      notifications: {
        email: true,
        push: true,
        sms: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('users').insertOne(newUser);
    newUser._id = result.insertedId;

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}); 