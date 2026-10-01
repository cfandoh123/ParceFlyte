/**
 * The indexes the app's hot queries and uniqueness rules depend on.
 *
 * Applied automatically the first time the app connects to MongoDB, and by
 * `npm run seed` / `npm run db:init`. Creating an index that already exists is
 * a no-op, so this is safe to run on every cold start.
 */

export const INDEXES = {
  users: [
    [{ auth0Id: 1 }, { unique: true }],
    // Unique among accounts that have an email; some sign-in methods supply none.
    [{ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } }],
    [{ roles: 1, kycStatus: 1 }],
  ],
  travels: [
    [{ status: 1, departureDate: 1 }],
    [{ 'departureLocation.city': 1, 'arrivalLocation.city': 1 }],
    [{ carrierId: 1 }],
  ],
  parcels: [[{ senderId: 1, status: 1 }], [{ deliveryDeadline: 1 }], [{ matchedCarrierId: 1 }]],
  matches: [[{ parcelId: 1, travelId: 1 }], [{ senderId: 1, status: 1 }], [{ carrierId: 1, status: 1 }]],
  payments: [[{ matchId: 1 }, { unique: true }], [{ escrowStatus: 1 }]],
  ratings: [[{ reviewedId: 1, status: 1 }], [{ parcelId: 1, reviewerId: 1, ratingType: 1 }, { unique: true }]],
  kyc: [[{ userId: 1 }], [{ kycId: 1 }, { unique: true }], [{ 'verificationProcess.status': 1 }]],
};

export async function ensureIndexes(db) {
  for (const [name, specs] of Object.entries(INDEXES)) {
    for (const [keys, options] of specs) {
      await db.collection(name).createIndex(keys, options || {});
    }
  }
}
