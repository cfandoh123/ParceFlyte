import clientPromise from '@/lib/db';
import { getAccessToken, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { NextResponse } from 'next/server';

export const GET = withApiAuthRequired(async function getParcels(req) {
  try {
    const { accessToken } = await getAccessToken(req, {
      scopes: ['read:parcels'],
    });

    const client = await clientPromise;
    const db = client.db('parceflyte');
    
    // Get query parameters
    const { searchParams } = new URL(req.url);
    const senderId = searchParams.get('senderId');
    const matchedCarrierId = searchParams.get('matchedCarrierId');
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const minWeight = searchParams.get('minWeight');
    const maxWeight = searchParams.get('maxWeight');
    const minValue = searchParams.get('minValue');
    const maxValue = searchParams.get('maxValue');
    const deliveryDeadline = searchParams.get('deliveryDeadline');
    const limit = parseInt(searchParams.get('limit')) || 20;
    const page = parseInt(searchParams.get('page')) || 1;
    const skip = (page - 1) * limit;

    // Build query
    const query = {};
    if (senderId) query.senderId = senderId;
    if (matchedCarrierId) query.matchedCarrierId = matchedCarrierId;
    if (status) query.status = status;
    if (category) query.category = category;
    if (minWeight) query.weight = { $gte: parseFloat(minWeight) };
    if (maxWeight) {
      if (query.weight) {
        query.weight.$lte = parseFloat(maxWeight);
      } else {
        query.weight = { $lte: parseFloat(maxWeight) };
      }
    }
    if (minValue) query.declaredValue = { $gte: parseFloat(minValue) };
    if (maxValue) {
      if (query.declaredValue) {
        query.declaredValue.$lte = parseFloat(maxValue);
      } else {
        query.declaredValue = { $lte: parseFloat(maxValue) };
      }
    }
    if (deliveryDeadline) {
      const date = new Date(deliveryDeadline);
      query.deliveryDeadline = { $lte: date };
    }

    const parcels = await db.collection('parcels')
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await db.collection('parcels').countDocuments(query);

    return NextResponse.json({
      parcels,
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

export const POST = withApiAuthRequired(async function createParcel(req) {
  try {
    const { accessToken } = await getAccessToken(req, {
      scopes: ['write:parcels'],
    });

    const body = await req.json();
    const client = await clientPromise;
    const db = client.db('parceflyte');

    // Validate required fields
    const requiredFields = [
      'senderId',
      'recipient',
      'description',
      'category',
      'dimensions',
      'weight',
      'declaredValue'
    ];
    
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
      }
    }

    // Validate dimensions
    if (body.dimensions.length <= 0 || body.dimensions.width <= 0 || body.dimensions.height <= 0) {
      return NextResponse.json({ error: 'All dimensions must be greater than 0' }, { status: 400 });
    }

    // Validate weight
    if (body.weight <= 0) {
      return NextResponse.json({ error: 'Weight must be greater than 0' }, { status: 400 });
    }

    // Validate declared value
    if (body.declaredValue <= 0) {
      return NextResponse.json({ error: 'Declared value must be greater than 0' }, { status: 400 });
    }

    // Calculate volume
    const volume = body.dimensions.length * body.dimensions.width * body.dimensions.height;

    // Create new parcel
    const newParcel = {
      ...body,
      volume,
      status: 'pending',
      paymentStatus: 'pending',
      agreedDeliveryFee: 0,
      platformFee: 0,
      totalAmount: 0,
      trackingEvents: [{
        event: 'created',
        location: {
          city: body.recipient.address?.city || '',
          country: body.recipient.address?.country || '',
        },
        timestamp: new Date(),
        description: 'Parcel created',
      }],
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('parcels').insertOne(newParcel);
    newParcel._id = result.insertedId;

    return NextResponse.json(newParcel, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}); 