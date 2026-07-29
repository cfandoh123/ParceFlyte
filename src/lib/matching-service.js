import { getDb, toId, idString } from './db';

/**
 * Scores (parcel, travel) pairs on five weighted factors.
 *
 * Scores are on a 0-100 scale throughout. Each factor scorer returns 0-1 and
 * the weighted sum is scaled once, at the end, so thresholds elsewhere in the
 * codebase can be read as percentages.
 */
class MatchingService {
  constructor() {
    this.weights = {
      route: 0.35, // Route compatibility
      capacity: 0.25, // Capacity match
      timing: 0.2, // Timing compatibility
      price: 0.1, // Price compatibility
      rating: 0.1, // Carrier rating
    };

    // A match must clear this to be auto-created.
    this.autoMatchThreshold = 70;
  }

  /** Find and score carrier travels that could deliver a given parcel. */
  async findMatchesForParcel(parcelId, options = {}) {
    const db = await getDb();

    const parcel = await db.collection('parcels').findOne({ _id: toId(parcelId) });
    if (!parcel) {
      const error = new Error('Parcel not found');
      error.status = 404;
      throw error;
    }

    const travels = await db
      .collection('travels')
      .find(this.buildTravelQuery(parcel, options))
      .sort({ departureDate: 1 })
      .limit(options.candidateLimit || 100)
      .toArray();

    const carriers = await this.loadCarriers(db, travels);

    const matches = travels
      // A carrier cannot deliver their own parcel.
      .filter((travel) => idString(travel.carrierId) !== idString(parcel.senderId))
      // A trip that touches neither end of the parcel's route is not a
      // candidate at any score — someone flying Dubai to Mumbai cannot deliver
      // London to Lagos, however much spare capacity they have.
      .filter((travel) => this.calculateRouteScore(parcel, travel) > 0)
      .map((travel) => {
        const carrier = carriers[idString(travel.carrierId)];
        const breakdown = this.scoreBreakdown(parcel, travel, carrier);
        return {
          travel,
          carrier: this.publicCarrier(carrier),
          matchScore: breakdown.total,
          scoreBreakdown: breakdown.factors,
          matchDetails: this.getMatchDetails(parcel, travel, carrier),
          estimatedDeliveryFee: this.calculateEstimatedFee(parcel, travel),
          quote: this.quote(parcel, travel),
          pricing: this.suggestPricing(parcel, travel),
        };
      });

    matches.sort((a, b) => b.matchScore - a.matchScore);
    return matches;
  }

  /** Browse available travels by raw criteria, with no parcel to score against. */
  async findAvailableTravels(criteria = {}, options = {}) {
    const db = await getDb();

    const query = this.buildTravelQueryFromCriteria(criteria);
    const all = await db.collection('travels').find(query).sort({ departureDate: 1 }).toArray();

    const skip = options.skip || 0;
    const limit = options.limit || 20;
    const page = all.slice(skip, skip + limit);
    const carriers = await this.loadCarriers(db, page);

    return {
      total: all.length,
      results: page.map((travel) => ({
        travel,
        carrier: this.publicCarrier(carriers[idString(travel.carrierId)]),
        estimatedDeliveryFee: travel.baseDeliveryFee,
      })),
    };
  }

  /** Batch-load the carriers for a set of travels — one query, not N. */
  async loadCarriers(db, travels) {
    const ids = [...new Set(travels.map((t) => idString(t.carrierId)))];
    if (!ids.length) return {};
    const carriers = await db
      .collection('users')
      .find({ _id: { $in: ids.map(toId) } })
      .toArray();
    return carriers.reduce((map, carrier) => {
      map[idString(carrier._id)] = carrier;
      return map;
    }, {});
  }

  /** Strip contact details before a carrier is shown to a prospective sender. */
  publicCarrier(carrier) {
    if (!carrier) return null;
    return {
      _id: carrier._id,
      firstName: carrier.firstName,
      lastName: carrier.lastName,
      avatarColor: carrier.avatarColor,
      kycStatus: carrier.kycStatus,
      rating: carrier.rating,
      memberSince: carrier.createdAt,
    };
  }

