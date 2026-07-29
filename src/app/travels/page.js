'use client';

import { useState } from 'react';
import { Plane, Plus, Users } from 'lucide-react';

import { AppShell } from '@/components/app-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { RouteLine } from '@/components/route-line';
import { TravelForm } from '@/components/travel-form';
import { useSession } from '@/components/session-provider';
import { useApi } from '@/lib/use-api';
import { money, shortDate, statusVariant, humanize, relativeTime } from '@/lib/format';

export default function TravelsPage() {
  const { user } = useSession();
  const [creating, setCreating] = useState(false);

  const travelsQuery = useApi(user?._id ? `/api/travels?carrierId=${user._id}&limit=100` : null);
  const matchesQuery = useApi(user?._id ? `/api/matches?carrierId=${user._id}&limit=100` : null);

  const travels = travelsQuery.data?.data || [];
  const matches = matchesQuery.data?.data || [];

  const requestsFor = (travelId) =>
    matches.filter((m) => String(m.travelId) === String(travelId) && m.status === 'proposed').length;

  const upcoming = travels.filter((t) => new Date(t.departureDate) >= new Date());
  const past = travels.filter((t) => new Date(t.departureDate) < new Date());

  const renderTravel = (travel) => {
    const requests = requestsFor(travel._id);
    return (
      <Card key={travel._id} className="transition-shadow hover:shadow-md">
        <CardContent className="p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant(travel.status)}>{humanize(travel.status)}</Badge>
              <Badge variant="outline">{humanize(travel.travelMode)}</Badge>
              {travel.transportDetails?.reference && (
                <span className="text-xs text-muted-foreground">
                  {travel.transportDetails.carrier} {travel.transportDetails.reference}
                </span>
              )}
            </div>
            {requests > 0 && (
              <Badge variant="warning">
                <Users className="mr-1 h-3 w-3" />
                {requests} request{requests === 1 ? '' : 's'}
              </Badge>
            )}
          </div>

          <RouteLine
            from={travel.departureLocation?.city}
            to={travel.arrivalLocation?.city}
            subFrom={`${shortDate(travel.departureDate)} · ${relativeTime(travel.departureDate)}`}
            subTo={shortDate(travel.arrivalDate)}
          />

          <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t pt-3 text-sm">
            <div className="flex gap-1.5">
              <dt className="text-muted-foreground">Spare</dt>
              <dd className="font-medium">
                {travel.availableCapacity?.weight}kg · {travel.availableCapacity?.volume}L
              </dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-muted-foreground">Base fee</dt>
              <dd className="font-medium">{money(travel.baseDeliveryFee)}</dd>
            </div>
          </dl>

          {travel.notes && <p className="mt-3 text-sm italic text-muted-foreground">“{travel.notes}”</p>}
        </CardContent>
      </Card>
    );
  };

  return (
    <AppShell
      title="My trips"
      description="Routes you have shared with the community."
      actions={
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Post a trip
        </Button>
      }>
      {travelsQuery.loading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : travels.length === 0 ? (
        <EmptyState
          icon={Plane}
          title="No trips posted"
          description="Post a route you are already travelling and senders along it will be matched to your spare capacity automatically."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Post a trip
            </Button>
          }
        />
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-lg font-semibold">
              Upcoming <span className="text-muted-foreground">({upcoming.length})</span>
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming trips.</p>
            ) : (
              <div className="grid gap-4">{upcoming.map(renderTravel)}</div>
            )}
          </section>

          {past.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">
                Past <span className="text-muted-foreground">({past.length})</span>
              </h2>
              <div className="grid gap-4 opacity-70">{past.map(renderTravel)}</div>
            </section>
          )}
        </div>
      )}

      <TravelForm open={creating} onOpenChange={setCreating} onCreated={travelsQuery.reload} />
    </AppShell>
  );
}
