import clientPromise from './db';

class MatchingService {
  constructor() {
    this.weights = {
      route: 0.35,        // Route compatibility (35%)
      capacity: 0.25,     // Capacity match (25%)
      timing: 0.20,       // Timing compatibility (20%)
      price: 0.10,        // Price compatibility (10%)
      rating: 0.10,       // Carrier rating (10%)
    };
  }

  /**
   * Find matches for a specific parcel
   */
  async findMatchesForParcel(parcelId, options = {}) {
    const client = await clientPromise;
    const db = client.db('parceflyte');

    // Get parcel details
    const parcel = await db.collection('parcels').findOne({ _id: parcelId });
    if (!parcel) {
      throw new Error('Parcel not found');
    }

    // Build travel query based on parcel requirements
    const travelQuery = this.buildTravelQuery(parcel, options);
    
    // Get matching travels
    const travels = await db.collection('travels')
      .find(travelQuery)
      .sort({ 'rating.average': -1 })
      .limit(options.limit || 50)
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

    // Calculate match scores and create match objects
    const matches = travels.map(travel => {
      const carrier = carrierMap[travel.carrierId.toString()];
      const matchScore = this.calculateMatchScore(parcel, travel, carrier);
      const matchDetails = this.getMatchDetails(parcel, travel, carrier);
      
      return {
        travel,
        carrier,
        matchScore,
        matchDetails,
        estimatedDeliveryFee: this.calculateEstimatedFee(parcel, travel),
        ...matchDetails
      };
    });

    // Sort by match score
    matches.sort((a, b) => b.matchScore - a.matchScore);

    return matches;
  }

  /**
   * Find available travels for a sender
   */
  async findAvailableTravels(criteria, options = {}) {
    const client = await clientPromise;
    const db = client.db('parceflyte');

    const travelQuery = this.buildTravelQueryFromCriteria(criteria);
    
    const travels = await db.collection('travels')
      .find(travelQuery)
      .sort({ 'rating.average': -1 })
      .skip(options.skip || 0)
      .limit(options.limit || 20)
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

    return travels.map(travel => ({
      travel,
      carrier: carrierMap[travel.carrierId.toString()],
      estimatedDeliveryFee: travel.baseDeliveryFee,
    }));
  }

  /**
   * Build travel query based on parcel requirements
   */
  buildTravelQuery(parcel, options = {}) {
    const query = {
      status: { $in: ['planned', 'confirmed'] },
      'availableCapacity.weight': { $gte: parcel.weight },
      'availableCapacity.volume': { $gte: parcel.volume },
      departureDate: { $lte: new Date(parcel.deliveryDeadline) },
    };

    // Add optional filters
    if (options.maxFee) {
      query.baseDeliveryFee = { $lte: parseFloat(options.maxFee) };
    }
    if (options.minRating) {
      query['rating.average'] = { $gte: parseFloat(options.minRating) };
    }
    if (options.travelMode) {
      query.travelMode = options.travelMode;
    }
    if (options.departureCountry) {
      query['departureLocation.country'] = options.departureCountry;
    }
    if (options.arrivalCountry) {
      query['arrivalLocation.country'] = options.arrivalCountry;
    }

    return query;
  }

  /**
   * Build travel query from search criteria
   */
  buildTravelQueryFromCriteria(criteria) {
    const query = {
      status: { $in: ['planned', 'confirmed'] },
    };

    if (criteria.departureCity) query['departureLocation.city'] = criteria.departureCity;
    if (criteria.arrivalCity) query['arrivalLocation.city'] = criteria.arrivalCity;
    if (criteria.departureCountry) query['departureLocation.country'] = criteria.departureCountry;
    if (criteria.arrivalCountry) query['arrivalLocation.country'] = criteria.arrivalCountry;
    if (criteria.weight) query['availableCapacity.weight'] = { $gte: parseFloat(criteria.weight) };
    if (criteria.volume) query['availableCapacity.volume'] = { $gte: parseFloat(criteria.volume) };
    if (criteria.maxFee) query.baseDeliveryFee = { $lte: parseFloat(criteria.maxFee) };
    if (criteria.travelMode) query.travelMode = criteria.travelMode;
    if (criteria.deliveryDeadline) {
      const date = new Date(criteria.deliveryDeadline);
      query.arrivalDate = { $lte: date };
    }

    return query;
  }

