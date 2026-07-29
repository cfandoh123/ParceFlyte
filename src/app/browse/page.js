'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, SlidersHorizontal, X } from 'lucide-react';

import { AppShell } from '@/components/app-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { RouteLine } from '@/components/route-line';
import { CarrierBadge } from '@/components/carrier-badge';
import { useApi } from '@/lib/use-api';
import { CITY_NAMES } from '@/lib/demo-data';
import { money, shortDate, relativeTime, humanize } from '@/lib/format';

const EMPTY_FILTERS = {
  departureCity: '',
  arrivalCity: '',
  weight: '',
  maxFee: '',
  travelMode: '',
  minRating: '',
};

export default function BrowsePage() {
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);

  const params = new URLSearchParams(
    Object.entries(applied).filter(([, value]) => value !== '' && value !== null)
  );
  params.set('limit', '30');

  const { data, loading } = useApi(`/api/matching?${params.toString()}`);
  const results = data?.data || [];

  const set = (key) => (event) => setDraft((f) => ({ ...f, [key]: event.target.value }));
  const activeCount = Object.values(applied).filter(Boolean).length;

  return (
    <AppShell
      title="Find a carrier"
      description="Everyone travelling with spare luggage capacity in the coming weeks.">
      <Card className="mb-6">
        <CardContent className="p-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setApplied(draft);
            }}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <Label htmlFor="from">From</Label>
                <Select id="from" value={draft.departureCity} onChange={set('departureCity')} className="mt-1.5">
                  <option value="">Anywhere</option>
                  {CITY_NAMES.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="to">To</Label>
                <Select id="to" value={draft.arrivalCity} onChange={set('arrivalCity')} className="mt-1.5">
                  <option value="">Anywhere</option>
                  {CITY_NAMES.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="weight">Minimum spare weight (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  min="0"
                  step="0.5"
                  value={draft.weight}
                  onChange={set('weight')}
                  placeholder="Any"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="maxFee">Maximum fee ($)</Label>
                <Input
                  id="maxFee"
                  type="number"
                  min="0"
                  value={draft.maxFee}
                  onChange={set('maxFee')}
                  placeholder="Any"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="mode">Travel mode</Label>
                <Select id="mode" value={draft.travelMode} onChange={set('travelMode')} className="mt-1.5">
                  <option value="">Any</option>
                  <option value="air">Flight</option>
                  <option value="land">Road or rail</option>
                  <option value="sea">Sea</option>
                  <option value="mixed">Mixed</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="rating">Minimum rating</Label>
                <Select id="rating" value={draft.minRating} onChange={set('minRating')} className="mt-1.5">
                  <option value="">Any</option>
                  <option value="4.5">4.5 and up</option>
                  <option value="4">4.0 and up</option>
                  <option value="3">3.0 and up</option>
                </Select>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button type="submit">
                <Search className="mr-2 h-4 w-4" />
                Search
              </Button>
              {activeCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setDraft(EMPTY_FILTERS);
                    setApplied(EMPTY_FILTERS);
                  }}>
                  <X className="mr-1.5 h-4 w-4" />
                  Clear {activeCount} filter{activeCount === 1 ? '' : 's'}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <EmptyState
          icon={SlidersHorizontal}
          title="No trips match those filters"
          description="Try widening the route or removing the fee ceiling."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setDraft(EMPTY_FILTERS);
                setApplied(EMPTY_FILTERS);
              }}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            {results.length} trip{results.length === 1 ? '' : 's'} available
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {results.map(({ travel, carrier, estimatedDeliveryFee }) => (
              <Card key={travel._id} className="transition-shadow hover:shadow-md">
                <CardContent className="p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <CarrierBadge carrier={carrier} />
                    <Badge variant="outline">{humanize(travel.travelMode)}</Badge>
                  </div>

                  <RouteLine
                    from={travel.departureLocation?.city}
                    to={travel.arrivalLocation?.city}
                    subFrom={shortDate(travel.departureDate)}
                    subTo={shortDate(travel.arrivalDate)}
                  />

                  <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t pt-3 text-sm">
                    <div className="flex gap-1.5">
                      <dt className="text-muted-foreground">Fee from</dt>
                      <dd className="font-semibold">{money(estimatedDeliveryFee)}</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="text-muted-foreground">Spare</dt>
                      <dd className="font-medium">{travel.availableCapacity?.weight}kg</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="text-muted-foreground">Departs</dt>
                      <dd className="font-medium">{relativeTime(travel.departureDate)}</dd>
                    </div>
                  </dl>

                  {travel.notes && (
                    <p className="mt-3 line-clamp-2 text-sm italic text-muted-foreground">“{travel.notes}”</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="mt-6 border-dashed">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
              <p className="text-sm text-muted-foreground">
                To propose one of these carriers, open a parcel and we will score every trip against it.
              </p>
              <Button variant="outline" asChild>
                <Link href="/parcels">Go to my parcels</Link>
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </AppShell>
  );
}
