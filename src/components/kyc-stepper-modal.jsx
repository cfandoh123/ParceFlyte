import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Alert } from './ui/alert';
import KYCOnboardingForm from './kyc-onboarding-form';
import { CheckCircle, Circle, Upload, FileText, Shield } from 'lucide-react';

export default function KYCStepperModal({ isOpen, onClose, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [kycData, setKycData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const steps = [
    {
      id: 'personal-info',
      title: 'Personal Information',
      description: 'Provide your basic information and address',
      icon: FileText,
      component: 'form'
    },
    {
      id: 'documents',
      title: 'Document Upload',
      description: 'Upload your identity documents',
      icon: Upload,
      component: 'documents'
    },
    {
      id: 'verification',
      title: 'Verification Status',
      description: 'Check your verification progress',
      icon: Shield,
      component: 'status'
    }
  ];

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      setKycData(null);
      setError('');
    }
  }, [isOpen]);

  const handleKYCSubmit = (data) => {
    setKycData(data);
    setCurrentStep(1);
  };

  const handleDocumentUpload = async (documentType, images) => {
    if (!kycData?.kycId) {
      setError('KYC application not found');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/kyc/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kycId: kycData.kycId,
          documentType,
          images
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      setCurrentStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    onComplete?.(kycData);
    onClose();
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <DialogDescription>
              Please provide your personal information to complete your KYC verification. 
              This information is required for security and compliance purposes.
            </DialogDescription>
            <KYCOnboardingForm onSuccess={handleKYCSubmit} />
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <DialogDescription>
              Please upload your identity documents. We accept passport, driver's license, 
              national ID, birth certificate, or utility bill.
            </DialogDescription>
            <DocumentUploadStep 
              onUpload={handleDocumentUpload}
              loading={loading}
              error={error}
            />
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <DialogDescription>
              Your KYC application has been submitted. We'll review your documents 
              and notify you of the status within 1-2 business days.
            </DialogDescription>
            <VerificationStatusStep kycId={kycData?.kycId} />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complete Your KYC Verification</DialogTitle>
          <DialogDescription>
            Step {currentStep + 1} of {steps.length}: {steps[currentStep]?.title}
          </DialogDescription>
        </DialogHeader>

        {/* Stepper Progress */}
        <div className="flex items-center justify-between mb-6">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;
            
            return (
              <div key={step.id} className="flex items-center">
                <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 mr-2">
                  {isCompleted ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : isCurrent ? (
                    <Icon className="w-5 h-5 text-blue-600" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <div className="hidden sm:block">
                  <div className="text-sm font-medium">
                    {step.title}
                  </div>
                  <div className="text-xs text-gray-500">
                    {step.description}
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden sm:block w-16 h-0.5 bg-gray-200 mx-4" />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="space-y-4">
          {error && <Alert variant="destructive">{error}</Alert>}
          {renderStepContent()}
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
          >
            Previous
          </Button>
          
          {currentStep === steps.length - 1 ? (
            <Button onClick={handleComplete}>
              Complete Setup
            </Button>
          ) : (
            <Button
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={!kycData && currentStep === 0}
            >
              Next
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Document Upload Component
function DocumentUploadStep({ onUpload, loading, error }) {
  const [files, setFiles] = useState({ front: null, back: null, selfie: null });
  const [documentType, setDocumentType] = useState('');
  const [localError, setLocalError] = useState('');

  const maxFileSize = 5 * 1024 * 1024; // 5MB

  const handleFileChange = (side) => (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLocalError('Only image files are allowed.');
      return;
    }
    if (file.size > maxFileSize) {
      setLocalError('File size must be less than 5MB.');
      return;
    }
    setFiles((prev) => ({ ...prev, [side]: file }));
    setLocalError('');
  };

  const handleRemove = (side) => {
    setFiles((prev) => ({ ...prev, [side]: null }));
  };

  const handleUpload = async () => {
    if (!documentType || !files.front) {
      setLocalError('Please select a document type and upload at least the front image.');
      return;
    }
    setLocalError('');
    // Convert files to base64
    const images = await Promise.all(
      Object.entries(files)
        .filter(([side, file]) => file)
        .map(([side, file]) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ type: side, url: reader.result });
            reader.readAsDataURL(file);
          })
        )
    );
    onUpload(documentType, images);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Document Type</label>
        <select
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value)}
          className="w-full border rounded px-3 py-2"
        >
          <option value="">Select document type</option>
          <option value="passport">Passport</option>
          <option value="drivers_license">Driver's License</option>
          <option value="national_id">National ID</option>
          <option value="birth_certificate">Birth Certificate</option>
          <option value="utility_bill">Utility Bill</option>
        </select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {['front', 'back', 'selfie'].map((side) => (
          <div key={side} className="space-y-2">
            <label className="block text-sm font-medium mb-1 capitalize">
              {side === 'selfie' ? 'Selfie with Document' : `${side.charAt(0).toUpperCase() + side.slice(1)} Image`}
            </label>
            {files[side] ? (
              <div className="relative group">
                <img
                  src={URL.createObjectURL(files[side])}
                  alt={`${side} preview`}
                  className="w-full h-32 object-cover rounded border"
                />
                <button
                  type="button"
                  onClick={() => handleRemove(side)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 text-xs opacity-80 hover:opacity-100"
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ) : (
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange(side)}
                className="w-full border rounded px-2 py-1"
                disabled={loading}
              />
            )}
          </div>
        ))}
      </div>
      {(localError || error) && (
        <Alert variant="destructive">{localError || error}</Alert>
      )}
      <Button
        onClick={handleUpload}
        disabled={!documentType || !files.front || loading}
        className="w-full"
      >
        {loading ? 'Uploading...' : 'Upload Documents'}
      </Button>
    </div>
  );
}

// Verification Status Component
function VerificationStatusStep({ kycId }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (kycId) {
      fetchStatus();
    }
  }, [kycId]);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`/api/kyc/verify?kycId=${kycId}`);
      const data = await res.json();
      if (res.ok) {
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-4">Loading verification status...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center">
          <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
          <div>
            <h4 className="font-medium text-green-800">Application Submitted</h4>
            <p className="text-sm text-green-600">
              Your KYC application has been successfully submitted and is under review.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="font-medium">What happens next?</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Our team will review your documents within 1-2 business days</li>
          <li>• You'll receive an email notification with the result</li>
          <li>• Once approved, you can start using all platform features</li>
        </ul>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 mb-2">KYC ID</h4>
        <p className="text-sm text-blue-600 font-mono">{kycId}</p>
        <p className="text-xs text-blue-500 mt-1">
          Keep this ID for reference
        </p>
      </div>
    </div>
  );
} 