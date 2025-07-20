import clientPromise from '@/lib/db';
import { getAccessToken, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { NextResponse } from 'next/server';

export const GET = withApiAuthRequired(async function getPayments(req) {
  try {
    const { accessToken } = await getAccessToken(req, {
      scopes: ['read:payments'],
    });

    const client = await clientPromise;
    const db = client.db('parceflyte');
    
    // Get query parameters
    const { searchParams } = new URL(req.url);
    const parcelId = searchParams.get('parcelId');
    const matchId = searchParams.get('matchId');
    const senderId = searchParams.get('senderId');
    const carrierId = searchParams.get('carrierId');
    const status = searchParams.get('status');
    const escrowStatus = searchParams.get('escrowStatus');
    const minAmount = searchParams.get('minAmount');
    const maxAmount = searchParams.get('maxAmount');
    const limit = parseInt(searchParams.get('limit')) || 20;
    const page = parseInt(searchParams.get('page')) || 1;
    const skip = (page - 1) * limit;

    // Build query
    const query = {};
    if (parcelId) query.parcelId = parcelId;
    if (matchId) query.matchId = matchId;
    if (senderId) query.senderId = senderId;
    if (carrierId) query.carrierId = carrierId;
    if (status) query.status = status;
    if (escrowStatus) query.escrowStatus = escrowStatus;
    if (minAmount) query.amount = { $gte: parseFloat(minAmount) };
    if (maxAmount) {
      if (query.amount) {
        query.amount.$lte = parseFloat(maxAmount);
      } else {
        query.amount = { $lte: parseFloat(maxAmount) };
      }
    }

    const payments = await db.collection('payments')
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await db.collection('payments').countDocuments(query);

    return NextResponse.json({
      payments,
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

export const POST = withApiAuthRequired(async function createPayment(req) {
  try {
    const { accessToken } = await getAccessToken(req, {
      scopes: ['write:payments'],
    });

    const body = await req.json();
    const client = await clientPromise;
    const db = client.db('parceflyte');

    // Validate required fields
    const requiredFields = ['parcelId', 'matchId', 'senderId', 'carrierId', 'amount', 'paymentMethod'];
    
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
      }
    }

    // Check if match exists and is accepted
    const match = await db.collection('matches').findOne({ _id: body.matchId });
    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }
    if (match.status !== 'accepted') {
      return NextResponse.json({ error: 'Match must be accepted before creating payment' }, { status: 400 });
    }

    // Check if payment already exists for this match
    const existingPayment = await db.collection('payments').findOne({ matchId: body.matchId });
    if (existingPayment) {
      return NextResponse.json({ error: 'Payment already exists for this match' }, { status: 409 });
    }

    // Generate unique payment ID
    const paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Calculate fees
    const deliveryFee = match.negotiation.finalFee || match.negotiation.initialFee;
    const platformFee = deliveryFee * 0.05; // 5% platform fee
    const insuranceFee = body.insuranceAmount || 0;
    const totalAmount = deliveryFee + platformFee + insuranceFee;

    // Create new payment
    const newPayment = {
      paymentId,
      ...body,
      deliveryFee,
      platformFee,
      insuranceFee,
      totalAmount,
      status: 'pending',
      escrowStatus: 'funded',
      escrowReleaseConditions: ['delivery_confirmed'],
      dispute: {
        isDisputed: false,
      },
      securityChecks: {
        fraudScore: 0,
        riskLevel: 'low',
        flagged: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('payments').insertOne(newPayment);
    newPayment._id = result.insertedId;

    // Update parcel status
    await db.collection('parcels').updateOne(
      { _id: body.parcelId },
      { 
        $set: { 
          status: 'matched',
          matchedCarrierId: body.carrierId,
          agreedDeliveryFee: deliveryFee,
          platformFee,
          totalAmount,
          paymentStatus: 'paid',
          updatedAt: new Date()
        }
      }
    );

    return NextResponse.json(newPayment, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}); 