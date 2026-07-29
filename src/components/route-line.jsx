import { Plane } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Compact origin → destination visual used on every card. */
export function RouteLine({ from, to, className, subFrom, subTo }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{from || '—'}</p>
        {subFrom && <p className="truncate text-xs text-muted-foreground">{subFrom}</p>}
      </div>

      <div className="flex shrink-0 items-center gap-1 text-muted-foreground" aria-hidden="true">
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        <span className="h-px w-6 bg-current sm:w-10" />
        <Plane className="h-3.5 w-3.5 rotate-90" />
        <span className="h-px w-6 bg-current sm:w-10" />
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
      </div>

      <div className="min-w-0 flex-1 text-right">
        <p className="truncate text-sm font-semibold">{to || '—'}</p>
        {subTo && <p className="truncate text-xs text-muted-foreground">{subTo}</p>}
      </div>
    </div>
  );
}
