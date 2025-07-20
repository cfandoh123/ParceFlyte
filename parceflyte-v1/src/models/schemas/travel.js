// Travel schema definition for documentation and validation
export const travelSchema = {
  // Carrier information
  carrierId: {
    type: 'objectId',
    required: true,
  },
  
  // Travel details
  departureLocation: {
    city: {
      type: 'string',
      required: true,
    },
    country: {
      type: 'string',
      required: true,
    },
    airport: 'string', // Optional, for air travel
    coordinates: {
      latitude: 'number',
      longitude: 'number',
    },
  },
  
  arrivalLocation: {
    city: {
      type: 'string',
      required: true,
    },
    country: {
      type: 'string',
      required: true,
    },
    airport: 'string', // Optional, for air travel
    coordinates: {
      latitude: 'number',
      longitude: 'number',
    },
  },
  
  // Travel mode and details
  travelMode: {
    type: 'string',
    enum: ['air', 'land', 'sea', 'mixed'],
    required: true,
  },
  
  // Transportation details
  transportation: [{
    mode: {
      type: 'string',
      enum: ['plane', 'train', 'bus', 'car', 'ship', 'other'],
      required: true,
    },
    carrier: 'string', // e.g., "Delta Airlines", "Greyhound"
    departureTime: 'date',
    arrivalTime: 'date',
    departureLocation: 'string',
    arrivalLocation: 'string',
    confirmationNumber: 'string',
    ticketNumber: 'string',
  }],
  
  // Dates
  departureDate: {
    type: 'date',
    required: true,
  },
  arrivalDate: {
    type: 'date',
    required: true,
  },
  
  // Capacity and preferences
  availableCapacity: {
    weight: {
      type: 'number', // in kg
      required: true,
    },
    dimensions: {
      length: 'number', // in cm
      width: 'number',
      height: 'number',
    },
    volume: 'number', // in cubic cm
  },
  
  // Pricing
  baseDeliveryFee: {
    type: 'number',
    required: true,
  },
  currency: {
    type: 'string',
    default: 'USD',
  },
  negotiable: {
    type: 'boolean',
    default: true,
  },
  
  // Restrictions and preferences
  restrictions: {
    prohibitedItems: ['string'], // ['liquids', 'electronics', 'fragile']
    maxParcelValue: 'number', // Maximum value of parcels to carry
    insuranceRequired: {
      type: 'boolean',
      default: false,
    },
    specialHandling: ['string'], // ['temperature_controlled', 'fragile', 'urgent']
  },
  
  // Status
  status: {
    type: 'string',
    enum: ['planned', 'confirmed', 'in_progress', 'completed', 'cancelled'],
    default: 'planned',
  },
  
  // Additional information
  description: 'string',
  specialRequirements: 'string',
  
  // Verification
  isVerified: {
    type: 'boolean',
    default: false,
  },
  verificationMethod: {
    type: 'string',
    enum: ['manual', 'document_upload', 'third_party'],
  },
  
  // Tracking
  currentLocation: {
    city: 'string',
    country: 'string',
    coordinates: {
      latitude: 'number',
      longitude: 'number',
    },
    timestamp: 'date',
  },
  
  // Statistics
  totalParcels: {
    type: 'number',
    default: 0,
  },
  totalWeight: {
    type: 'number',
    default: 0,
  },
  totalValue: {
    type: 'number',
    default: 0,
  },
  
  // Timestamps
  createdAt: 'date',
  updatedAt: 'date',
}; 