import clientPromise from '@/lib/db';
import { getAccessToken, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { NextResponse } from 'next/server';

export const GET = withApiAuthRequired(async function searchMatches(req) {
  try {
    const { accessToken } = await getAccessToken(req, {
      scopes: ['read:search'],
    });

    const client = await clientPromise;
    const db = client.db('parceflyte');
    
    // Get query parameters
    const { searchParams } = new URL(req.url);
    const parcelId = searchParams.get('parcelId');
    const departureCity = searchParams.get('departureCity');
    const arrivalCity = searchParams.get('arrivalCity');
    const departureCountry = searchParams.get('departureCountry');
    const arrivalCountry = searchParams.get('arrivalCountry');
    const weight = searchParams.get('weight');
    const volume = searchParams.get('volume');
    const maxFee = searchParams.get('maxFee');
    const deliveryDeadline = searchParams.get('deliveryDeadline');
    const travelMode = searchParams.get('travelMode');
    const minRating = searchParams.get('minRating');
    const limit = parseInt(searchParams.get('limit')) || 20;
    const page = parseInt(searchParams.get('page')) || 1;
    const skip = (page - 1) * limit;

    let searchResults = [];

    if (parcelId) {
      // Search for matches for a specific parcel
      searchResults = await searchForParcelMatches(db, parcelId, {
        maxFee,
        minRating,
        limit,
        skip
      });
    } else {
      // Search for available travels based on criteria
      searchResults = await searchForAvailableTravels(db, {
        departureCity,
        arrivalCity,
        departureCountry,
        arrivalCountry,
        weight,
        volume,
        maxFee,
        deliveryDeadline,
        travelMode,
        minRating,
        limit,
        skip
      });
    }

    return NextResponse.json({
      results: searchResults.results,
      total: searchResults.total,
      pagination: {
        page,
        limit,
        total: searchResults.total,
        pages: Math.ceil(searchResults.total / limit)
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
});

// Helper function to search for matches for a specific parcel
async function searchForParcelMatches(db, parcelId, options) {
  // Get parcel details
  const parcel = await db.collection('parcels').findOne({ _id: parcelId });
  if (!parcel) {
    throw new Error('Parcel not found');
  }

  // Build travel query
  const travelQuery = {
    status: { $in: ['planned', 'confirmed'] },
    'availableCapacity.weight': { $gte: parcel.weight },
    'availableCapacity.volume': { $gte: parcel.volume },
    departureDate: { $lte: new Date(parcel.deliveryDeadline) },
  };

  if (options.maxFee) {
    travelQuery.baseDeliveryFee = { $lte: parseFloat(options.maxFee) };
  }

  // Get matching travels
  const travels = await db.collection('travels')
    .find(travelQuery)
    .sort({ 'rating.average': -1 })
    .skip(options.skip)
    .limit(options.limit)
    .toArray();

  // Get carrier details for each travel
  const carrierIds = travels.map(travel => travel.carrierId);
  const carriers = await db.collection('users')
    .find({ _id: { $in: carrierIds } })
    .toArray();

  const carrierMap = carriers.reduce((map, carrier) => {
    map[carrier._id.toString()] = carrier;
    return map;
  }, {});

  // Calculate match scores and combine results
  const results = travels.map(travel => {
    const carrier = carrierMap[travel.carrierId.toString()];
    const matchScore = calculateMatchScore(parcel, travel);
    
    return {
      travel,
      carrier,
      matchScore,
      estimatedDeliveryFee: travel.baseDeliveryFee,
      routeMatch: {
        departure: travel.departureLocation.city === parcel.recipient.address?.city,
        arrival: travel.arrivalLocation.city === parcel.recipient.address?.city,
      },
      capacityMatch: {
        weight: travel.availableCapacity.weight >= parcel.weight,
        volume: travel.availableCapacity.volume >= parcel.volume,
      },
      timingMatch: new Date(travel.arrivalDate) <= new Date(parcel.deliveryDeadline),
    };
  });

  // Sort by match score
  results.sort((a, b) => b.matchScore - a.matchScore);

  const total = await db.collection('travels').countDocuments(travelQuery);

  return { results, total };
}

// Helper function to search for available travels
async function searchForAvailableTravels(db, options) {
  const query = {
    status: { $in: ['planned', 'confirmed'] },
  };

  if (options.departureCity) query['departureLocation.city'] = options.departureCity;
  if (options.arrivalCity) query['arrivalLocation.city'] = options.arrivalCity;
  if (options.departureCountry) query['departureLocation.country'] = options.departureCountry;
  if (options.arrivalCountry) query['arrivalLocation.country'] = options.arrivalCountry;
  if (options.weight) query['availableCapacity.weight'] = { $gte: parseFloat(options.weight) };
  if (options.volume) query['availableCapacity.volume'] = { $gte: parseFloat(options.volume) };
  if (options.maxFee) query.baseDeliveryFee = { $lte: parseFloat(options.maxFee) };
  if (options.travelMode) query.travelMode = options.travelMode;
  if (options.deliveryDeadline) {
    const date = new Date(options.deliveryDeadline);
    query.arrivalDate = { $lte: date };
  }

  const travels = await db.collection('travels')
    .find(query)
    .sort({ 'rating.average': -1 })
    .skip(options.skip)
    .limit(options.limit)
    .toArray();

  // Get carrier details
  const carrierIds = travels.map(travel => travel.carrierId);
  const carriers = await db.collection('users')
    .find({ _id: { $in: carrierIds } })
    .toArray();

  const carrierMap = carriers.reduce((map, carrier) => {
    map[carrier._id.toString()] = carrier;
    return map;
  }, {});

  const results = travels.map(travel => ({
    travel,
    carrier: carrierMap[travel.carrierId.toString()],
    estimatedDeliveryFee: travel.baseDeliveryFee,
  }));

  const total = await db.collection('travels').countDocuments(query);

  return { results, total };
}

// Helper function to calculate match score (same as in matches API)
function calculateMatchScore(parcel, travel) {
  let score = 0;
  
  // Route match (40 points)
  const departureMatch = parcel.recipient.address?.city === travel.departureLocation.city &&
                        parcel.recipient.address?.country === travel.departureLocation.country;
  const arrivalMatch = parcel.recipient.address?.city === travel.arrivalLocation.city &&
                      parcel.recipient.address?.country === travel.arrivalLocation.country;
  
  if (departureMatch) score += 20;
  if (arrivalMatch) score += 20;
  
  // Capacity match (30 points)
  const weightCapacity = travel.availableCapacity.weight >= parcel.weight;
  const volumeCapacity = travel.availableCapacity.volume >= parcel.volume;
  
  if (weightCapacity) score += 15;
  if (volumeCapacity) score += 15;
  
  // Timing match (20 points)
  const deliveryDeadline = new Date(parcel.deliveryDeadline);
  const travelArrival = new Date(travel.arrivalDate);
  
  if (deliveryDeadline >= travelArrival) score += 20;
  
  // Price match (10 points)
  const baseFee = travel.baseDeliveryFee;
  const maxFee = parcel.declaredValue * 0.1; // 10% of parcel value as max fee
  
  if (baseFee <= maxFee) score += 10;
  
  return Math.min(score, 100);
} 