  buildTravelQuery(parcel, options = {}) {
    const query = {
      status: { $in: ['planned', 'confirmed'] },
      'availableCapacity.weight': { $gte: parcel.weight },
      'availableCapacity.volume': { $gte: parcel.volume },
      // The carrier must both leave and arrive before the parcel is due.
      departureDate: { $gte: new Date() },
      arrivalDate: { $lte: new Date(parcel.deliveryDeadline) },
    };

    if (options.maxFee) query.baseDeliveryFee = { $lte: parseFloat(options.maxFee) };
    if (options.travelMode) query.travelMode = options.travelMode;
    if (options.departureCountry) query['departureLocation.country'] = options.departureCountry;
    if (options.arrivalCountry) query['arrivalLocation.country'] = options.arrivalCountry;

    return query;
  }

  buildTravelQueryFromCriteria(criteria = {}) {
    const query = { status: { $in: ['planned', 'confirmed'] } };

    if (criteria.departureCity) query['departureLocation.city'] = criteria.departureCity;
    if (criteria.arrivalCity) query['arrivalLocation.city'] = criteria.arrivalCity;
    if (criteria.departureCountry) query['departureLocation.country'] = criteria.departureCountry;
    if (criteria.arrivalCountry) query['arrivalLocation.country'] = criteria.arrivalCountry;
    if (criteria.weight) query['availableCapacity.weight'] = { $gte: parseFloat(criteria.weight) };
    if (criteria.volume) query['availableCapacity.volume'] = { $gte: parseFloat(criteria.volume) };
    if (criteria.maxFee) query.baseDeliveryFee = { $lte: parseFloat(criteria.maxFee) };
    if (criteria.travelMode) query.travelMode = criteria.travelMode;
    if (criteria.deliveryDeadline) query.arrivalDate = { $lte: new Date(criteria.deliveryDeadline) };
    if (criteria.carrierId) query.carrierId = toId(criteria.carrierId);

    return query;
  }

  /** Per-factor scores plus the weighted 0-100 total. */
  scoreBreakdown(parcel, travel, carrier) {
    const factors = {
      route: this.calculateRouteScore(parcel, travel),
      capacity: this.calculateCapacityScore(parcel, travel),
      timing: this.calculateTimingScore(parcel, travel),
      price: this.calculatePriceScore(parcel, travel),
      rating: this.calculateRatingScore(carrier),
    };

    const weighted = Object.entries(factors).reduce(
      (sum, [factor, score]) => sum + score * this.weights[factor],
      0
    );

    return {
      total: Math.round(weighted * 100),
      factors: Object.fromEntries(
        Object.entries(factors).map(([factor, score]) => [
          factor,
          { score: Math.round(score * 100), weight: this.weights[factor] },
        ])
      ),
    };
  }

  /** Weighted 0-100 match score. */
  calculateMatchScore(parcel, travel, carrier) {
    return this.scoreBreakdown(parcel, travel, carrier).total;
  }

  /**
   * Route fit: the parcel's origin against the travel's departure, and the
   * recipient's address against the arrival. Exact city is worth full credit on
   * each leg, same-country half credit.
   */
  calculateRouteScore(parcel, travel) {
    const origin = parcel.origin || parcel.pickupAddress;
    const destination = parcel.recipient?.address;

    const legScore = (parcelPlace, travelPlace) => {
      if (!parcelPlace || !travelPlace) return 0;
      if (this.sameCity(parcelPlace, travelPlace)) return 1;
      if (this.sameCountry(parcelPlace, travelPlace)) return 0.5;
      return 0;
    };

    return (legScore(origin, travel.departureLocation) + legScore(destination, travel.arrivalLocation)) / 2;
  }

  sameCity(a, b) {
    return Boolean(a?.city && b?.city && a.city.trim().toLowerCase() === b.city.trim().toLowerCase());
  }

  sameCountry(a, b) {
    return Boolean(a?.country && b?.country && a.country.trim().toLowerCase() === b.country.trim().toLowerCase());
  }

