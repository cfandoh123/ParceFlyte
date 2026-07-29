import { getDb, toId } from '@/lib/db';
import { withAuth, currentUser } from '@/lib/auth';
import { ok, badRequest, notFound, pagination, paginated, requireFields } from '@/lib/api';
import { riskLevel } from '@/lib/kyc-service';

/**
 * Admin KYC queue.
 *
 * `?status=statistics` returns the dashboard counters; otherwise this is a
 * paginated review queue, ordered so the riskiest applications surface first.
 */
export const GET = withAuth(['read:users'], async (req) => {
  const db = await getDb();
  const { searchParams } = new URL(req.url);

  if (searchParams.get('status') === 'statistics') {
    const all = await db.collection('kyc').find({}).toArray();
    const byStatus = (status) => all.filter((k) => k.verificationProcess?.status === status).length;
    const byRisk = (level) => all.filter((k) => k.riskAssessment?.riskLevel === level).length;

    const reviewed = all.filter((k) => k.verificationProcess?.reviewedAt && k.verificationProcess?.submittedAt);
    const avgHours = reviewed.length
      ? Math.round(
          reviewed.reduce(
            (sum, k) =>
              sum +
              (new Date(k.verificationProcess.reviewedAt) - new Date(k.verificationProcess.submittedAt)) / 3600000,
            0
          ) / reviewed.length
        )
      : 0;

    const decided = byStatus('approved') + byStatus('rejected');

    return ok({
      statistics: {
        total: all.length,
        pending: byStatus('pending'),
        inReview: byStatus('in_review'),
        approved: byStatus('approved'),
        rejected: byStatus('rejected'),
        requiresInfo: byStatus('requires_additional_info'),
        flagged: all.filter((k) => k.riskAssessment?.flagged).length,
        riskDistribution: {
          low: byRisk('low'),
          medium: byRisk('medium'),
          high: byRisk('high'),
          very_high: byRisk('very_high'),
        },
        approvalRate: decided ? Math.round((byStatus('approved') / decided) * 100) : 0,
        averageReviewHours: avgHours,
      },
    });
  }

  const { page, limit, skip } = pagination(searchParams);
  const query = {};
  const status = searchParams.get('status');
  if (status) query['verificationProcess.status'] = status;
  if (searchParams.get('flagged') === 'true') query['riskAssessment.flagged'] = true;
  if (searchParams.get('riskLevel')) query['riskAssessment.riskLevel'] = searchParams.get('riskLevel');

  const [applications, total] = await Promise.all([
    db
      .collection('kyc')
      .find(query)
      .sort({ 'riskAssessment.riskScore': -1, createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    db.collection('kyc').countDocuments(query),
  ]);

  const userIds = [...new Set(applications.map((a) => String(a.userId)))];
  const users = userIds.length
    ? await db.collection('users').find({ _id: { $in: userIds.map(toId) } }).toArray()
    : [];
  const userMap = Object.fromEntries(users.map((u) => [String(u._id), u]));

  const withUser = applications.map((a) => ({ ...a, user: userMap[String(a.userId)] || null }));
  return ok(paginated(withUser, total, { page, limit }));
});

/** Record an admin decision on an application. */
export const POST = withAuth(['write:users'], async (req, { user }) => {
  const db = await getDb();
  const body = await req.json();

  const missing = requireFields(body, ['kycId', 'decision']);
  if (missing) return missing;

  const decisions = { approve: 'approved', reject: 'rejected', request_info: 'requires_additional_info' };
  if (!decisions[body.decision]) {
    return badRequest(`decision must be one of: ${Object.keys(decisions).join(', ')}`);
  }
  if (body.decision === 'reject' && !body.reason) {
    return badRequest('A reason is required when rejecting an application');
  }

  const application = await db.collection('kyc').findOne({ kycId: body.kycId });
  if (!application) return notFound('KYC application not found');
  if (application.verificationProcess?.status === 'approved') {
    return badRequest('This application is already approved');
  }

  const reviewer = await currentUser(db, user);
  const status = decisions[body.decision];
  const now = new Date();

  await db.collection('kyc').updateOne(
    { _id: application._id },
    {
      $set: {
        'verificationProcess.status': status,
        'verificationProcess.reviewedAt': now,
        'verificationProcess.reviewedBy': reviewer?._id || 'admin',
        'verificationProcess.reviewNotes': body.notes || '',
        ...(status === 'approved' ? { 'verificationProcess.approvedAt': now } : {}),
        ...(status === 'rejected' ? { 'verificationProcess.rejectionReason': body.reason } : {}),
        updatedAt: now,
      },
      $push: {
        auditTrail: {
          action: body.decision === 'approve' ? 'approved' : body.decision === 'reject' ? 'rejected' : 'reviewed',
          timestamp: now,
          actor: reviewer?._id || 'admin',
          note: body.notes || body.reason || '',
        },
        communicationHistory: {
          channel: 'email',
          subject: `Your ParceFlyte verification is ${status.replace(/_/g, ' ')}`,
          sentAt: now,
        },
      },
    }
  );

  // The user's headline KYC status mirrors the decision.
  const userStatus = { approved: 'verified', rejected: 'rejected', requires_additional_info: 'pending' }[status];
  await db.collection('users').updateOne(
    { _id: toId(application.userId) },
    { $set: { kycStatus: userStatus, updatedAt: now } }
  );

  const updated = await db.collection('kyc').findOne({ _id: application._id });
  return ok({ message: `Application ${status.replace(/_/g, ' ')}`, kyc: updated });
});

/** Manually override an application's risk assessment. */
export const PUT = withAuth(['write:users'], async (req, { user }) => {
  const db = await getDb();
  const body = await req.json();

  const missing = requireFields(body, ['kycId', 'riskScore']);
  if (missing) return missing;

  const score = Number(body.riskScore);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    return badRequest('riskScore must be a number between 0 and 100');
  }

  const application = await db.collection('kyc').findOne({ kycId: body.kycId });
  if (!application) return notFound('KYC application not found');

  const reviewer = await currentUser(db, user);
  const now = new Date();

  await db.collection('kyc').updateOne(
    { _id: application._id },
    {
      $set: {
        'riskAssessment.riskScore': score,
        'riskAssessment.riskLevel': riskLevel(score),
        'riskAssessment.flagged': score >= 35,
        'riskAssessment.manualOverride': { by: reviewer?._id || 'admin', at: now, note: body.notes || '' },
        updatedAt: now,
      },
      $push: {
        auditTrail: {
          action: 'updated',
          timestamp: now,
          actor: reviewer?._id || 'admin',
          note: `Risk score manually set to ${score}`,
        },
      },
    }
  );

  const updated = await db.collection('kyc').findOne({ _id: application._id });
  return ok({ message: 'Risk assessment updated', kyc: updated });
});
