// Match schema definition for documentation and validation
export const matchSchema = {
  // Basic match information
  parcelId: {
    type: 'objectId',
    required: true,
  },
  travelId: {
    type: 'objectId',
    required: true,
  },
  senderId: {
    type: 'objectId',
    required: true,
  },
  carrierId: {
    type: 'objectId',
    required: true,
  },
  
  // Match status
  status: {
    type: 'string',
    enum: ['proposed', 'accepted', 'rejected', 'expired', 'cancelled'],
    default: 'proposed',
  },
  
  // Negotiation details
  negotiation: {
    initialFee: {
      type: 'number',
      required: true,
    },
    proposedFee: 'number',
    finalFee: 'number',
    currency: {
      type: 'string',
      default: 'USD',
    },
    negotiationHistory: [{
      proposedBy: 'objectId',
      amount: 'number',
      message: 'string',
      timestamp: 'date',
    }],
  },
  
  // Agreement terms
  agreement: {
    pickupLocation: {
      type: 'string',
      required: true,
    },
    pickupDate: {
      type: 'date',
      required: true,
    },
    deliveryLocation: {
      type: 'string',
      required: true,
    },
    deliveryDate: {
      type: 'date',
      required: true,
    },
    specialInstructions: 'string',
    insuranceRequired: {
      type: 'boolean',
      default: false,
    },
    insuranceAmount: 'number',
  },
  
  // Communication
  messages: [{
    senderId: 'objectId',
    message: 'string',
    timestamp: 'date',
    isRead: {
      type: 'boolean',
      default: false,
    },
  }],
  
  // Timestamps
  proposedAt: 'date',
  acceptedAt: 'date',
  rejectedAt: 'date',
  expiresAt: {
    type: 'date',
    required: true,
  },
  
  // Match quality score
  matchScore: {
    type: 'number',
    min: 0,
    max: 100,
  },
  
  // Reasons for match
  matchReasons: [{
    type: 'string',
    enum: ['route_match', 'capacity_match', 'timing_match', 'rating_match', 'price_match'],
  }],
  
  // Platform fees
  platformFee: {
    type: 'number',
    default: 0,
  },
  totalAmount: {
    type: 'number',
    required: true,
  },
  
  // Auto-accept settings
  autoAccept: {
    type: 'boolean',
    default: false,
  },
  autoAcceptConditions: {
    maxFee: 'number',
    minRating: 'number',
    maxDistance: 'number', // in km
  },
  
  // Timestamps
  createdAt: 'date',
  updatedAt: 'date',
}; 