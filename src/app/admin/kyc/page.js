'use client';

import { useState } from 'react';
import { Check, Loader2, MessageCircleQuestion, ShieldAlert, ShieldCheck, X } from 'lucide-react';

import { AppShell } from '@/components/app-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { EmptyState } from '@/components/empty-state';
import { useApi, apiFetch } from '@/lib/use-api';
import { dateTime, fullName, humanize, statusVariant } from '@/lib/format';
import { cn } from '@/lib/utils';

function StatTile({ label, value, tone }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn('mt-1 text-2xl font-bold tabular-nums', tone)}>{value}</p>
      </CardContent>
    </Card>
  );
}

/** Full application, with the decision controls. */
function ReviewDialog({ application, open, onOpenChange, onDecided }) {
  const { toast } = useToast();
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(null);

  if (!application) return null;

  const risk = application.riskAssessment || {};
  const compliance = application.compliance || {};
  const docs = application.documentVerification || {};

  const decide = async (decision) => {
    if (decision === 'reject' && !reason.trim()) {
      toast({ variant: 'destructive', title: 'A rejection reason is required' });
      return;
    }
    setBusy(decision);
    try {
      const result = await apiFetch('/api/admin/kyc', {
        method: 'POST',
        body: { kycId: application.kycId, decision, notes, reason },
      });
      toast({ title: result.message });
      onOpenChange(false);
      setNotes('');
      setReason('');
      onDecided();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not record decision', description: error.message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{fullName(application.personalInfo)}</DialogTitle>
          <DialogDescription>
            {application.kycId} · submitted {dateTime(application.verificationProcess?.submittedAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">Risk assessment</h3>
            <Badge variant={risk.flagged ? 'destructive' : risk.riskLevel === 'low' ? 'success' : 'warning'}>
              {humanize(risk.riskLevel)} · {risk.riskScore}
            </Badge>
          </div>
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full',
                risk.riskScore < 20 ? 'bg-emerald-500' : risk.riskScore < 35 ? 'bg-amber-500' : 'bg-rose-500'
              )}
              style={{ width: `${Math.min(100, risk.riskScore || 0)}%` }}
            />
          </div>
          {risk.riskFactors?.length ? (
            <ul className="space-y-1 text-sm text-muted-foreground">
              {risk.riskFactors.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                  {humanize(f)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No risk factors.</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border p-4">
            <h3 className="mb-2 text-sm font-semibold">Compliance</h3>
            <dl className="space-y-1.5 text-sm">
              {[
                ['PEP', compliance.pepCheck],
                ['Sanctions', compliance.sanctionsCheck],
                ['AML', compliance.amlCheck],
              ].map(([label, check]) => (
                <div key={label} className="flex items-center justify-between">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd>
                    <Badge variant={check?.status === 'clear' ? 'success' : 'warning'}>
                      {humanize(check?.status || 'pending')}
                    </Badge>
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-lg border p-4">
            <h3 className="mb-2 text-sm font-semibold">Documents</h3>
            <dl className="space-y-1.5 text-sm">
              {[
                ['Face match', docs.faceMatch],
                ['Authenticity', docs.documentAuthenticity],
                ['Liveness', docs.livenessCheck],
              ].map(([label, check]) => (
                <div key={label} className="flex items-center justify-between">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="tabular-nums">{check ? `${Math.round(check.score * 100)}%` : '—'}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <h3 className="mb-2 text-sm font-semibold">Applicant</h3>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Nationality</dt>
              <dd>{application.personalInfo?.nationality || '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Address</dt>
              <dd>
                {application.address?.currentAddress?.city}, {application.address?.currentAddress?.country}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Phone</dt>
              <dd>{application.contactInfo?.phoneNumber || '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Employment</dt>
              <dd>{humanize(application.employment?.employmentStatus) || '—'}</dd>
            </div>
          </dl>

          {application.identityDocuments?.length > 0 && (
            <>
              <Separator className="my-3" />
              <ul className="space-y-1 text-sm">
                {application.identityDocuments.map((doc, i) => (
                  <li key={i} className="flex items-center justify-between">
                    <span>
                      {humanize(doc.documentType)} · {doc.issuingCountry}
                    </span>
                    <Badge variant={statusVariant(doc.verificationStatus)}>{humanize(doc.verificationStatus)}</Badge>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="notes" className="text-sm font-medium">
              Review notes
            </label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes on this decision."
              className="mt-1.5"
              rows={2}
            />
          </div>
          <div>
            <label htmlFor="reason" className="text-sm font-medium">
              Rejection reason <span className="text-muted-foreground">(required to reject)</span>
            </label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Shown to the applicant."
              className="mt-1.5"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => decide('request_info')} disabled={busy}>
            {busy === 'request_info' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <MessageCircleQuestion className="mr-2 h-4 w-4" />
            )}
            Request info
          </Button>
          <Button variant="destructive" onClick={() => decide('reject')} disabled={busy}>
            {busy === 'reject' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
            Reject
          </Button>
          <Button onClick={() => decide('approve')} disabled={busy}>
            {busy === 'approve' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminKycPage() {
  const [filter, setFilter] = useState('pending');
  const [selected, setSelected] = useState(null);

  const statsQuery = useApi('/api/admin/kyc?status=statistics');
  const queueQuery = useApi(`/api/admin/kyc${filter === 'all' ? '' : `?status=${filter}`}`);

  const stats = statsQuery.data?.statistics;
  const applications = queueQuery.data?.data || [];

  const refresh = () => {
    statsQuery.reload();
    queueQuery.reload();
  };

  return (
    <AppShell title="KYC review queue" description="Applications the automated checks could not clear on their own.">
      {statsQuery.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : (
        stats && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatTile label="Awaiting review" value={stats.pending + stats.inReview} tone="text-amber-600" />
            <StatTile label="Flagged" value={stats.flagged} tone="text-rose-600" />
            <StatTile label="Approved" value={stats.approved} tone="text-emerald-600" />
            <StatTile label="Approval rate" value={`${stats.approvalRate}%`} />
            <StatTile label="Avg. review time" value={`${stats.averageReviewHours}h`} />
          </div>
        )
      )}

      <div className="mt-6">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="in_review">In review</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="mt-6">
        {queueQuery.loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : applications.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="Queue is clear"
            description="No applications with that status right now."
          />
        ) : (
          <div className="grid gap-3">
            {applications.map((application) => {
              const risk = application.riskAssessment || {};
              return (
                <Card key={application._id} className="transition-shadow hover:shadow-md">
                  <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge variant={statusVariant(application.verificationProcess?.status)}>
                          {humanize(application.verificationProcess?.status)}
                        </Badge>
                        <Badge variant={risk.flagged ? 'destructive' : risk.riskLevel === 'low' ? 'success' : 'warning'}>
                          {humanize(risk.riskLevel)} risk · {risk.riskScore}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{application.kycId}</span>
                      </div>
                      <p className="font-semibold">{fullName(application.personalInfo)}</p>
                      <p className="text-sm text-muted-foreground">
                        {application.address?.currentAddress?.city}, {application.address?.currentAddress?.country} ·
                        submitted {dateTime(application.verificationProcess?.submittedAt)}
                      </p>
                    </div>

                    <Button
                      variant={
                        ['pending', 'in_review'].includes(application.verificationProcess?.status)
                          ? 'default'
                          : 'outline'
                      }
                      onClick={() => setSelected(application)}>
                      Review
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <ReviewDialog
        application={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
        onDecided={refresh}
      />
    </AppShell>
  );
}
