'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Package, Plus, ArrowRight } from 'lucide-react';

import { AppShell } from '@/components/app-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/empty-state';
import { RouteLine } from '@/components/route-line';
import { ParcelForm } from '@/components/parcel-form';
import { useSession } from '@/components/session-provider';
import { useApi } from '@/lib/use-api';
import { money, shortDate, statusVariant, humanize, relativeTime } from '@/lib/format';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Awaiting a carrier' },
  { value: 'matched', label: 'Matched' },
  { value: 'in_transit', label: 'In transit' },
  { value: 'delivered', label: 'Delivered' },
];

export default function ParcelsPage() {
  const { user } = useSession();
  const [filter, setFilter] = useState('all');
  const [creating, setCreating] = useState(false);

  const { data, loading, reload } = useApi(user?._id ? `/api/parcels?senderId=${user._id}&limit=100` : null);
  const parcels = data?.data || [];
  const visible = filter === 'all' ? parcels : parcels.filter((p) => p.status === filter);

  return (
    <AppShell
      title="My parcels"
      description="Everything you have asked the community to carry."
      actions={
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          List a parcel
        </Button>
      }>
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="flex-wrap">
          {FILTERS.map(({ value, label }) => {
            const count = value === 'all' ? parcels.length : parcels.filter((p) => p.status === value).length;
            return (
              <TabsTrigger key={value} value={value}>
                {label}
                {count > 0 && <span className="ml-1.5 text-xs opacity-60">{count}</span>}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      <div className="mt-6">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Package}
            title={filter === 'all' ? 'No parcels yet' : `Nothing ${humanize(filter).toLowerCase()}`}
            description={
              filter === 'all'
                ? 'List something you need delivered and the matching engine will score every travelling carrier against it.'
                : 'Try another filter to see your other parcels.'
            }
            action={
              filter === 'all' && (
                <Button onClick={() => setCreating(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  List a parcel
                </Button>
              )
            }
          />
        ) : (
          <div className="grid gap-4">
            {visible.map((parcel) => (
              <Card key={parcel._id} className="transition-shadow hover:shadow-md">
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge variant={statusVariant(parcel.status)}>{humanize(parcel.status)}</Badge>
                        <Badge variant="outline">{humanize(parcel.category)}</Badge>
                        {parcel.specialHandling?.map((h) => (
                          <Badge key={h} variant="secondary">
                            {humanize(h)}
                          </Badge>
                        ))}
                      </div>
                      <h3 className="text-base font-semibold">{parcel.title}</h3>
                      {parcel.description && (
                        <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{parcel.description}</p>
                      )}
                    </div>

                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/parcels/${parcel._id}`}>
                        {parcel.status === 'pending' ? 'Find carriers' : 'View'}
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>

                  <div className="mt-4">
                    <RouteLine
                      from={parcel.origin?.city}
                      to={parcel.recipient?.address?.city}
                      subFrom={parcel.origin?.country}
                      subTo={parcel.recipient?.name}
                    />
                  </div>

                  <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t pt-3 text-sm">
                    <div className="flex gap-1.5">
                      <dt className="text-muted-foreground">Weight</dt>
                      <dd className="font-medium">{parcel.weight}kg</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="text-muted-foreground">Value</dt>
                      <dd className="font-medium">{money(parcel.declaredValue)}</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="text-muted-foreground">Max fee</dt>
                      <dd className="font-medium">{money(parcel.declaredValue * 0.15)}</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="text-muted-foreground">Deadline</dt>
                      <dd className="font-medium">
                        {shortDate(parcel.deliveryDeadline)}
                        <span className="ml-1 text-muted-foreground">({relativeTime(parcel.deliveryDeadline)})</span>
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <ParcelForm open={creating} onOpenChange={setCreating} onCreated={reload} />
    </AppShell>
  );
}
