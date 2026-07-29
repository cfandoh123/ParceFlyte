import { getDb } from '@/lib/db';
import { withAuth, currentUser } from '@/lib/auth';
import { ok, badRequest, notFound, requireFields } from '@/lib/api';

const DOCUMENT_TYPES = ['passport', 'drivers_license', 'national_id', 'birth_certificate', 'utility_bill'];
const IMAGE_TYPES = ['front', 'back', 'selfie_with_document'];

/** Which images each document type requires before it can be verified. */
const REQUIRED_IMAGES = {
  passport: ['front', 'selfie_with_document'],
  drivers_license: ['front', 'back', 'selfie_with_document'],
  national_id: ['front', 'back', 'selfie_with_document'],
  birth_certificate: ['front'],
  utility_bill: ['front'],
};

async function loadApplication(db, profile, kycId) {
  return kycId
    ? db.collection('kyc').findOne({ kycId })
    : db.collection('kyc').findOne({ userId: profile._id });
}

/** Upload an identity document and its images. */
export const POST = withAuth(['write:users'], async (req, { user }) => {
  const db = await getDb();
  const profile = await currentUser(db, user);
  if (!profile) return notFound('User not found');

  const body = await req.json();
  const missing = requireFields(body, ['documentType', 'documentNumber', 'issuingCountry']);
  if (missing) return missing;

  if (!DOCUMENT_TYPES.includes(body.documentType)) {
    return badRequest(`documentType must be one of: ${DOCUMENT_TYPES.join(', ')}`);
  }

  const application = await loadApplication(db, profile, body.kycId);
  if (!application) return notFound('Submit your KYC application before uploading documents');
  if (application.verificationProcess?.status === 'approved') {
    return badRequest('This application is already approved');
  }

  const images = Array.isArray(body.documentImages) ? body.documentImages : [];
  const invalid = images.filter((img) => !IMAGE_TYPES.includes(img.type));
  if (invalid.length) return badRequest(`Image type must be one of: ${IMAGE_TYPES.join(', ')}`);

  const required = REQUIRED_IMAGES[body.documentType];
  const provided = images.map((img) => img.type);
  const stillNeeded = required.filter((type) => !provided.includes(type));
  if (stillNeeded.length) {
    return badRequest(`A ${body.documentType.replace('_', ' ')} needs: ${stillNeeded.join(', ')}`, {
      required,
      provided,
    });
  }

  const expiryDate = body.expiryDate ? new Date(body.expiryDate) : null;
  if (expiryDate && expiryDate < new Date()) return badRequest('This document has expired');

  const now = new Date();
  const document = {
    documentType: body.documentType,
    documentNumber: body.documentNumber,
    issuingCountry: body.issuingCountry,
    issueDate: body.issueDate ? new Date(body.issueDate) : null,
    expiryDate,
    documentImages: images.map((img) => ({
      type: img.type,
      // In production this is the object-storage key returned by the upload.
      imageUrl: img.imageUrl || `/demo/doc-${img.type}.png`,
      fileName: img.fileName || null,
      uploadedAt: now,
      verificationMethod: 'ai',
    })),
    verificationStatus: 'pending',
    uploadedAt: now,
  };

  await db.collection('kyc').updateOne(
    { _id: application._id },
    {
      $set: { updatedAt: now },
      $push: {
        identityDocuments: document,
        auditTrail: { action: 'document_uploaded', timestamp: now, actor: profile._id },
      },
    }
  );

  const updated = await db.collection('kyc').findOne({ _id: application._id });
  return ok({ message: 'Document uploaded — run verification to continue', kyc: updated }, { status: 201 });
});

/** Verification status of each uploaded document. */
export const GET = withAuth(['read:users'], async (req, { user }) => {
  const db = await getDb();
  const profile = await currentUser(db, user);
  if (!profile) return notFound('User not found');

  const { searchParams } = new URL(req.url);
  const application = await loadApplication(db, profile, searchParams.get('kycId'));
  if (!application) return notFound('KYC application not found');

  return ok({
    kycId: application.kycId,
    documents: (application.identityDocuments || []).map((doc) => ({
      documentType: doc.documentType,
      documentNumber: doc.documentNumber?.replace(/.(?=.{4})/g, '•'),
      issuingCountry: doc.issuingCountry,
      expiryDate: doc.expiryDate,
      verificationStatus: doc.verificationStatus,
      images: (doc.documentImages || []).map((img) => ({ type: img.type, uploadedAt: img.uploadedAt })),
      required: REQUIRED_IMAGES[doc.documentType] || [],
    })),
    documentVerification: application.documentVerification || {},
  });
});