  /**
   * Capacity fit. Prefers travels where the parcel uses a healthy share of the
   * remaining space — a 2kg parcel on a carrier with 2.5kg left is a better
   * pairing than the same parcel on one with 20kg left, which is better saved
   * for a larger parcel.
   */
  calculateCapacityScore(parcel, travel) {
    const ratio = (required, available) => {
      if (!available || available <= 0) return 0;
      if (required > available) return 0;
      const utilization = required / available;
      // Peak at 60-100% utilization; taper below that rather than dropping off.
      return utilization >= 0.6 ? 1 : 0.5 + (utilization / 0.6) * 0.5;
    };

    const weightScore = ratio(parcel.weight, travel.availableCapacity?.weight);
    const volumeScore = ratio(parcel.volume, travel.availableCapacity?.volume);
    return (weightScore + volumeScore) / 2;
  }

  /** Timing fit, driven by how much buffer there is before the deadline. */
  calculateTimingScore(parcel, travel) {
    const deadline = new Date(parcel.deliveryDeadline);
    const arrival = new Date(travel.arrivalDate);
    const departure = new Date(travel.departureDate);

    if (Number.isNaN(deadline.getTime()) || Number.isNaN(arrival.getTime())) return 0;
    if (arrival > deadline) return 0; // cannot make the deadline
    if (departure < new Date()) return 0; // already departed

    const daysBuffer = (deadline - arrival) / (1000 * 60 * 60 * 24);
    if (daysBuffer < 1) return 0.5; // arrives just in time
    if (daysBuffer <= 7) return 1; // comfortable buffer
    if (daysBuffer <= 21) return 0.8;
    return 0.6; // so far ahead the sender is left waiting
  }

  /** Price fit relative to the fee ceiling for this parcel. */
  calculatePriceScore(parcel, travel) {
    const fee = travel.baseDeliveryFee;
    if (!parcel.declaredValue || parcel.declaredValue <= 0) return 0.5;

    const ceiling = this.maxAcceptableFee(parcel);
    if (fee > ceiling) return 0; // priced out of this parcel entirely

    // Linear from 1.0 at a free delivery to 0.5 at the ceiling.
    return 1 - (fee / ceiling) * 0.5;
  }

  /** Carrier reputation, with a neutral score for carriers who have no history. */
  calculateRatingScore(carrier) {
    const totalReviews = carrier?.rating?.totalReviews || 0;
    if (!carrier?.rating || totalReviews === 0) return 0.5;

    const base = (carrier.rating.average || 0) / 5;
    const trustBonus = totalReviews >= 10 ? 0.1 : totalReviews >= 5 ? 0.05 : 0;
    return Math.min(base + trustBonus, 1);
  }

  /** Human-readable explanation of the score, rendered by the match card. */
  getMatchDetails(parcel, travel, carrier) {
    const origin = parcel.origin || parcel.pickupAddress;
    const destination = parcel.recipient?.address;
    const bufferDays = Math.floor(
      (new Date(parcel.deliveryDeadline) - new Date(travel.arrivalDate)) / (1000 * 60 * 60 * 24)
    );

    return {
      routeMatch: {
        departure: this.sameCity(origin, travel.departureLocation),
        arrival: this.sameCity(destination, travel.arrivalLocation),
        departureCity: travel.departureLocation?.city,
        arrivalCity: travel.arrivalLocation?.city,
        distanceKm: this.calculateDistance(travel.departureLocation, travel.arrivalLocation),
      },
      capacityMatch: {
        weight: (travel.availableCapacity?.weight || 0) >= parcel.weight,
        volume: (travel.availableCapacity?.volume || 0) >= parcel.volume,
        availableWeight: travel.availableCapacity?.weight,
        requiredWeight: parcel.weight,
        availableVolume: travel.availableCapacity?.volume,
        requiredVolume: parcel.volume,
      },
      timingMatch: {
        canMeetDeadline: new Date(travel.arrivalDate) <= new Date(parcel.deliveryDeadline),
        travelDeparture: travel.departureDate,
        travelArrival: travel.arrivalDate,
        deliveryDeadline: parcel.deliveryDeadline,
        bufferDays,
      },
      priceMatch: {
        baseFee: travel.baseDeliveryFee,
        maxAcceptableFee: this.maxAcceptableFee(parcel),
        isAffordable: travel.baseDeliveryFee <= this.maxAcceptableFee(parcel),
      },
      carrierInfo: {
        name: carrier ? `${carrier.firstName} ${carrier.lastName}` : 'Unknown carrier',
        rating: carrier?.rating?.average || 0,
        totalReviews: carrier?.rating?.totalReviews || 0,
        completedDeliveries: carrier?.rating?.completedDeliveries || 0,
        kycStatus: carrier?.kycStatus || 'pending',
        successRate: carrier?.rating?.completedDeliveries
          ? carrier.rating.successfulDeliveries / carrier.rating.completedDeliveries
          : null,
      },
    };
  }

