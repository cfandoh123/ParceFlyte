'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Handshake, Package } from 'lucide-react';

import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/empty-state';
import { MatchCard } from '@/components/match-card';
import { useSession } from '@/components/session-provider';
import { useApi } from '@/lib/use-api';

const FILTERS = [
  { value: 'active', label: 'Active' },
  { value: 'proposed', label: 'Negotiating' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'closed', label: 'Closed' },
];

export default function MatchesPage() {
  const { user } = useSession();
  const [filter, setFilter] = useState('active');
  const { data, loading, reload } = useApi('/api/matches?mine=true&limit=100');

  const matches = data?.data || [];

  const byFilter = {
    active: matches.filter((m) => ['proposed', 'accepted'].includes(m.status)),
    proposed: matches.filter((m) => m.status === 'proposed'),
    accepted: matches.filter((m) => m.status === 'accepted'),
    closed: matches.filter((m) => ['rejected', 'expired', 'cancelled'].includes(m.status)),
  };

  const visible = byFilter[filter] || [];

  // Anything where the other party made the last offer needs a reply — sort those first.
  const sorted = [...visible].sort((a, b) => {
    const needsReply = (m) => {
      const history = m.negotiation?.negotiationHistory || [];
      const last = history[history.length - 1];
      return m.status === 'proposed' && last && String(last.proposedBy) !== String(user?._id) ? 0 : 1;
    };
    return needsReply(a) - needsReply(b) || new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  return (
    <AppShell title="Matches" description="Every pairing between your parcels and a carrier's route.">
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="flex-wrap">
          {FILTERS.map(({ value, label }) => (
            <TabsTrigger key={value} value={value}>
              {label}
              {byFilter[value]?.length > 0 && (
                <span className="ml-1.5 text-xs opacity-60">{byFilter[value].length}</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mt-6">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-56" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={Handshake}
            title="No matches here"
            description="Matches appear once you propose a carrier for a parcel, or a sender proposes you for one of your trips."
            action={
              <Button asChild>
                <Link href="/parcels">
                  <Package className="mr-2 h-4 w-4" />
                  Go to my parcels
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4">
            {sorted.map((match) => (
              <MatchCard key={match._id} match={match} currentUserId={user?._id} onUpdated={reload} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
