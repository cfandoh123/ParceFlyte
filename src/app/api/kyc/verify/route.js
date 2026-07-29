import { getDb, toId } from '@/lib/db';
import { withAuth, currentUser } from '@/lib/auth';
import { ok, badRequest, notFound } from '@/lib/api';
import { assessRisk, runComplianceChecks, verifyDocuments, canAutoApprove } from '@/lib/kyc-service';

async function loadApplication(db, profile, kycId) {
  return kycId
    ? db.collection('kyc').findOne({ kycId })
    : db.collection('kyc').findOne({ userId: profile._id });
}

/**
 * Run the automated verification pass: risk scoring, compliance screening and
 * document checks. Clean applications are approved automatically; anything
 * flagged is routed to the admin review queue.
 */
export const POST = withAuth(['write:users'], async (req, { user }) => {
  const db = await getDb();
  const profile = await currentUser(db, user);
  if (!profile) return notFound('User not found');

  const body = await req.json().catch(() => ({}));
  const application = await loadApplication(db, profile, body.kycId);
  if (!application) return notFound('KYC application not found');

  if (application.verificationProcess?.status === 'approved') {
    return badRequest('This application is already approved');
  }
  if (!application.identityDocuments?.length) {
    return badRequest('Upload at least one identity document before running verification');
  }

  const owner = await db.collection('users').findOne({ _id: toId(application.userId) });
  const parcels = await db.collection('parcels').find({ senderId: toId(application.userId) }).toArray();

  const compliance = runComplianceChecks(application);
  const documentVerification = verifyDocuments(application);
  const riskAssessment = assessRisk({ application, user: owner, parcels });

  const autoApproved = canAutoApprove({ riskAssessment, compliance, documentVerification });
  const status = autoApproved ? 'approved' : 'in_review';
  const now = new Date();

  const documents = (application.identityDocuments || []).map((doc) => ({
    ...doc,
    verificationStatus: autoApproved ? 'verified' : doc.verificationStatus,
  }));

  await db.collection('kyc').updateOne(
    { _id: application._id },
    {
      $set: {
        compliance,
        documentVerification,
        riskAssessment,
        identityDocuments: documents,
        'verificationProcess.status': status,
        'verificationProcess.reviewedAt': now,
        ...(autoApproved ? { 'verificationProcess.approvedAt': now } : {}),
        updatedAt: now,
      },
      $push: {
        auditTrail: {
          action: autoApproved ? 'approved' : 'reviewed',
          timestamp: now,
          actor: 'system',
          note: autoApproved ? 'Auto-approved by automated checks' : 'Routed to manual review',
        },
      },
    }
  );

  if (autoApproved) {
    await db.collection('users').updateOne(
      { _id: toId(application.userId) },
      { $set: { kycStatus: 'verified', updatedAt: now } }
    );
  }

  const updated = await db.collection('kyc').findOne({ _id: application._id });

  return ok({
    message: autoApproved
      ? 'Verification passed — your account is now verified'
      : 'Verification complete — your application is queued for manual review',
    autoApproved,
    kyc: updated,
    results: { riskAssessment, compliance, documentVerification },
  });
});

/** Current verification status and results. */
export const GET = withAuth(['read:users'], async (req, { user }) => {
  const db = await getDb();
  const profile = await currentUser(db, user);
  if (!profile) return notFound('User not found');

  const { searchParams } = new URL(req.url);
  const application = await loadApplication(db, profile, searchParams.get('kycId'));
  if (!application) return notFound('KYC application not found');

  return ok({
    kycId: application.kycId,
    status: application.verificationProcess?.status,
    submittedAt: application.verificationProcess?.submittedAt,
    reviewedAt: application.verificationProcess?.reviewedAt,
    approvedAt: application.verificationProcess?.approvedAt,
    rejectionReason: application.verificationProcess?.rejectionReason,
    riskAssessment: application.riskAssessment,
    compliance: application.compliance,
    documentVerification: application.documentVerification,
    auditTrail: application.auditTrail,
  });
});
