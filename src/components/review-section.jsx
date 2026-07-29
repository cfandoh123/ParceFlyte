'use client';

import { useState } from 'react';
import { Loader2, MessageSquareQuote, Star } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { StarRating, StarRatingInput } from '@/components/star-rating';
import { useApi, apiFetch } from '@/lib/use-api';
import { fullName, initials, shortDate } from '@/lib/format';

const PROMPTS = {
  1: 'What went wrong?',
  2: 'What could have gone better?',
  3: 'How was the delivery?',
  4: 'What went well?',
  5: 'What made this a great delivery?',
};

/**
 * Post-delivery reviews for a parcel.
 *
 * Shows the reviews already left, and — if the signed-in user was a party to
 * this delivery and has not reviewed yet — the form to leave one. The API is
 * the source of truth on eligibility; this only decides what to render.
 */
export function ReviewSection({ parcel, currentUserId }) {
  const { toast } = useToast();
  const [score, setScore] = useState(0);
  const [review, setReview] = useState('');
  const [saving, setSaving] = useState(false);

  const { data, loading, reload } = useApi(`/api/ratings?parcelId=${parcel._id}`);
  const reviews = data?.data || [];

  const isSender = String(parcel.senderId) === String(currentUserId);
  const isCarrier = String(parcel.matchedCarrierId) === String(currentUserId);
  const isParticipant = isSender || isCarrier;
  const alreadyReviewed = reviews.some((r) => String(r.reviewerId) === String(currentUserId));

  const counterparty = isSender ? parcel.carrier : parcel.sender;
  const canReview = parcel.status === 'delivered' && isParticipant && !alreadyReviewed;

  const submit = async (event) => {
    event.preventDefault();
    if (!score) {
      toast({ variant: 'destructive', title: 'Pick a rating first' });
      return;
    }

    setSaving(true);
    try {
      const result = await apiFetch('/api/ratings', {
        method: 'POST',
        body: { parcelId: parcel._id, score, review },
      });
      toast({ title: result.message, description: 'Thanks — this helps the next sender choose.' });
      setScore(0);
      setReview('');
      reload();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not publish your review', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  // Nothing to show until the parcel is delivered.
  if (parcel.status !== 'delivered') return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquareQuote className="h-5 w-5" />
          Reviews
          {reviews.length > 0 && <span className="text-sm font-normal text-muted-foreground">({reviews.length})</span>}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        {canReview && (
          <form onSubmit={submit} className="rounded-lg border bg-muted/40 p-4">
            <p className="font-medium">
              How was your delivery with {counterparty ? fullName(counterparty) : 'your counterparty'}?
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Reviews are public and feed into {isSender ? "the carrier's" : "the sender's"} reputation score.
            </p>

            <div className="mt-4">
              <Label htmlFor="review-score" className="sr-only">
                Rating
              </Label>
              <StarRatingInput value={score} onChange={setScore} />
            </div>

            <div className="mt-4">
              <Label htmlFor="review-text">{PROMPTS[score] || 'Tell others how it went'}</Label>
              <Textarea
                id="review-text"
                value={review}
                onChange={(e) => setReview(e.target.value)}
                placeholder="Was the handover easy? Did the parcel arrive as expected?"
                className="mt-1.5 bg-background"
                rows={3}
              />
            </div>

            <Button type="submit" disabled={saving} className="mt-4">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Publish review
            </Button>
          </form>
        )}

        {alreadyReviewed && isParticipant && (
          <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            <Star className="h-4 w-4 shrink-0 fill-current" />
            You have reviewed this delivery.
          </p>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading reviews…</p>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No reviews yet{canReview ? ' — be the first.' : '.'}
          </p>
        ) : (
          <ul className="space-y-4">
            {reviews.map((rating, index) => (
              <li key={rating._id}>
                {index > 0 && <Separator className="mb-4" />}
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                    style={{ backgroundColor: rating.reviewer?.avatarColor || '#64748b' }}
                    aria-hidden="true">
                    {initials(rating.reviewer)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <span className="text-sm font-medium">
                        {String(rating.reviewerId) === String(currentUserId) ? 'You' : fullName(rating.reviewer)}
                      </span>
                      <StarRating value={rating.score} size="sm" />
                      <span className="text-xs text-muted-foreground">{shortDate(rating.createdAt)}</span>
                    </div>
                    {rating.review && <p className="mt-1 text-sm text-muted-foreground">{rating.review}</p>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
