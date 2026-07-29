'use client';

import Link from 'next/link';
import { Package, Plane, Handshake, Wallet, Plus, Search, ArrowRight, ShieldCheck, Star } from 'lucide-react';

import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { MatchCard } from '@/components/match-card';
import { RouteLine } from '@/components/route-line';
import { useSession } from '@/components/session-provider';
import { useApi } from '@/lib/use-api';
import { money, shortDate, statusVariant, humanize } from '@/lib/format';

function StatCard({ icon: Icon, label, value, hint, href }) {
  const body = (
    <Card className="h-full transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default function DashboardPage() {
  const { user, loading: sessionLoading } = useSession();
  const userId = user?._id;

  const parcels = useApi(userId ? `/api/parcels?senderId=${userId}&limit=100` : null);
  const travels = useApi(userId ? `/api/travels?carrierId=${userId}&limit=100` : null);
  const matches = useApi('/api/matches?mine=true&limit=100');
  const payments = useApi('/api/payments?mine=true&limit=100');
  const myReviews = useApi(userId ? `/api/ratings?reviewerId=${userId}&limit=100` : null);

  const loading = sessionLoading || parcels.loading || matches.loading;

  const allParcels = parcels.data?.data || [];
  const allTravels = travels.data?.data || [];
  const allMatches = matches.data?.data || [];
  const allPayments = payments.data?.data || [];

  const activeParcels = allParcels.filter((p) => ['pending', 'matched', 'in_transit'].includes(p.status));
  const upcomingTrips = allTravels.filter(
    (t) => ['planned', 'confirmed'].includes(t.status) && new Date(t.departureDate) > new Date()
  );
  const openMatches = allMatches.filter((m) => m.status === 'proposed');
  const inEscrow = allPayments
    .filter((p) => p.escrowStatus === 'funded')
    .reduce((sum, p) => sum + p.amount, 0);

  // Matches waiting on this user surface at the top — that is the one thing
  // that actually needs their attention.
  const needsResponse = openMatches.filter((m) => {
    const history = m.negotiation?.negotiationHistory || [];
    const last = history[history.length - 1];
    return last && String(last.proposedBy) !== String(userId) && new Date(m.expiresAt) > new Date();
  });

  // Completed deliveries this user has not reviewed yet.
  const reviewedParcelIds = new Set((myReviews.data?.data || []).map((r) => String(r.parcelId)));
  const awaitingReview = allParcels.filter(
    (p) => p.status === 'delivered' && !reviewedParcelIds.has(String(p._id))
  );

  return (
    <AppShell
      title={sessionLoading ? 'Welcome back' : `Welcome back, ${user?.firstName || 'there'}`}
      description="Everything moving through your account, at a glance."
      actions={
        <>
          <Button asChild variant="outline">
            <Link href="/travels">
              <Plane className="mr-2 h-4 w-4" />
              Post a trip
            </Link>
          </Button>
          <Button asChild>
            <Link href="/parcels">
              <Plus className="mr-2 h-4 w-4" />
              Send a parcel
            </Link>
          </Button>
        </>
      }>
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Package}
            label="Active parcels"
            value={activeParcels.length}
            hint={`${allParcels.length} total`}
            href="/parcels"
          />
          <StatCard
            icon={Plane}
            label="Upcoming trips"
            value={upcomingTrips.length}
            hint={upcomingTrips[0] ? `Next ${shortDate(upcomingTrips[0].departureDate)}` : 'None planned'}
            href="/travels"
          />
          <StatCard
            icon={Handshake}
            label="Open matches"
            value={openMatches.length}
            hint={needsResponse.length ? `${needsResponse.length} need a reply` : 'Nothing waiting on you'}
            href="/matches"
          />
          <StatCard icon={Wallet} label="Held in escrow" value={money(inEscrow)} hint="Released on delivery" />
        </div>
      )}

      {/* Verification nudge */}
      {user && user.kycStatus !== 'verified' && (
        <Card className="mt-6 border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="font-semibold">Finish your verification</p>
                <p className="text-sm text-muted-foreground">
                  Verified accounts get matched first and can carry higher-value parcels.
                </p>
              </div>
            </div>
            <Button asChild variant="outline">
              <Link href="/kyc">
                Verify identity
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Deliveries still to review */}
      {awaitingReview.length > 0 && (
        <Card className="mt-6">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex items-start gap-3">
              <Star className="mt-0.5 h-5 w-5 shrink-0 fill-amber-400 text-amber-400" />
              <div>
                <p className="font-semibold">
                  Rate {awaitingReview.length === 1 ? 'your delivery' : `${awaitingReview.length} deliveries`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {awaitingReview.length === 1
                    ? `“${awaitingReview[0].title}” arrived. A quick review helps the next sender choose.`
                    : 'Your reviews feed directly into carrier reputation scores.'}
                </p>
              </div>
            </div>
            <Button variant="outline" asChild>
              <Link href={`/parcels/${awaitingReview[0]._id}`}>
                Leave a review
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Needs a response */}
      {needsResponse.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Waiting on you</h2>
          <div className="grid gap-4">
            {needsResponse.slice(0, 2).map((match) => (
              <MatchCard key={match._id} match={match} currentUserId={userId} onUpdated={matches.reload} />
            ))}
          </div>
        </section>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Parcels */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your parcels</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/parcels">
                View all
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          {activeParcels.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No parcels in flight"
              description="List something you need delivered and we will score every travelling carrier against it."
              action={
                <Button asChild>
                  <Link href="/parcels">
                    <Plus className="mr-2 h-4 w-4" />
                    Send a parcel
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {activeParcels.slice(0, 4).map((parcel) => (
                <Link key={parcel._id} href={`/parcels/${parcel._id}`}>
                  <Card className="transition-shadow hover:shadow-md">
                    <CardContent className="p-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="truncate font-medium">{parcel.title}</p>
                        <Badge variant={statusVariant(parcel.status)}>{humanize(parcel.status)}</Badge>
                      </div>
                      <RouteLine
                        from={parcel.origin?.city}
                        to={parcel.recipient?.address?.city}
                        subFrom={`${parcel.weight}kg`}
                        subTo={`by ${shortDate(parcel.deliveryDeadline)}`}
                      />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Trips */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your trips</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/travels">
                View all
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          {upcomingTrips.length === 0 ? (
            <EmptyState
              icon={Plane}
              title="No upcoming trips"
              description="Travelling soon? Post your route and earn from the luggage space you are not using."
              action={
                <Button asChild>
                  <Link href="/travels">
                    <Plus className="mr-2 h-4 w-4" />
                    Post a trip
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {upcomingTrips.slice(0, 4).map((travel) => (
                <Card key={travel._id}>
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">{travel.transportDetails?.carrier || 'Trip'}</span>
                      <Badge variant={statusVariant(travel.status)}>{humanize(travel.status)}</Badge>
                    </div>
                    <RouteLine
                      from={travel.departureLocation?.city}
                      to={travel.arrivalLocation?.city}
                      subFrom={shortDate(travel.departureDate)}
                      subTo={`${travel.availableCapacity?.weight}kg free`}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Discovery prompt */}
      <Card className="mt-8 border-none bg-gradient-to-r from-[#F596D3]/15 to-[#D247BF]/15">
        <CardHeader>
          <CardTitle className="text-lg">Looking for a carrier?</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-md text-sm text-muted-foreground">
            Browse everyone travelling in the next few weeks, or let the matching engine score them against a parcel you
            have already listed.
          </p>
          <Button asChild>
            <Link href="/browse">
              <Search className="mr-2 h-4 w-4" />
              Browse carriers
            </Link>
          </Button>
        </CardContent>
      </Card>
    </AppShell>
  );
}
