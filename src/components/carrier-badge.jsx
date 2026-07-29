import { Star, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fullName, initials } from '@/lib/format';

/** Carrier identity + reputation, shown wherever a carrier is offered. */
export function CarrierBadge({ carrier, className, showKyc = true }) {
  if (!carrier) return null;

  const reviews = carrier.rating?.totalReviews || 0;
  const average = carrier.rating?.average || 0;

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
        style={{ backgroundColor: carrier.avatarColor || '#64748b' }}
        aria-hidden="true">
        {initials(carrier)}
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold">{fullName(carrier)}</p>
          {showKyc && carrier.kycStatus === 'verified' && (
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-label="Identity verified" />
          )}
        </div>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          {reviews > 0 ? (
            <>
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span className="font-medium text-foreground">{average.toFixed(1)}</span>
              <span>
                · {reviews} review{reviews === 1 ? '' : 's'}
              </span>
            </>
          ) : (
            <span>New carrier · no reviews yet</span>
          )}
        </p>
      </div>
    </div>
  );
}
