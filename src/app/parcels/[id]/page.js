'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  CircleDot,
  Loader2,
  Package,
  Search,
  Sparkles,
  Truck,
  Wallet,
} from 'lucide-react';

import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { EmptyState } from '@/components/empty-state';
import { RouteLine } from '@/components/route-line';
import { CarrierBadge } from '@/components/carrier-badge';
import { ScoreBadge, ScoreBreakdown } from '@/components/score-badge';
import { MatchCard } from '@/components/match-card';
import { ReviewSection } from '@/components/review-section';
import { useSession } from '@/components/session-provider';
import { useApi, apiFetch } from '@/lib/use-api';
import { money, shortDate, dateTime, statusVariant, humanize, relativeTime } from '@/lib/format';

/** One scored carrier candidate, with the reasoning behind the score. */
function CandidateCard({ candidate, parcelId, onProposed }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [proposing, setProposing] = useState(false);
  const { travel, carrier, matchScore, scoreBreakdown, estimatedDeliveryFee, matchDetails, quote } = candidate;

  const propose = async () => {
    setProposing(true);
    try {
      const result = await apiFetch('/api/matches', {
        method: 'POST',
        body: { parcelId, travelId: travel._id },
      });
      toast({ title: result.message, description: 'Negotiate the fee from the Matches tab.' });
      onProposed?.();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not propose', description: error.message });
    } finally {
      setProposing(false);
    }
  };

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <CarrierBadge carrier={carrier} />
          <ScoreBadge score={matchScore} size="sm" />
        </div>

        <div className="mt-4">
          <RouteLine
            from={travel.departureLocation?.city}
            to={travel.arrivalLocation?.city}
            subFrom={shortDate(travel.departureDate)}
            subTo={shortDate(travel.arrivalDate)}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-3 text-sm">
          <span className="flex items-center gap-1.5">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <strong>{money(estimatedDeliveryFee)}</strong>
            <span className="text-xs text-muted-foreground">
              {quote?.cappedByCeiling ? 'capped at the 15% limit' : 'estimated'}
            </span>
          </span>
          <span className="text-muted-foreground">{travel.availableCapacity?.weight}kg free</span>
          {matchDetails?.routeMatch?.distanceKm && (
            <span className="text-muted-foreground">
              {matchDetails.routeMatch.distanceKm.toLocaleString()} km
            </span>
          )}
          {matchDetails?.timingMatch?.bufferDays >= 0 && (
            <span className="text-muted-foreground">
              {matchDetails.timingMatch.bufferDays} day buffer
            </span>
          )}
        </div>

        {travel.notes && <p className="mt-3 text-sm italic text-muted-foreground">“{travel.notes}”</p>}

        {expanded && (
          <div className="mt-4 grid gap-4 rounded-lg bg-muted/50 p-4 sm:grid-cols-2">
            <div>
              <h4 className="mb-3 text-sm font-semibold">Why this score</h4>
              <ScoreBreakdown breakdown={scoreBreakdown} />
            </div>

            {quote && (
              <div>
                <h4 className="mb-3 text-sm font-semibold">How the fee is built</h4>
                <dl className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Carrier’s base fee</dt>
                    <dd className="tabular-nums">{money(quote.base)}</dd>
                  </div>
                  {quote.handling > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Special handling (10%)</dt>
                      <dd className="tabular-nums">+{money(quote.handling)}</dd>
                    </div>
                  )}
                  {quote.distanceSurcharge > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Long distance</dt>
                      <dd className="tabular-nums">+{money(quote.distanceSurcharge)}</dd>
                    </div>
                  )}
                  {quote.cappedByCeiling && (
                    <div className="flex justify-between text-amber-600">
                      <dt>Capped at 15% of value</dt>
                      <dd className="tabular-nums">−{money(quote.uncapped - quote.deliveryFee)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-1.5 font-semibold">
                    <dt>Delivery fee</dt>
                    <dd className="tabular-nums">{money(quote.deliveryFee)}</dd>
                  </div>
                  {quote.insurance > 0 && (
                    <>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Insurance (2% of value)</dt>
                        <dd className="tabular-nums">+{money(quote.insurance)}</dd>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <dt>Total you pay</dt>
                        <dd className="tabular-nums">{money(quote.total)}</dd>
                      </div>
                    </>
                  )}
                </dl>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={propose} disabled={proposing}>
            {proposing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Propose match
          </Button>
          <Button variant="ghost" onClick={() => setExpanded((e) => !e)}>
            {expanded ? 'Hide breakdown' : 'Why this score?'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Delivery progress for a matched parcel. */
function TrackingTimeline({ parcel, onAdvance }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const STEPS = ['matched', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered'];
  const history = parcel.trackingHistory || [];
  const reached = new Set(history.map((h) => h.status));
  const nextStep = STEPS.find((s) => !reached.has(s));

  const advance = async () => {
    setBusy(true);
    try {
      const result = await apiFetch(`/api/parcels/${parcel._id}`, {
        method: 'POST',
        body: { status: nextStep },
      });
      toast({ title: result.message });
      onAdvance?.();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not update', description: error.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg">Delivery progress</CardTitle>
        {nextStep && (
          <Button size="sm" variant="outline" onClick={advance} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
            Mark {humanize(nextStep).toLowerCase()}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <ol className="space-y-4">
          {history.map((event, index) => (
            <li key={index} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                </span>
                {index < history.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
              </div>
              <div className="pb-1">
                <p className="text-sm font-medium">{humanize(event.status)}</p>
                <p className="text-xs text-muted-foreground">{dateTime(event.timestamp)}</p>
                {event.note && <p className="mt-0.5 text-xs text-muted-foreground">{event.note}</p>}
              </div>
            </li>
          ))}

          {nextStep && (
            <li className="flex gap-3 opacity-50">
              <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-dashed">
                <CircleDot className="h-3 w-3" />
              </span>
              <p className="text-sm">{humanize(nextStep)}</p>
            </li>
          )}
        </ol>

        {parcel.status === 'delivered' && (
          <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            Delivered — escrow has been released to the carrier.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function ParcelDetailPage() {
  const { id } = useParams();
  const { user } = useSession();
  const { toast } = useToast();
  const [autoMatching, setAutoMatching] = useState(false);

  const parcelQuery = useApi(`/api/parcels/${id}`);
  const matchesQuery = useApi(`/api/matches?parcelId=${id}&limit=50`);
  const parcel = parcelQuery.data?.parcel;

  // Only score carriers while the parcel is still looking for one.
  const candidatesQuery = useApi(parcel?.status === 'pending' ? `/api/matching?parcelId=${id}&limit=20` : null);

  const candidates = candidatesQuery.data?.data || [];
  const matches = matchesQuery.data?.data || [];
  const proposedTravelIds = new Set(matches.map((m) => String(m.travelId)));
  const freshCandidates = candidates.filter((c) => !proposedTravelIds.has(String(c.travel._id)));

  const refreshAll = () => {
    parcelQuery.reload();
    matchesQuery.reload();
    candidatesQuery.reload();
  };

  const autoMatch = async () => {
    setAutoMatching(true);
    try {
      const result = await apiFetch('/api/matching/auto', { method: 'POST', body: { parcelId: id } });
      toast({ title: result.message });
      refreshAll();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Auto-match failed', description: error.message });
    } finally {
      setAutoMatching(false);
    }
  };

  if (parcelQuery.loading) {
    return (
      <AppShell>
        <Skeleton className="h-64" />
      </AppShell>
    );
  }

  if (parcelQuery.error || !parcel) {
    return (
      <AppShell>
        <EmptyState
          icon={Package}
          title="Parcel not found"
          description={parcelQuery.error || 'This parcel may have been removed.'}
          action={
            <Button asChild>
              <Link href="/parcels">Back to my parcels</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
        <Link href="/parcels">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          My parcels
        </Link>
      </Button>

      {/* Summary */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant(parcel.status)}>{humanize(parcel.status)}</Badge>
                <Badge variant="outline">{humanize(parcel.category)}</Badge>
                {parcel.specialHandling?.map((h) => (
                  <Badge key={h} variant="secondary">
                    {humanize(h)}
                  </Badge>
                ))}
              </div>
              <h1 className="text-2xl font-bold">{parcel.title}</h1>
              {parcel.description && <p className="mt-1 text-muted-foreground">{parcel.description}</p>}
            </div>
          </div>

          <div className="mt-6">
            <RouteLine
              from={parcel.origin?.city}
              to={parcel.recipient?.address?.city}
              subFrom={parcel.origin?.country}
              subTo={`${parcel.recipient?.name} · ${parcel.recipient?.address?.country || ''}`}
            />
          </div>

          <Separator className="my-5" />

          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Weight</dt>
              <dd className="mt-0.5 text-lg font-semibold">{parcel.weight} kg</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Volume</dt>
              <dd className="mt-0.5 text-lg font-semibold">{parcel.volume} L</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Declared value</dt>
              <dd className="mt-0.5 text-lg font-semibold">{money(parcel.declaredValue)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Deliver by</dt>
              <dd className="mt-0.5 text-lg font-semibold">{shortDate(parcel.deliveryDeadline)}</dd>
              <dd className="text-xs text-muted-foreground">{relativeTime(parcel.deliveryDeadline)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Tracking, once matched */}
      {parcel.status !== 'pending' && (
        <div className="mt-6">
          <TrackingTimeline parcel={parcel} onAdvance={refreshAll} />
        </div>
      )}

      {/* Reviews, once delivered */}
      {parcel.status === 'delivered' && (
        <div className="mt-6">
          <ReviewSection parcel={parcel} currentUserId={user?._id} />
        </div>
      )}

      {/* Existing matches */}
      {matches.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">
            Matches <span className="text-muted-foreground">({matches.length})</span>
          </h2>
          <div className="grid gap-4">
            {matches.map((match) => (
              <MatchCard key={match._id} match={match} currentUserId={user?._id} onUpdated={refreshAll} />
            ))}
          </div>
        </section>
      )}

      {/* Scored candidates */}
      {parcel.status === 'pending' && (
        <section className="mt-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Carriers on this route</h2>
              <p className="text-sm text-muted-foreground">
                Scored on route, capacity, timing, price and reputation.
              </p>
            </div>
            <Button variant="outline" onClick={autoMatch} disabled={autoMatching || !freshCandidates.length}>
              {autoMatching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Auto-match top carriers
            </Button>
          </div>

          {candidatesQuery.loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          ) : freshCandidates.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No carriers match yet"
              description="Nobody is currently travelling this route with enough space before your deadline. Try extending the deadline, or check back — new trips are posted daily."
              action={
                <Button variant="outline" asChild>
                  <Link href="/browse">Browse all trips</Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4">
              {freshCandidates.map((candidate) => (
                <CandidateCard
                  key={candidate.travel._id}
                  candidate={candidate}
                  parcelId={id}
                  onProposed={refreshAll}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </AppShell>
  );
}
