'use client';

import { useState } from 'react';
import {
  Check,
  FileText,
  Loader2,
  ScanFace,
  ShieldCheck,
  ShieldAlert,
  Upload,
  User,
} from 'lucide-react';

import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { useSession } from '@/components/session-provider';
import { useApi, apiFetch } from '@/lib/use-api';
import { CITY_NAMES, CITIES } from '@/lib/demo-data';
import { dateTime, humanize, statusVariant } from '@/lib/format';
import { cn } from '@/lib/utils';

const COUNTRIES = [...new Set(Object.values(CITIES).map((c) => c.country))].sort();

const STEPS = [
  { id: 'details', label: 'Your details', icon: User },
  { id: 'documents', label: 'Identity document', icon: FileText },
  { id: 'verify', label: 'Verification', icon: ScanFace },
];

/** Horizontal stepper showing where the applicant is in the flow. */
function Stepper({ current }) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);

  return (
    <ol className="mb-8 flex items-center gap-2">
      {STEPS.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        const Icon = step.icon;
        return (
          <li key={step.id} className="flex flex-1 items-center gap-2">
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  done && 'border-emerald-600 bg-emerald-600 text-white',
                  active && 'border-primary bg-primary text-primary-foreground',
                  !done && !active && 'border-muted-foreground/30 text-muted-foreground'
                )}>
                {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </span>
              <span
                className={cn(
                  'hidden text-sm font-medium sm:block',
                  active ? 'text-foreground' : 'text-muted-foreground'
                )}>
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && <span className="h-px flex-1 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}

/** Step 1 — personal details. */
function DetailsStep({ user, onSubmitted }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    dateOfBirth: user?.dateOfBirth ? new Date(user.dateOfBirth).toISOString().slice(0, 10) : '',
    nationality: user?.address?.country || '',
    gender: 'prefer_not_to_say',
    city: user?.address?.city || '',
    country: user?.address?.country || '',
    street: user?.address?.street || '',
    phoneNumber: user?.phoneNumber || '',
    employmentStatus: 'employed',
    jobTitle: '',
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await apiFetch('/api/kyc', {
        method: 'POST',
        body: {
          personalInfo: {
            firstName: form.firstName,
            lastName: form.lastName,
            dateOfBirth: form.dateOfBirth,
            nationality: form.nationality,
            gender: form.gender,
          },
          address: {
            currentAddress: { street: form.street, city: form.city, country: form.country },
          },
          contactInfo: { phoneNumber: form.phoneNumber },
          employment: { employmentStatus: form.employmentStatus, jobTitle: form.jobTitle },
        },
      });
      toast({ title: result.message });
      onSubmitted();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not submit', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tell us who you are</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" required value={form.firstName} onChange={set('firstName')} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" required value={form.lastName} onChange={set('lastName')} className="mt-1.5" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="dob">Date of birth</Label>
              <Input
                id="dob"
                type="date"
                required
                value={form.dateOfBirth}
                onChange={set('dateOfBirth')}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="nationality">Nationality</Label>
              <Select id="nationality" required value={form.nationality} onChange={set('nationality')} className="mt-1.5">
                <option value="">Select…</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="gender">Gender</Label>
              <Select id="gender" value={form.gender} onChange={set('gender')} className="mt-1.5">
                <option value="prefer_not_to_say">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </Select>
            </div>
          </div>

          <Separator />

          <div>
            <Label htmlFor="street">Street address</Label>
            <Input id="street" value={form.street} onChange={set('street')} className="mt-1.5" />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="city">City</Label>
              <Select id="city" required value={form.city} onChange={set('city')} className="mt-1.5">
                <option value="">Select…</option>
                {CITY_NAMES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="country">Country</Label>
              <Select id="country" required value={form.country} onChange={set('country')} className="mt-1.5">
                <option value="">Select…</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="phone">Phone number</Label>
              <Input id="phone" required value={form.phoneNumber} onChange={set('phoneNumber')} className="mt-1.5" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="employment">Employment status</Label>
              <Select id="employment" value={form.employmentStatus} onChange={set('employmentStatus')} className="mt-1.5">
                <option value="employed">Employed</option>
                <option value="self_employed">Self-employed</option>
                <option value="student">Student</option>
                <option value="unemployed">Unemployed</option>
                <option value="retired">Retired</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="job">Job title</Label>
              <Input id="job" value={form.jobTitle} onChange={set('jobTitle')} className="mt-1.5" />
            </div>
          </div>

          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continue to documents
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/** Step 2 — identity document upload. */
function DocumentsStep({ onUploaded }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    documentType: 'passport',
    documentNumber: '',
    issuingCountry: '',
    expiryDate: '',
  });
  const [images, setImages] = useState({});

  const REQUIRED = {
    passport: ['front', 'selfie_with_document'],
    drivers_license: ['front', 'back', 'selfie_with_document'],
    national_id: ['front', 'back', 'selfie_with_document'],
  };
  const required = REQUIRED[form.documentType] || ['front'];

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const pickFile = (type) => (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImages((imgs) => ({ ...imgs, [type]: file.name }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const missing = required.filter((type) => !images[type]);
    if (missing.length) {
      toast({ variant: 'destructive', title: 'Missing images', description: `Still need: ${missing.join(', ')}` });
      return;
    }

    setSaving(true);
    try {
      const result = await apiFetch('/api/kyc/documents', {
        method: 'POST',
        body: {
          ...form,
          documentImages: required.map((type) => ({ type, fileName: images[type] })),
        },
      });
      toast({ title: result.message });
      onUploaded();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Upload failed', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload an identity document</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="docType">Document type</Label>
              <Select id="docType" value={form.documentType} onChange={set('documentType')} className="mt-1.5">
                <option value="passport">Passport</option>
                <option value="drivers_license">Driver’s licence</option>
                <option value="national_id">National ID</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="docNumber">Document number</Label>
              <Input
                id="docNumber"
                required
                value={form.documentNumber}
                onChange={set('documentNumber')}
                placeholder="G1234567"
                className="mt-1.5"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="issuer">Issuing country</Label>
              <Select id="issuer" required value={form.issuingCountry} onChange={set('issuingCountry')} className="mt-1.5">
                <option value="">Select…</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="expiry">Expiry date</Label>
              <Input
                id="expiry"
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                value={form.expiryDate}
                onChange={set('expiryDate')}
                className="mt-1.5"
              />
            </div>
          </div>

          <fieldset>
            <legend className="text-sm font-medium">Required images</legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              {required.map((type) => (
                <label
                  key={type}
                  className={cn(
                    'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-5 text-center transition-colors',
                    images[type] ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : 'hover:bg-muted'
                  )}>
                  <input type="file" accept="image/*" className="sr-only" onChange={pickFile(type)} />
                  {images[type] ? (
                    <Check className="h-6 w-6 text-emerald-600" />
                  ) : (
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  )}
                  <span className="text-xs font-medium">{humanize(type)}</span>
                  {images[type] && (
                    <span className="max-w-full truncate text-[11px] text-muted-foreground">{images[type]}</span>
                  )}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Files are not uploaded in the demo — only the file name is recorded, so any image works.
            </p>
          </fieldset>

          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Upload document
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/** Step 3 — run the automated checks and show their results. */
function VerifyStep({ application, onVerified }) {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);

  const results = application?.riskAssessment ? application : null;

  const run = async () => {
    setRunning(true);
    try {
      const result = await apiFetch('/api/kyc/verify', { method: 'POST', body: {} });
      toast({ title: result.message });
      onVerified();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Verification failed', description: error.message });
    } finally {
      setRunning(false);
    }
  };

  const status = application?.verificationProcess?.status;
  const risk = application?.riskAssessment;
  const compliance = application?.compliance || {};
  const docs = application?.documentVerification || {};

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Run verification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            We check the document is authentic, match your selfie against it, screen against sanctions and PEP lists,
            and score the account for risk. Clean applications are approved instantly.
          </p>
          <Button onClick={run} disabled={running || status === 'approved'}>
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanFace className="mr-2 h-4 w-4" />}
            {status === 'approved' ? 'Already verified' : 'Run automated checks'}
          </Button>
        </CardContent>
      </Card>

      {results && (
        <>
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Risk assessment</CardTitle>
              <Badge variant={risk.riskLevel === 'low' ? 'success' : risk.flagged ? 'destructive' : 'warning'}>
                {humanize(risk.riskLevel)} risk · {risk.riskScore}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-700',
                    risk.riskScore < 20 ? 'bg-emerald-500' : risk.riskScore < 35 ? 'bg-amber-500' : 'bg-rose-500'
                  )}
                  style={{ width: `${Math.min(100, risk.riskScore)}%` }}
                />
              </div>
              {risk.riskFactors?.length ? (
                <ul className="space-y-1.5 text-sm">
                  {risk.riskFactors.map((factor) => (
                    <li key={factor} className="flex items-center gap-2 text-muted-foreground">
                      <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                      {humanize(factor)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No risk factors identified.</p>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Compliance screening</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {[
                  ['PEP screening', compliance.pepCheck],
                  ['Sanctions list', compliance.sanctionsCheck],
                  ['AML monitoring', compliance.amlCheck],
                ].map(([label, check]) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <Badge variant={check?.status === 'clear' ? 'success' : 'warning'}>
                      {humanize(check?.status || 'pending')}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Document checks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {[
                  ['Face match', docs.faceMatch],
                  ['Authenticity', docs.documentAuthenticity],
                  ['Liveness', docs.livenessCheck],
                ].map(([label, check]) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums">{check ? `${Math.round(check.score * 100)}%` : '—'}</span>
                      <Badge variant={check?.passed ? 'success' : 'secondary'}>
                        {check?.passed ? 'Pass' : 'Pending'}
                      </Badge>
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

export default function KycPage() {
  const { user, refresh: refreshSession } = useSession();
  const { data, loading, reload } = useApi('/api/kyc');

  const application = data?.kyc;
  const status = application?.verificationProcess?.status;

  const step = !application ? 'details' : !application.identityDocuments?.length ? 'documents' : 'verify';

  const refresh = () => {
    reload();
    refreshSession();
  };

  if (loading) {
    return (
      <AppShell title="Identity verification">
        <Skeleton className="h-96" />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Identity verification"
      description="Verified accounts are matched first and can carry higher-value parcels.">
      {status === 'approved' ? (
        <Card className="border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30">
          <CardContent className="flex flex-wrap items-center gap-4 p-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-600">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">You are verified</h2>
              <p className="text-sm text-muted-foreground">
                Approved {dateTime(application.verificationProcess.approvedAt)} · reference {application.kycId}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Stepper current={step} />

          {status && (
            <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
              <span className="text-sm text-muted-foreground">Application {application.kycId}</span>
              <Badge variant={statusVariant(status)}>{humanize(status)}</Badge>
              {status === 'in_review' && (
                <span className="text-sm text-muted-foreground">
                  Queued for manual review — you will hear back within one working day.
                </span>
              )}
              {status === 'rejected' && application.verificationProcess?.rejectionReason && (
                <span className="text-sm text-destructive">{application.verificationProcess.rejectionReason}</span>
              )}
            </div>
          )}

          {step === 'details' && <DetailsStep user={user} onSubmitted={refresh} />}
          {step === 'documents' && <DocumentsStep onUploaded={refresh} />}
          {step === 'verify' && <VerifyStep application={application} onVerified={refresh} />}
        </>
      )}

      {application?.auditTrail?.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Audit trail</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm">
              {application.auditTrail.map((entry, index) => (
                <li key={index} className="flex items-center justify-between gap-3">
                  <span>{humanize(entry.action)}</span>
                  <span className="text-xs text-muted-foreground">{dateTime(entry.timestamp)}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
