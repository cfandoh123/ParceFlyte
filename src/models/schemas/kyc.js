// KYC schema definition for documentation and validation
export const kycSchema = {
  // KYC identification
  kycId: {
    type: 'string',
    required: true,
    unique: true,
  },
  
  // User reference
  userId: {
    type: 'objectId',
    required: true,
  },
  
  // Personal information
  personalInfo: {
    firstName: {
      type: 'string',
      required: true,
    },
    lastName: {
      type: 'string',
      required: true,
    },
    middleName: 'string',
    dateOfBirth: {
      type: 'date',
      required: true,
    },
    nationality: {
      type: 'string',
      required: true,
    },
    gender: {
      type: 'string',
      enum: ['male', 'female', 'other', 'prefer_not_to_say'],
    },
  },
  
  // Address information
  address: {
    currentAddress: {
      street: {
        type: 'string',
        required: true,
      },
      city: {
        type: 'string',
        required: true,
      },
      state: {
        type: 'string',
        required: true,
      },
      country: {
        type: 'string',
        required: true,
      },
      postalCode: {
        type: 'string',
        required: true,
      },
      coordinates: {
        latitude: 'number',
        longitude: 'number',
      },
    },
    previousAddresses: [{
      street: 'string',
      city: 'string',
      state: 'string',
      country: 'string',
      postalCode: 'string',
      startDate: 'date',
      endDate: 'date',
    }],
  },
  
  // Contact information
  contactInfo: {
    phoneNumber: {
      type: 'string',
      required: true,
    },
    email: {
      type: 'string',
      required: true,
    },
    emergencyContact: {
      name: 'string',
      relationship: 'string',
      phoneNumber: 'string',
      email: 'string',
    },
  },
  
  // Identity documents
  identityDocuments: [{
    documentType: {
      type: 'string',
      enum: ['passport', 'drivers_license', 'national_id', 'birth_certificate', 'utility_bill'],
      required: true,
    },
    documentNumber: {
      type: 'string',
      required: true,
    },
    issuingCountry: {
      type: 'string',
      required: true,
    },
    issuingAuthority: 'string',
    issueDate: {
      type: 'date',
      required: true,
    },
    expiryDate: {
      type: 'date',
      required: true,
    },
    documentImages: [{
      type: {
        type: 'string',
        enum: ['front', 'back', 'selfie_with_document'],
        required: true,
      },
      imageUrl: {
        type: 'string',
        required: true,
      },
      uploadedAt: 'date',
      verifiedAt: 'date',
      verificationMethod: {
        type: 'string',
        enum: ['manual', 'ai', 'third_party'],
      },
    }],
    verificationStatus: {
      type: 'string',
      enum: ['pending', 'verified', 'rejected', 'expired'],
      default: 'pending',
    },
    verificationNotes: 'string',
  }],
  
  // Employment and income information
  employment: {
    employmentStatus: {
      type: 'string',
      enum: ['employed', 'self_employed', 'unemployed', 'student', 'retired'],
    },
    employer: {
      name: 'string',
      address: 'string',
      phoneNumber: 'string',
      email: 'string',
    },
    jobTitle: 'string',
    employmentStartDate: 'date',
    monthlyIncome: {
      amount: 'number',
      currency: {
        type: 'string',
        default: 'USD',
      },
    },
  },
  
  // Financial information
  financialInfo: {
    bankAccounts: [{
      bankName: 'string',
      accountType: {
        type: 'string',
        enum: ['checking', 'savings', 'business'],
      },
      accountNumber: 'string', // Last 4 digits only
      routingNumber: 'string',
      isVerified: {
        type: 'boolean',
        default: false,
      },
    }],
    creditCards: [{
      cardType: {
        type: 'string',
        enum: ['visa', 'mastercard', 'amex', 'discover'],
      },
      lastFourDigits: 'string',
      expiryDate: 'date',
      isVerified: {
        type: 'boolean',
        default: false,
      },
    }],
  },
  
  // Verification process
  verificationProcess: {
    status: {
      type: 'string',
      enum: ['pending', 'in_review', 'approved', 'rejected', 'requires_additional_info'],
      default: 'pending',
    },
    submittedAt: 'date',
    reviewedAt: 'date',
    reviewedBy: 'objectId',
    approvedAt: 'date',
    approvedBy: 'objectId',
    rejectionReason: 'string',
    rejectionDetails: 'string',
    requiresAdditionalInfo: {
      type: 'boolean',
      default: false,
    },
    additionalInfoRequested: 'string',
  },
  
  // Risk assessment
  riskAssessment: {
    riskScore: {
      type: 'number',
      min: 0,
      max: 100,
    },
    riskLevel: {
      type: 'string',
      enum: ['low', 'medium', 'high', 'very_high'],
    },
    riskFactors: [{
      factor: {
        type: 'string',
        enum: ['new_user', 'high_value_transactions', 'international_transfers', 'suspicious_activity', 'document_issues'],
      },
      description: 'string',
      severity: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
      },
    }],
    flagged: {
      type: 'boolean',
      default: false,
    },
    flagReason: 'string',
    flagDate: 'date',
    flagResolvedAt: 'date',
  },
  
  // Compliance and regulatory
  compliance: {
    pepCheck: {
      isPEP: {
        type: 'boolean',
        default: false,
      },
      pepDetails: 'string',
      checkedAt: 'date',
    },
    sanctionsCheck: {
      isSanctioned: {
        type: 'boolean',
        default: false,
      },
      sanctionsDetails: 'string',
      checkedAt: 'date',
    },
    amlCheck: {
      riskLevel: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
      },
      checkedAt: 'date',
    },
  },
  
  // Document verification
  documentVerification: {
    faceMatch: {
      score: 'number',
      threshold: 'number',
      isVerified: 'boolean',
      verifiedAt: 'date',
    },
    documentAuthenticity: {
      score: 'number',
      threshold: 'number',
      isVerified: 'boolean',
      verifiedAt: 'date',
    },
    livenessCheck: {
      score: 'number',
      threshold: 'number',
      isVerified: 'boolean',
      verifiedAt: 'date',
    },
  },
  
  // Communication history
  communicationHistory: [{
    type: {
      type: 'string',
      enum: ['email', 'sms', 'in_app', 'phone'],
    },
    subject: 'string',
    message: 'string',
    sentAt: 'date',
    readAt: 'date',
    response: 'string',
    respondedAt: 'date',
  }],
  
  // Audit trail
  auditTrail: [{
    action: {
      type: 'string',
      enum: ['submitted', 'reviewed', 'approved', 'rejected', 'updated', 'document_uploaded'],
    },
    performedBy: 'objectId',
    performedAt: 'date',
    details: 'string',
    ipAddress: 'string',
    userAgent: 'string',
  }],
  
  // Expiration and renewal
  expiration: {
    expiresAt: 'date',
    renewalReminderSent: {
      type: 'boolean',
      default: false,
    },
    renewalReminderSentAt: 'date',
    autoRenewal: {
      type: 'boolean',
      default: false,
    },
  },
  
  // Timestamps
  createdAt: 'date',
  updatedAt: 'date',
}; 