'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Clock, MessageSquare, Package, Wallet } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CarrierBadge } from '@/components/carrier-badge';
import { RouteLine } from '@/components/route-line';
import { ScoreBadge } from '@/components/score-badge';
import { NegotiationModal } from '@/components/negotiation-modal';
import { money, shortDate, relativeTime, statusVariant, humanize, fullName } from '@/lib/format';

/** One match in a list, with the negotiation entry point. */
export function MatchCard({ match, currentUserId, onUpdated }) {
  const [negotiating, setNegotiating] = useState(false);

  const isSender = String(match.senderId) === String(currentUserId);
  const counterparty = isSender ? match.carrier : match.sender;
  const fee = match.negotiation?.finalFee ?? match.negotiation?.proposedFee ?? match.negotiation?.initialFee;

  const history = match.negotiation?.negotiationHistory || [];
  const lastOffer = history[history.length - 1];
  const awaitingYou = match.status === 'proposed' && lastOffer && String(lastOffer.proposedBy) !== String(currentUserId);
  const expired = match.expiresAt && new Date(match.expiresAt) < new Date();

  return (
    <>
      <Card className="overflow-hidden transition-shadow hover:shadow-md">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant(match.status)}>{humanize(match.status)}</Badge>
                {awaitingYou && !expired && (
                  <Badge variant="warning" className="animate-pulse">
                    Your turn
                  </Badge>
                )}
                {match.autoMatched && <Badge variant="outline">Auto-matched</Badge>}
                <span className="text-xs text-muted-foreground">
                  {isSender ? 'You are sending' : 'You are carrying'}
                </span>
              </div>

              <Link
                href={`/parcels/${match.parcelId}`}
                className="text-base font-semibold hover:underline">
                {match.parcel?.title || 'Parcel'}
              </Link>

              <div className="mt-3">
                <RouteLine
                  from={match.travel?.departureLocation?.city}
                  to={match.travel?.arrivalLocation?.city}
                  subFrom={shortDate(match.travel?.departureDate)}
                  subTo={shortDate(match.travel?.arrivalDate)}
                />
              </div>
            </div>

            <div className="shrink-0">
              <ScoreBadge score={match.matchScore} size="sm" showLabel={false} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-4 text-sm">
            <span className="flex items-center gap-1.5">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <strong className="tabular-nums">{money(fee)}</strong>
              {match.status === 'accepted' && <span className="text-xs text-muted-foreground">agreed</span>}
            </span>

            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Package className="h-4 w-4" />
              {match.parcel?.weight}kg
            </span>

            {history.length > 0 && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <MessageSquare className="h-4 w-4" />
                {history.length} offer{history.length === 1 ? '' : 's'}
              </span>
            )}

            {match.status === 'proposed' && (
              <span className={`flex items-center gap-1.5 ${expired ? 'text-destructive' : 'text-muted-foreground'}`}>
                <Clock className="h-4 w-4" />
                {expired ? 'Expired' : `Expires ${relativeTime(match.expiresAt)}`}
              </span>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <CarrierBadge carrier={counterparty} />
            <div className="flex gap-2">
              {match.status === 'proposed' && !expired && (
                <Button size="sm" onClick={() => setNegotiating(true)}>
                  {awaitingYou ? 'Respond' : 'View offer'}
                </Button>
              )}
              {match.status === 'accepted' && (
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/parcels/${match.parcelId}`}>Track delivery</Link>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <NegotiationModal
        match={match}
        open={negotiating}
        onOpenChange={setNegotiating}
        currentUserId={currentUserId}
        onUpdated={onUpdated}
      />
    </>
  );
}
