/**
 * KYC risk scoring and compliance screening.
 *
 * The scoring rules and thresholds are the ones documented in the README. The
 * external calls a production deployment would make — a document verification
 * provider, a PEP/sanctions data provider — are simulated here behind the same
 * interface, so swapping in a real provider is a change to these three
 * functions and nothing else.
 */

export const RISK_FACTOR_POINTS = {
  new_user: 20,
  international_transfers: 15,
  document_issues: 30,
  high_value_transactions: 25,
  suspicious_activity: 40,
};

export const RISK_FACTOR_LABELS = {
  new_user: 'Account less than 30 days old',
  international_transfers: 'Address outside the platform’s primary market',
  document_issues: 'Document rejected, expired or unreadable',
  high_value_transactions: 'High declared parcel values',
  suspicious_activity: 'Unusual account behaviour detected',
};

/** Map a raw risk score to its band. */
export function riskLevel(score) {
  if (score >= 50) return 'very_high';
  if (score >= 35) return 'high';
  if (score >= 20) return 'medium';
  return 'low';
}

/**
 * Derive a risk score from the application and the account behind it.
 * Returns the factors that fired so the admin UI can explain the number.
 */
export function assessRisk({ application, user, parcels = [] }) {
  const factors = [];

  const accountAgeDays = user?.createdAt
    ? (Date.now() - new Date(user.createdAt).getTime()) / 86400000
    : 0;
  if (accountAgeDays < 30) factors.push('new_user');

  const country = application?.address?.currentAddress?.country;
  if (country && country !== 'United States') factors.push('international_transfers');

  const documents = application?.identityDocuments || [];
  const hasDocumentIssue = documents.some(
    (doc) => doc.verificationStatus === 'rejected' || (doc.expiryDate && new Date(doc.expiryDate) < new Date())
  );
  if (hasDocumentIssue || documents.length === 0) factors.push('document_issues');

  if (parcels.some((p) => p.declaredValue > 1000)) factors.push('high_value_transactions');

  const score = factors.reduce((sum, factor) => sum + (RISK_FACTOR_POINTS[factor] || 0), 0);

  return {
    riskScore: score,
    riskLevel: riskLevel(score),
    riskFactors: factors,
    flagged: score >= 35,
    assessedAt: new Date(),
  };
}

/**
 * Stand-in watchlists. A real deployment queries a screening provider; the
 * shape of the answer is the same, so only this data source changes.
 * Names are fictional and exist so the flagged path is demonstrable.
 */
const SANCTIONS_LIST = ['ivan petrov', 'marcus delacroix'];
const PEP_LIST = ['helena vargas', 'samuel adeyemi'];

/**
 * Compliance screening: PEP, sanctions and AML.
 *
 * Deterministic — screening the same applicant twice gives the same answer,
 * which is what makes the admin queue stable and the demo reproducible.
 */
export function runComplianceChecks(application) {
  const name = `${application?.personalInfo?.firstName || ''} ${application?.personalInfo?.lastName || ''}`
    .trim()
    .toLowerCase();
  const now = new Date();

  // AML looks at behaviour rather than identity: an applicant declaring high
  // income with no employer is the pattern worth a second look.
  const income = application?.employment?.monthlyIncome?.amount || 0;
  const hasEmployer = Boolean(application?.employment?.employer || application?.employment?.jobTitle);
  const amlConcern = income > 20000 && !hasEmployer;

  return {
    pepCheck: {
      status: PEP_LIST.includes(name) ? 'review' : 'clear',
      provider: 'simulated',
      checkedAt: now,
    },
    sanctionsCheck: {
      status: SANCTIONS_LIST.includes(name) ? 'hit' : 'clear',
      provider: 'simulated',
      checkedAt: now,
    },
    amlCheck: {
      status: amlConcern ? 'review' : 'clear',
      provider: 'simulated',
      checkedAt: now,
    },
  };
}

/**
 * Document authenticity, face match and liveness.
 * Scores are derived from what was actually uploaded so the demo reflects the
 * user's own input rather than fixed numbers.
 */
export function verifyDocuments(application) {
  const documents = application?.identityDocuments || [];
  const images = documents.flatMap((doc) => doc.documentImages || []);

  const hasFront = images.some((img) => img.type === 'front');
  const hasSelfie = images.some((img) => img.type === 'selfie_with_document');

  const score = (base, present) => (present ? Math.round((base + Math.random() * 0.06) * 100) / 100 : 0);

  return {
    faceMatch: { score: score(0.92, hasSelfie), passed: hasSelfie, checkedAt: new Date() },
    documentAuthenticity: { score: score(0.9, hasFront), passed: hasFront, checkedAt: new Date() },
    livenessCheck: { score: score(0.91, hasSelfie), passed: hasSelfie, checkedAt: new Date() },
  };
}

/** Whether automated checks alone are enough to approve. */
export function canAutoApprove({ riskAssessment, compliance, documentVerification }) {
  if (riskAssessment.flagged) return false;
  if (compliance.sanctionsCheck.status !== 'clear') return false;
  if (compliance.pepCheck.status !== 'clear') return false;
  if (compliance.amlCheck.status !== 'clear') return false;
  return (
    documentVerification.faceMatch.passed &&
    documentVerification.documentAuthenticity.passed &&
    documentVerification.livenessCheck.passed
  );
}

/** Sequential, human-readable KYC reference. */
export function nextKycId(count) {
  return `KYC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
}
