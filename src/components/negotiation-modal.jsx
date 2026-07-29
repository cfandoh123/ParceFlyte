'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Check, Info, Loader2, Send, X } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/lib/use-api';
import { money, dateTime, fullName } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Fee negotiation for a proposed match: the offer thread, a counter-offer form
 * bounded by the engine's suggested range, and accept/reject.
 */
export function NegotiationModal({ match, open, onOpenChange, currentUserId, onUpdated }) {
  const { toast } = useToast();
  const [pricing, setPricing] = useState(null);
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(null);

  const isSender = String(match?.senderId) === String(currentUserId);
  const role = isSender ? 'sender' : 'carrier';
  const counterparty = isSender ? match?.carrier : match?.sender;

  const history = match?.negotiation?.negotiationHistory || [];
  const lastOffer = history[history.length - 1];
  const currentFee = match?.negotiation?.proposedFee ?? match?.negotiation?.initialFee;
  const awaitingYou = lastOffer && String(lastOffer.proposedBy) !== String(currentUserId);
  const youHaveOfferOut = lastOffer && String(lastOffer.proposedBy) === String(currentUserId);
  const expired = match?.expiresAt && new Date(match.expiresAt) < new Date();

  useEffect(() => {
    if (!open || !match?._id) return;
    apiFetch(`/api/matches/${match._id}/negotiate`)
      .then((data) => {
        setPricing(data.pricing);
        setAmount(String(data.negotiation?.proposedFee ?? data.pricing?.suggestedFee ?? ''));
      })
      .catch(() => setPricing(null));
  }, [open, match?._id]);

  const run = async (label, fn) => {
    setBusy(label);
    try {
      const result = await fn();
      toast({ title: result.message });
      onUpdated?.();
      if (label !== 'counter') onOpenChange(false);
      return result;
    } catch (error) {
      toast({ variant: 'destructive', title: 'That did not work', description: error.message });
    } finally {
      setBusy(null);
    }
  };

  const sendCounter = () => {
    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast({ variant: 'destructive', title: 'Enter a valid amount' });
      return;
    }
    return run('counter', async () => {
      const result = await apiFetch(`/api/matches/${match._id}/negotiate`, {
        method: 'POST',
        body: { proposedFee: value, message },
      });
      setMessage('');
      return result;
    });
  };

  const accept = () =>
    run('accept', () => apiFetch(`/api/matches/${match._id}/accept`, { method: 'POST' }));

  const reject = () =>
    run('reject', () => apiFetch(`/api/matches/${match._id}/reject`, { method: 'POST', body: {} }));

  if (!match) return null;

  const ceiling = pricing?.ceiling;
  const overCeiling = ceiling && parseFloat(amount) > ceiling;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Negotiate delivery fee</DialogTitle>
          <DialogDescription>
            {match.parcel?.title} · with {fullName(counterparty)}
          </DialogDescription>
        </DialogHeader>

        {/* Current offer on the table */}
        <div className="rounded-lg border bg-muted/40 p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Current offer</span>
            <span className="text-2xl font-bold tabular-nums">{money(currentFee)}</span>
          </div>
          {awaitingYou && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-600">
              <Info className="h-3.5 w-3.5" />
              Waiting on your response
            </p>
          )}
          {youHaveOfferOut && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5" />
              Your offer is with {fullName(counterparty)}
            </p>
          )}
        </div>

        {/* Offer thread */}
        {history.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Offer history</h4>
            <ol className="space-y-2">
              {history.map((entry, index) => {
                const mine = String(entry.proposedBy) === String(currentUserId);
                return (
                  <li
                    key={index}
                    className={cn(
                      'rounded-lg border p-3 text-sm',
                      mine ? 'ml-6 bg-primary/5 border-primary/20' : 'mr-6 bg-background'
                    )}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        {mine ? 'You' : fullName(counterparty)}
                        <span className="ml-1.5 opacity-70">· {dateTime(entry.timestamp)}</span>
                      </span>
                      <span className="font-semibold tabular-nums">{money(entry.amount)}</span>
                    </div>
                    {entry.message && <p className="mt-1.5 text-muted-foreground">{entry.message}</p>}
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {/* Counter-offer */}
        {!expired && match.status === 'proposed' && (
          <div className="space-y-3 border-t pt-4">
            <div>
              <Label htmlFor="counter-amount">Your counter-offer</Label>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-muted-foreground">$</span>
                <Input
                  id="counter-amount"
                  type="number"
                  min="1"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={cn(overCeiling && 'border-destructive focus-visible:ring-destructive')}
                />
              </div>
              {pricing && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Suggested {money(pricing.minFee)}–{money(pricing.maxFee)} · cap {money(ceiling)} (15% of declared
                  value)
                </p>
              )}
              {overCeiling && (
                <p className="mt-1 text-xs font-medium text-destructive">
                  Above the {money(ceiling)} cap — this will be rejected.
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="counter-message">Message (optional)</Label>
              <Textarea
                id="counter-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Explain your offer — a reason makes agreement much more likely."
                className="mt-1.5"
                rows={2}
              />
            </div>

            <Button onClick={sendCounter} disabled={busy || youHaveOfferOut || overCeiling} className="w-full">
              {busy === 'counter' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {youHaveOfferOut ? 'Waiting for their response' : 'Send counter-offer'}
            </Button>
          </div>
        )}

        {expired && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            This match expired {dateTime(match.expiresAt)} and can no longer be negotiated.
          </div>
        )}

        {match.status !== 'proposed' && (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            This match is <Badge variant="secondary">{match.status}</Badge>
            {match.negotiation?.finalFee && <> at an agreed {money(match.negotiation.finalFee)}.</>}
          </div>
        )}

        {!expired && match.status === 'proposed' && (
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={reject} disabled={busy} className="flex-1">
              {busy === 'reject' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
              Decline
            </Button>
            <Button onClick={accept} disabled={busy || youHaveOfferOut} className="flex-1">
              {busy === 'accept' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Accept {money(currentFee)}
            </Button>
          </DialogFooter>
        )}

        {youHaveOfferOut && !expired && match.status === 'proposed' && (
          <p className="text-center text-xs text-muted-foreground">
            You cannot accept your own offer — {fullName(counterparty)} responds next.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
