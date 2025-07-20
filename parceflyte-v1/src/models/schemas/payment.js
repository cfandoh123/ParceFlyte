// Payment schema definition for documentation and validation
export const paymentSchema = {
  // Payment identification
  paymentId: {
    type: 'string',
    required: true,
    unique: true,
  },
  
  // Related entities
  parcelId: {
    type: 'objectId',
    required: true,
  },
  matchId: {
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
  
  // Payment details
  amount: {
    type: 'number',
    required: true,
  },
  currency: {
    type: 'string',
    default: 'USD',
  },
  deliveryFee: {
    type: 'number',
    required: true,
  },
  platformFee: {
    type: 'number',
    required: true,
  },
  insuranceFee: {
    type: 'number',
    default: 0,
  },
  
  // Payment method
  paymentMethod: {
    type: {
      type: 'string',
      enum: ['stripe', 'paypal', 'bank_transfer', 'crypto'],
      required: true,
    },
    accountId: 'string',
    transactionId: 'string',
  },
  
  // Payment status
  status: {
    type: 'string',
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'disputed'],
    default: 'pending',
  },
  
  // Escrow system
  escrowStatus: {
    type: 'string',
    enum: ['funded', 'released', 'refunded', 'disputed'],
    default: 'funded',
  },
  escrowReleaseDate: 'date',
  escrowReleaseConditions: [{
    type: 'string',
    enum: ['delivery_confirmed', 'time_elapsed', 'manual_release'],
  }],
  
  // Dispute handling
  dispute: {
    isDisputed: {
      type: 'boolean',
      default: false,
    },
    disputeReason: {
      type: 'string',
      enum: ['non_delivery', 'damage', 'delay', 'wrong_item', 'other'],
    },
    disputeDescription: 'string',
    disputeEvidence: ['string'], // URLs to evidence files
    disputeStatus: {
      type: 'string',
      enum: ['open', 'under_review', 'resolved', 'closed'],
    },
    disputeResolution: 'string',
    disputeResolvedBy: 'objectId',
    disputeResolvedAt: 'date',
  },
  
  // Refund information
  refund: {
    amount: 'number',
    reason: 'string',
    processedAt: 'date',
    processedBy: 'objectId',
  },
  
  // Payment processing
  processingDetails: {
    gateway: 'string',
    gatewayTransactionId: 'string',
    processingFee: 'number',
    processingTime: 'number', // in milliseconds
    errorMessage: 'string',
  },
  
  // Timestamps
  paidAt: 'date',
  releasedAt: 'date',
  refundedAt: 'date',
  
  // Metadata
  description: 'string',
  notes: 'string',
  
  // Security
  securityChecks: {
    fraudScore: 'number',
    riskLevel: {
      type: 'string',
      enum: ['low', 'medium', 'high'],
    },
    flagged: {
      type: 'boolean',
      default: false,
    },
    flagReason: 'string',
  },
  
  // Timestamps
  createdAt: 'date',
  updatedAt: 'date',
}; 