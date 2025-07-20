import clientPromise from '@/lib/db';
import { getAccessToken, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { NextResponse } from 'next/server';

export const GET = withApiAuthRequired(async function getTravels(req) {
  try {
    const { accessToken } = await getAccessToken(req, {
      scopes: ['read:travels'],
    });

    const client = await clientPromise;
    const db = client.db('parceflyte');
    
    // Get query parameters
    const { searchParams } = new URL(req.url);
    const carrierId = searchParams.get('carrierId');
    const departureCountry = searchParams.get('departureCountry');
    const arrivalCountry = searchParams.get('arrivalCountry');
    const departureCity = searchParams.get('departureCity');
    const arrivalCity = searchParams.get('arrivalCity');
    const travelMode = searchParams.get('travelMode');
    const status = searchParams.get('status');
    const minCapacity = searchParams.get('minCapacity');
    const maxFee = searchParams.get('maxFee');
    const departureDate = searchParams.get('departureDate');
    const arrivalDate = searchParams.get('arrivalDate');
    const limit = parseInt(searchParams.get('limit')) || 20;
    const page = parseInt(searchParams.get('page')) || 1;
    const skip = (page - 1) * limit;

    // Build query
    const query = {};
    if (carrierId) query.carrierId = carrierId;
    if (departureCountry) query['departureLocation.country'] = departureCountry;
    if (arrivalCountry) query['arrivalLocation.country'] = arrivalCountry;
    if (departureCity) query['departureLocation.city'] = departureCity;
    if (arrivalCity) query['arrivalLocation.city'] = arrivalCity;
    if (travelMode) query.travelMode = travelMode;
    if (status) query.status = status;
    if (minCapacity) query['availableCapacity.weight'] = { $gte: parseFloat(minCapacity) };
    if (maxFee) query.baseDeliveryFee = { $lte: parseFloat(maxFee) };
    if (departureDate) {
      const date = new Date(departureDate);
      query.departureDate = { $gte: date };
    }
    if (arrivalDate) {
      const date = new Date(arrivalDate);
      query.arrivalDate = { $lte: date };
    }

    const travels = await db.collection('travels')
      .find(query)
      .sort({ departureDate: 1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await db.collection('travels').countDocuments(query);

    return NextResponse.json({
      travels,
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

export const POST = withApiAuthRequired(async function createTravel(req) {
  try {
    const { accessToken } = await getAccessToken(req, {
      scopes: ['write:travels'],
    });

    const body = await req.json();
    const client = await clientPromise;
    const db = client.db('parceflyte');

    // Validate required fields
    const requiredFields = [
      'carrierId', 
      'departureLocation', 
      'arrivalLocation', 
      'travelMode', 
      'departureDate', 
      'arrivalDate',
      'availableCapacity',
      'baseDeliveryFee'
    ];
    
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
      }
    }

    // Validate dates
    if (new Date(body.departureDate) >= new Date(body.arrivalDate)) {
      return NextResponse.json({ error: 'Departure date must be before arrival date' }, { status: 400 });
    }

    // Validate capacity
    if (body.availableCapacity.weight <= 0) {
      return NextResponse.json({ error: 'Available capacity must be greater than 0' }, { status: 400 });
    }

    // Create new travel
    const newTravel = {
      ...body,
      status: 'planned',
      isVerified: false,
      totalParcels: 0,
      totalWeight: 0,
      totalValue: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('travels').insertOne(newTravel);
    newTravel._id = result.insertedId;

    return NextResponse.json(newTravel, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}); 