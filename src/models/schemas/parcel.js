// Parcel schema definition for documentation and validation
export const parcelSchema = {
  // Sender information
  senderId: {
    type: 'objectId',
    required: true,
  },
  
  // Recipient information
  recipient: {
    name: {
      type: 'string',
      required: true,
    },
    phoneNumber: {
      type: 'string',
      required: true,
    },
    email: 'string',
    address: {
      street: 'string',
      city: 'string',
      state: 'string',
      country: 'string',
      postalCode: 'string',
      coordinates: {
        latitude: 'number',
        longitude: 'number',
      },
    },
  },
  
  // Parcel details
  description: {
    type: 'string',
    required: true,
  },
  category: {
    type: 'string',
    enum: ['electronics', 'clothing', 'documents', 'books', 'food', 'cosmetics', 'other'],
    required: true,
  },
  
  // Physical specifications
  dimensions: {
    length: {
      type: 'number', // in cm
      required: true,
    },
    width: {
      type: 'number', // in cm
      required: true,
    },
    height: {
      type: 'number', // in cm
      required: true,
    },
  },
  weight: {
    type: 'number', // in kg
    required: true,
  },
  volume: {
    type: 'number', // in cubic cm
    required: true,
  },
  
  // Value and insurance
  declaredValue: {
    type: 'number',
    required: true,
  },
  currency: {
    type: 'string',
    default: 'USD',
  },
  insuranceRequired: {
    type: 'boolean',
    default: false,
  },
  insuranceAmount: 'number',
  
  // Special handling
  specialHandling: [{
    type: 'string',
    enum: ['fragile', 'temperature_controlled', 'urgent', 'signature_required', 'photo_proof'],
  }],
  
  // Restrictions
  prohibitedItems: ['string'], // Items that are not allowed
  customsDeclaration: {
    type: 'boolean',
    default: false,
  },
  customsValue: 'number',
  
  // Delivery requirements
  deliveryDeadline: 'date',
  preferredDeliveryTime: {
    type: 'string',
    enum: ['anytime', 'morning', 'afternoon', 'evening'],
    default: 'anytime',
  },
  
  // Status and tracking
  status: {
    type: 'string',
    enum: ['pending', 'matched', 'in_transit', 'delivered', 'cancelled', 'lost'],
    default: 'pending',
  },
  
  // Matching information
  matchedTravelId: 'objectId',
  matchedCarrierId: 'objectId',
  
  // Pricing
  agreedDeliveryFee: {
    type: 'number',
    required: true,
  },
  platformFee: {
    type: 'number',
    default: 0,
  },
  totalAmount: {
    type: 'number',
    required: true,
  },
  
  // Payment status
  paymentStatus: {
    type: 'string',
    enum: ['pending', 'paid', 'released', 'refunded'],
    default: 'pending',
  },
  
  // Tracking events
  trackingEvents: [{
    event: {
      type: 'string',
      enum: ['created', 'matched', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed_delivery'],
    },
    location: {
      city: 'string',
      country: 'string',
      coordinates: {
        latitude: 'number',
        longitude: 'number',
      },
    },
    timestamp: 'date',
    description: 'string',
    photos: ['string'], // URLs to photos
  }],
  
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
  
  // Ratings and reviews
  senderRating: {
    rating: {
      type: 'number',
      min: 1,
      max: 5,
    },
    review: 'string',
    timestamp: 'date',
  },
  carrierRating: {
    rating: {
      type: 'number',
      min: 1,
      max: 5,
    },
    review: 'string',
    timestamp: 'date',
  },
  
  // Dispute resolution
  disputes: [{
    type: {
      type: 'string',
      enum: ['damage', 'delay', 'non_delivery', 'wrong_item', 'other'],
    },
    description: 'string',
    evidence: ['string'], // URLs to evidence files
    status: {
      type: 'string',
      enum: ['open', 'under_review', 'resolved', 'closed'],
      default: 'open',
    },
    resolution: 'string',
    timestamp: 'date',
  }],
  
  // Metadata
  tags: ['string'], // For categorization and search
  notes: 'string', // Internal notes
  
  // Timestamps
  createdAt: 'date',
  updatedAt: 'date',
}; 