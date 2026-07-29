import { getDb, toId } from '@/lib/db';
import { withAuth, currentUser } from '@/lib/auth';
import { ok, badRequest, notFound, conflict, requireFields } from '@/lib/api';
import { assessRisk, nextKycId } from '@/lib/kyc-service';

/** The caller's own KYC application, if they have one. */
export const GET = withAuth(['read:users'], async (req, { user }) => {
  const db = await getDb();
  const profile = await currentUser(db, user);
  if (!profile) return notFound('User not found');

  const { searchParams } = new URL(req.url);
  const kycId = searchParams.get('kycId');

  const application = kycId
    ? await db.collection('kyc').findOne({ kycId })
    : await db.collection('kyc').findOne({ userId: profile._id });

  return ok({ kyc: application || null, kycStatus: profile.kycStatus });
});

/** Submit a new KYC application. */
export const POST = withAuth(['write:users'], async (req, { user }) => {
  const db = await getDb();
  const profile = await currentUser(db, user);
  if (!profile) return notFound('User not found');

  const body = await req.json();
  const missing = requireFields(body, [
    'personalInfo.firstName',
    'personalInfo.lastName',
    'personalInfo.dateOfBirth',
    'personalInfo.nationality',
    'address.currentAddress.city',
    'address.currentAddress.country',
    'contactInfo.phoneNumber',
  ]);
  if (missing) return missing;

  const existing = await db.collection('kyc').findOne({ userId: profile._id });
  if (existing && ['pending', 'in_review', 'approved'].includes(existing.verificationProcess?.status)) {
    return conflict('You already have a KYC application in progress', { kycId: existing.kycId });
  }

  const dob = new Date(body.personalInfo.dateOfBirth);
  if (Number.isNaN(dob.getTime())) return badRequest('dateOfBirth must be a valid date');
  const age = (Date.now() - dob.getTime()) / (365.25 * 86400000);
  if (age < 18) return badRequest('You must be at least 18 to use ParceFlyte');

  const now = new Date();
  const count = await db.collection('kyc').countDocuments({});

  const application = {
    kycId: nextKycId(count),
    userId: profile._id,
    personalInfo: { ...body.personalInfo, dateOfBirth: dob },
    address: body.address,
    contactInfo: { ...body.contactInfo, email: body.contactInfo?.email || profile.email },
    identityDocuments: [],
    employment: body.employment || {},
    financialInfo: body.financialInfo || {},
    verificationProcess: { status: 'pending', submittedAt: now },
    riskAssessment: null,
    compliance: {},
    documentVerification: {},
    communicationHistory: [],
    auditTrail: [{ action: 'submitted', timestamp: now, actor: profile._id }],
    createdAt: now,
    updatedAt: now,
  };

  // Initial risk read happens on submission, before any documents arrive.
  application.riskAssessment = assessRisk({ application, user: profile, parcels: [] });

  const result = await db.collection('kyc').insertOne(application);
  const created = await db.collection('kyc').findOne({ _id: toId(result.insertedId) });

  return ok(
    { message: 'KYC application submitted — upload your documents to continue', kyc: created },
    { status: 201 }
  );
});

/** Update an application that has not been approved yet. */
export const PUT = withAuth(['write:users'], async (req, { user }) => {
  const db = await getDb();
  const profile = await currentUser(db, user);
  if (!profile) return notFound('User not found');

  const body = await req.json();
  const application = body.kycId
    ? await db.collection('kyc').findOne({ kycId: body.kycId })
    : await db.collection('kyc').findOne({ userId: profile._id });

  if (!application) return notFound('KYC application not found');
  if (application.verificationProcess?.status === 'approved') {
    return badRequest('An approved application cannot be edited');
  }

  const editable = ['personalInfo', 'address', 'contactInfo', 'employment', 'financialInfo'];
  const updates = Object.fromEntries(Object.entries(body).filter(([key]) => editable.includes(key)));
  if (!Object.keys(updates).length) return badRequest('No editable fields supplied');

  const now = new Date();
  await db.collection('kyc').updateOne(
    { _id: application._id },
    {
      $set: { ...updates, updatedAt: now },
      $push: { auditTrail: { action: 'updated', timestamp: now, actor: profile._id } },
    }
  );

  const updated = await db.collection('kyc').findOne({ _id: application._id });
  return ok({ message: 'KYC application updated', kyc: updated });
});