  /**
   * The most a delivery fee is allowed to be for this parcel.
   *
   * 15% of declared value protects senders of valuable parcels, but on its own
   * it makes low-value items undeliverable — a $60 envelope would cap the fee
   * at $9, which no carrier would accept. The floor keeps cheap parcels
   * matchable; the ratio is what binds once a parcel is worth more than a few
   * hundred dollars.
   */
  maxAcceptableFee(parcel) {
    const byValue = parcel.declaredValue * MatchingService.MAX_FEE_RATIO;
    return Math.round(Math.max(byValue, MatchingService.MIN_FEE_CEILING) * 100) / 100;
  }

  /**
   * Itemised quote for carrying this parcel on this trip.
   *
   * Insurance is priced separately from the carrier's fee: it is a cost of the
   * parcel, not of the carriage, and folding it in would push every quote into
   * the cap and make different carriers look identically priced.
   */
  quote(parcel, travel) {
    const round = (n) => Math.round(n * 100) / 100;
    const base = travel.baseDeliveryFee;

    const handling = parcel.specialHandling?.length ? round(base * 0.1) : 0;

    const distance = this.calculateDistance(travel.departureLocation, travel.arrivalLocation);
    const distanceRate = distance > 5000 ? 0.1 : distance > 1000 ? 0.05 : 0;
    const distanceSurcharge = round(base * distanceRate);

    const uncapped = round(base + handling + distanceSurcharge);
    const ceiling = this.maxAcceptableFee(parcel);
    const deliveryFee = round(Math.min(uncapped, ceiling));

    const insurance = parcel.insuranceRequired
      ? round(parcel.insuranceAmount || parcel.declaredValue * 0.02)
      : 0;

    return {
      base,
      handling,
      distanceSurcharge,
      uncapped,
      deliveryFee,
      cappedByCeiling: uncapped > ceiling,
      ceiling,
      insurance,
      total: round(deliveryFee + insurance),
    };
  }

  /** The carrier's fee alone — what the negotiation opens at. */
  calculateEstimatedFee(parcel, travel) {
    return this.quote(parcel, travel).deliveryFee;
  }

  /**
   * Great-circle distance in km between two locations. Returns null when either
   * location has no coordinates, so callers can tell "far" from "unknown".
   */
  calculateDistance(from, to) {
    const a = from?.coordinates;
    const b = to?.coordinates;
    if (!a || !b || a.latitude == null || b.latitude == null) return null;

    const R = 6371; // Earth's mean radius, km
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);

    const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    return Math.round(2 * R * Math.asin(Math.sqrt(h)));
  }

  /** Top-scoring matches that clear the auto-match threshold. */
  async autoMatchParcel(parcelId, criteria = {}) {
    const matches = await this.findMatchesForParcel(parcelId, criteria);
    return matches.filter((m) => m.matchScore >= this.autoMatchThreshold).slice(0, criteria.limit || 5);
  }

  /** A sensible opening offer and the band a negotiation should stay inside. */
  suggestPricing(parcel, travel) {
    const base = travel.baseDeliveryFee;
    const ceiling = this.maxAcceptableFee(parcel);

    const minFee = Math.round(base * 0.9 * 100) / 100;
    const maxFee = Math.max(minFee, Math.round(Math.min(base * 1.2, ceiling) * 100) / 100);
    const suggested = Math.round(((minFee + maxFee) / 2) * 100) / 100;

    return {
      suggestedFee: suggested,
      minFee,
      maxFee,
      ceiling,
      negotiationRange: { min: minFee, max: maxFee },
    };
  }
}

/** Delivery fees are capped at this share of the parcel's declared value… */
MatchingService.MAX_FEE_RATIO = 0.15;

/** …but never below this floor, so low-value parcels stay deliverable. */
MatchingService.MIN_FEE_CEILING = 45;

const matchingService = new MatchingService();
export { MatchingService };
export default matchingService;
