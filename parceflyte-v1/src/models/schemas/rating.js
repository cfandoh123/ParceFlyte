// Rating schema definition for documentation and validation
export const ratingSchema = {
  // Rating identification
  ratingId: {
    type: 'string',
    required: true,
    unique: true,
  },
  
  // Related entities
  parcelId: {
    type: 'objectId',
    required: true,
  },
  reviewerId: {
    type: 'objectId',
    required: true,
  },
  reviewedId: {
    type: 'objectId',
    required: true,
  },
  
  // Rating details
  overallRating: {
    type: 'number',
    required: true,
    min: 1,
    max: 5,
  },
  
  // Detailed ratings
  detailedRatings: {
    communication: {
      type: 'number',
      min: 1,
      max: 5,
    },
    reliability: {
      type: 'number',
      min: 1,
      max: 5,
    },
    punctuality: {
      type: 'number',
      min: 1,
      max: 5,
    },
    care: {
      type: 'number',
      min: 1,
      max: 5,
    },
    professionalism: {
      type: 'number',
      min: 1,
      max: 5,
    },
  },
  
  // Review content
  review: {
    title: 'string',
    content: {
      type: 'string',
      required: true,
      maxlength: 1000,
    },
    photos: ['string'], // URLs to photos
    isPublic: {
      type: 'boolean',
      default: true,
    },
  },
  
  // Rating context
  ratingType: {
    type: 'string',
    enum: ['sender_to_carrier', 'carrier_to_sender'],
    required: true,
  },
  
  // Rating status
  status: {
    type: 'string',
    enum: ['pending', 'published', 'flagged', 'removed'],
    default: 'pending',
  },
  
  // Moderation
  moderation: {
    isFlagged: {
      type: 'boolean',
      default: false,
    },
    flagReason: {
      type: 'string',
      enum: ['inappropriate', 'spam', 'fake', 'harassment', 'other'],
    },
    flaggedBy: 'objectId',
    flaggedAt: 'date',
    reviewedBy: 'objectId',
    reviewedAt: 'date',
    moderationNotes: 'string',
  },
  
  // Helpful votes
  helpfulVotes: {
    helpful: {
      type: 'number',
      default: 0,
    },
    notHelpful: {
      type: 'number',
      default: 0,
    },
    voters: [{
      userId: 'objectId',
      vote: {
        type: 'string',
        enum: ['helpful', 'not_helpful'],
      },
      timestamp: 'date',
    }],
  },
  
  // Response to review
  response: {
    content: 'string',
    respondedBy: 'objectId',
    respondedAt: 'date',
  },
  
  // Metadata
  tags: ['string'], // For categorization
  language: {
    type: 'string',
    default: 'en',
  },
  
  // Timestamps
  publishedAt: 'date',
  updatedAt: 'date',
  createdAt: 'date',
}; 