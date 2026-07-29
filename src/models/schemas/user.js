// User schema definition for documentation and validation
export const userSchema = {
  // Auth0 integration
  auth0Id: {
    type: 'string',
    required: true,
    unique: true,
  },
  email: {
    type: 'string',
    required: true,
    unique: true,
  },
  
  // Profile information
  firstName: {
    type: 'string',
    required: true,
  },
  lastName: {
    type: 'string',
    required: true,
  },
  phoneNumber: {
    type: 'string',
    required: true,
  },
  dateOfBirth: {
    type: 'date',
    required: true,
  },
  
  // Address information
  address: {
    street: 'string',
    city: 'string',
    state: 'string',
    country: 'string',
    postalCode: 'string',
  },
  
  // KYC verification
  kycStatus: {
    type: 'string',
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending',
  },
  kycDocuments: [{
    type: {
      type: 'string',
      enum: ['passport', 'drivers_license', 'national_id'],
    },
    documentNumber: 'string',
    expiryDate: 'date',
    verificationDate: 'date',
    verifiedBy: 'objectId',
  }],
  
  // User roles and preferences
  roles: [{
    type: 'string',
    enum: ['sender', 'carrier', 'admin'],
    default: ['sender'],
  }],
  
  // Carrier-specific information
  carrierProfile: {
    preferredRoutes: ['string'], // Array of route preferences
    maxParcelWeight: 'number', // in kg
    maxParcelDimensions: {
      length: 'number',
      width: 'number',
      height: 'number',
    },
    preferredParcelTypes: ['string'], // ['electronics', 'clothing', 'documents', etc.]
    baseDeliveryFee: 'number', // Default fee in USD
    currency: {
      type: 'string',
      default: 'USD',
    },
  },
  
  // Rating and trust system
  rating: {
    average: {
      type: 'number',
      default: 0,
      min: 0,
      max: 5,
    },
    totalReviews: {
      type: 'number',
      default: 0,
    },
    completedDeliveries: {
      type: 'number',
      default: 0,
    },
    successfulDeliveries: {
      type: 'number',
      default: 0,
    },
  },
  
  // Account status
  isActive: {
    type: 'boolean',
    default: true,
  },
  isVerified: {
    type: 'boolean',
    default: false,
  },
  
  // Preferences
  notifications: {
    email: {
      type: 'boolean',
      default: true,
    },
    push: {
      type: 'boolean',
      default: true,
    },
    sms: {
      type: 'boolean',
      default: false,
    },
  },
  
  // Payment information
  paymentMethods: [{
    type: {
      type: 'string',
      enum: ['stripe', 'paypal', 'bank_transfer'],
    },
    accountId: 'string',
    isDefault: {
      type: 'boolean',
      default: false,
    },
  }],
  
  // Timestamps
  createdAt: 'date',
  updatedAt: 'date',
};