  /**
   * Calculate comprehensive match score
   */
  calculateMatchScore(parcel, travel, carrier) {
    let totalScore = 0;

    // Route compatibility (35%)
    const routeScore = this.calculateRouteScore(parcel, travel);
    totalScore += routeScore * this.weights.route;

    // Capacity compatibility (25%)
    const capacityScore = this.calculateCapacityScore(parcel, travel);
    totalScore += capacityScore * this.weights.capacity;

    // Timing compatibility (20%)
    const timingScore = this.calculateTimingScore(parcel, travel);
    totalScore += timingScore * this.weights.timing;

    // Price compatibility (10%)
    const priceScore = this.calculatePriceScore(parcel, travel);
    totalScore += priceScore * this.weights.price;

    // Carrier rating (10%)
    const ratingScore = this.calculateRatingScore(carrier);
    totalScore += ratingScore * this.weights.rating;

    return Math.round(totalScore * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate route compatibility score
   */
  calculateRouteScore(parcel, travel) {
    let score = 0;
    
    // Exact city matches
    const departureCityMatch = parcel.recipient.address?.city === travel.departureLocation.city;
    const arrivalCityMatch = parcel.recipient.address?.city === travel.arrivalLocation.city;
    
    if (departureCityMatch) score += 0.5;
    if (arrivalCityMatch) score += 0.5;
    
    // Country matches (partial score)
    const departureCountryMatch = parcel.recipient.address?.country === travel.departureLocation.country;
    const arrivalCountryMatch = parcel.recipient.address?.country === travel.arrivalLocation.country;
    
    if (departureCountryMatch && !departureCityMatch) score += 0.25;
    if (arrivalCountryMatch && !arrivalCityMatch) score += 0.25;
    
    return Math.min(score, 1);
  }

  /**
   * Calculate capacity compatibility score
   */
  calculateCapacityScore(parcel, travel) {
    const weightRatio = Math.min(parcel.weight / travel.availableCapacity.weight, 1);
    const volumeRatio = Math.min(parcel.volume / travel.availableCapacity.volume, 1);
    
    // Prefer matches where capacity is well-utilized but not exceeded
    const weightScore = weightRatio > 0.8 ? 1 : weightRatio;
    const volumeScore = volumeRatio > 0.8 ? 1 : volumeRatio;
    
    return (weightScore + volumeScore) / 2;
  }

  /**
   * Calculate timing compatibility score
   */
  calculateTimingScore(parcel, travel) {
    const deliveryDeadline = new Date(parcel.deliveryDeadline);
    const travelArrival = new Date(travel.arrivalDate);
    const travelDeparture = new Date(travel.departureDate);
    
    // Check if delivery deadline is after travel arrival
    if (deliveryDeadline < travelArrival) {
      return 0; // Impossible to meet deadline
    }
    
    // Calculate buffer time
    const bufferTime = deliveryDeadline - travelArrival;
    const daysBuffer = bufferTime / (1000 * 60 * 60 * 24);
    
    // Prefer matches with reasonable buffer time (1-7 days is ideal)
    if (daysBuffer >= 1 && daysBuffer <= 7) {
      return 1;
    } else if (daysBuffer > 7) {
      return 0.8; // Still good but less ideal
    } else {
      return 0.5; // Tight deadline
    }
  }

  /**
   * Calculate price compatibility score
   */
  calculatePriceScore(parcel, travel) {
    const baseFee = travel.baseDeliveryFee;
    const parcelValue = parcel.declaredValue;
    const maxAcceptableFee = parcelValue * 0.15; // 15% of parcel value
    
    if (baseFee <= maxAcceptableFee) {
      // Prefer lower fees relative to parcel value
      const feeRatio = baseFee / parcelValue;
      return Math.max(0.5, 1 - feeRatio);
    }
    
    return 0; // Fee too high
  }

  /**
   * Calculate carrier rating score
   */
  calculateRatingScore(carrier) {
    if (!carrier || !carrier.rating) {
      return 0.5; // Neutral score for new carriers
    }
    
    const averageRating = carrier.rating.average || 0;
    const totalReviews = carrier.rating.totalReviews || 0;
    
    // Base score on average rating
    let score = averageRating / 5;
    
    // Boost score for carriers with more reviews (trust factor)
    if (totalReviews >= 10) {
      score += 0.1;
    } else if (totalReviews >= 5) {
      score += 0.05;
    }
    
    return Math.min(score, 1);
  }

  /**
   * Get detailed match information
   */
  getMatchDetails(parcel, travel, carrier) {
    return {
      routeMatch: {
        departure: parcel.recipient.address?.city === travel.departureLocation.city &&
                  parcel.recipient.address?.country === travel.departureLocation.country,
        arrival: parcel.recipient.address?.city === travel.arrivalLocation.city &&
                parcel.recipient.address?.country === travel.arrivalLocation.country,
        departureCity: travel.departureLocation.city,
        arrivalCity: travel.arrivalLocation.city,
      },
      capacityMatch: {
        weight: travel.availableCapacity.weight >= parcel.weight,
        volume: travel.availableCapacity.volume >= parcel.volume,
        availableWeight: travel.availableCapacity.weight,
        requiredWeight: parcel.weight,
        availableVolume: travel.availableCapacity.volume,
        requiredVolume: parcel.volume,
      },
      timingMatch: {
        canMeetDeadline: new Date(travel.arrivalDate) <= new Date(parcel.deliveryDeadline),
        travelArrival: travel.arrivalDate,
        deliveryDeadline: parcel.deliveryDeadline,
        bufferDays: Math.floor((new Date(parcel.deliveryDeadline) - new Date(travel.arrivalDate)) / (1000 * 60 * 60 * 24)),
      },
      priceMatch: {
        baseFee: travel.baseDeliveryFee,
        maxAcceptableFee: parcel.declaredValue * 0.15,
        isAffordable: travel.baseDeliveryFee <= parcel.declaredValue * 0.15,
      },
      carrierInfo: {
        rating: carrier?.rating?.average || 0,
        totalReviews: carrier?.rating?.totalReviews || 0,
        completedDeliveries: carrier?.rating?.completedDeliveries || 0,
        successRate: carrier?.rating?.successfulDeliveries / Math.max(carrier?.rating?.completedDeliveries || 1, 1),
      },
    };
  }

  /**
   * Calculate estimated delivery fee
   */
  calculateEstimatedFee(parcel, travel) {
    let baseFee = travel.baseDeliveryFee;
    
    // Adjust fee based on parcel characteristics
    if (parcel.specialHandling && parcel.specialHandling.length > 0) {
      baseFee *= 1.1; // 10% premium for special handling
    }
    
    if (parcel.insuranceRequired) {
      baseFee += parcel.insuranceAmount || (parcel.declaredValue * 0.02); // 2% insurance fee
    }
    
    // Distance-based adjustment
    const distance = this.calculateDistance(
      travel.departureLocation,
      travel.arrivalLocation
    );
    
    if (distance > 1000) { // Long distance
      baseFee *= 1.05; // 5% premium
    }
    
    return Math.round(baseFee * 100) / 100;
  }

  /**
   * Calculate distance between two locations
   */
  calculateDistance(location1, location2) {
    // Simple distance calculation (can be enhanced with real geocoding)
    // This is a placeholder - in production, use a proper geocoding service
    return 500; // Placeholder distance in km
  }

  /**
   * Auto-match parcels with available travels
   */
  async autoMatchParcel(parcelId, criteria = {}) {
    const matches = await this.findMatchesForParcel(parcelId, criteria);
    
    // Filter for high-quality matches (score >= 70)
    const highQualityMatches = matches.filter(match => match.matchScore >= 70);
    
    // Sort by score and return top matches
    return highQualityMatches.slice(0, 5);
  }

  /**
   * Suggest optimal pricing for a match
   */
  suggestPricing(parcel, travel, carrier) {
    const baseFee = travel.baseDeliveryFee;
    const parcelValue = parcel.declaredValue;
    
    // Calculate suggested fee range
    const minFee = baseFee * 0.9; // 10% discount for negotiation
    const maxFee = Math.min(baseFee * 1.2, parcelValue * 0.15); // 20% premium max, or 15% of parcel value
    
    return {
      suggestedFee: Math.round((minFee + maxFee) / 2 * 100) / 100,
      minFee: Math.round(minFee * 100) / 100,
      maxFee: Math.round(maxFee * 100) / 100,
      negotiationRange: {
        min: Math.round(minFee * 100) / 100,
        max: Math.round(maxFee * 100) / 100,
      },
    };
  }
}

export default new MatchingService(); 