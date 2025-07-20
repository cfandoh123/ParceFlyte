import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert } from './ui/alert';

export default function AdminKYCReviewModal({ application, onClose, onAction }) {
  const [action, setAction] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  if (!application) return null;

  const handleReview = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kycId: application.kycId,
          status: action,
          notes: notes,
          rejectionReason: action === 'rejected' ? notes : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Review failed');
      onAction?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!application} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>KYC Review: {application.personalInfo?.firstName} {application.personalInfo?.lastName}</DialogTitle>
          <DialogDescription>KYC ID: {application.kycId}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Status and Risk */}
          <div className="flex gap-4 items-center">
            <Badge variant="secondary">{application.verificationProcess?.status}</Badge>
            <Badge variant={application.riskAssessment?.riskLevel === 'high' ? 'destructive' : application.riskAssessment?.riskLevel === 'medium' ? 'warning' : 'success'}>
              Risk: {application.riskAssessment?.riskLevel || 'low'}
            </Badge>
          </div>
          {/* Personal Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="font-semibold mb-2">Personal Information</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="font-medium">Name:</span> {application.personalInfo?.firstName} {application.personalInfo?.lastName}</div>
              <div><span className="font-medium">DOB:</span> {application.personalInfo?.dateOfBirth}</div>
              <div><span className="font-medium">Nationality:</span> {application.personalInfo?.nationality}</div>
              <div><span className="font-medium">Gender:</span> {application.personalInfo?.gender}</div>
              <div><span className="font-medium">Phone:</span> {application.contactInfo?.phoneNumber}</div>
              <div><span className="font-medium">Email:</span> {application.contactInfo?.email}</div>
            </div>
          </div>
          {/* Address */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="font-semibold mb-2">Address</div>
            <div className="text-sm">
              {application.address?.currentAddress?.street}, {application.address?.currentAddress?.city}, {application.address?.currentAddress?.state}, {application.address?.currentAddress?.country} {application.address?.currentAddress?.postalCode}
            </div>
          </div>
          {/* Documents */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="font-semibold mb-2">Documents</div>
            {(!application.identityDocuments || application.identityDocuments.length === 0) ? (
              <div className="text-sm text-gray-500">No documents uploaded.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {application.identityDocuments.map((doc, i) => (
                  <div key={i} className="border rounded p-2">
                    <div className="font-medium mb-1">{doc.documentType}</div>
                    <div className="text-xs text-gray-500 mb-1">Status: {doc.verificationStatus}</div>
                    <div className="flex gap-2 flex-wrap">
                      {doc.documentImages && doc.documentImages.map((img, j) => (
                        <div key={j} className="w-24 h-24 border rounded overflow-hidden flex flex-col items-center justify-center">
                          <img src={img.imageUrl} alt={img.type} className="object-cover w-full h-full" />
                          <span className="text-xs text-gray-600">{img.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Risk/Compliance */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="font-semibold mb-2">Risk & Compliance</div>
            <div className="text-sm mb-1">Risk Score: {application.riskAssessment?.riskScore}</div>
            <div className="text-sm mb-1">Risk Factors: {application.riskAssessment?.riskFactors?.map(f => f.factor).join(', ')}</div>
            <div className="text-sm mb-1">PEP: {application.compliance?.pepCheck?.isPEP ? 'Yes' : 'No'}</div>
            <div className="text-sm mb-1">Sanctioned: {application.compliance?.sanctionsCheck?.isSanctioned ? 'Yes' : 'No'}</div>
            <div className="text-sm mb-1">AML Risk: {application.compliance?.amlCheck?.riskLevel}</div>
          </div>
          {/* Audit Trail */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="font-semibold mb-2">Audit Trail</div>
            <div className="text-xs text-gray-600 space-y-1">
              {application.auditTrail?.map((a, i) => (
                <div key={i}>{a.action} by {a.performedBy} at {a.performedAt}</div>
              ))}
            </div>
          </div>
          {/* Review Actions */}
          <div className="space-y-2">
            <div className="font-semibold">Review Action</div>
            <div className="flex gap-2">
              <Button variant={action === 'approved' ? 'default' : 'outline'} onClick={() => setAction('approved')}>Approve</Button>
              <Button variant={action === 'rejected' ? 'destructive' : 'outline'} onClick={() => setAction('rejected')}>Reject</Button>
              <Button variant={action === 'requires_additional_info' ? 'secondary' : 'outline'} onClick={() => setAction('requires_additional_info')}>Request Info</Button>
            </div>
            <textarea
              className="w-full border rounded p-2 mt-2"
              rows={3}
              placeholder="Add notes or reason (required for reject/request info)"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              disabled={loading}
            />
            {error && <Alert variant="destructive">{error}</Alert>}
            <Button
              onClick={handleReview}
              disabled={!action || (['rejected', 'requires_additional_info'].includes(action) && !notes) || loading}
              className="w-full mt-2"
            >
              {loading ? 'Submitting...' : 'Submit Review'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 