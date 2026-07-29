import { cn } from '@/lib/utils';
import { scoreTone } from '@/lib/format';

/** The 0-100 match score as a ring, with its qualitative label. */
export function ScoreBadge({ score, size = 'default', showLabel = true }) {
  const tone = scoreTone(score);
  const dimension = size === 'sm' ? 40 : 56;
  const stroke = size === 'sm' ? 4 : 5;
  const radius = (dimension - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, score)) / 100) * circumference;

  return (
    <div className="flex items-center gap-2.5">
      <div className="relative shrink-0" style={{ width: dimension, height: dimension }}>
        <svg width={dimension} height={dimension} className="-rotate-90">
          <circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            className="stroke-muted"
          />
          <circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={cn('transition-all duration-700', tone.text)}
            stroke="currentColor"
          />
        </svg>
        <span
          className={cn(
            'absolute inset-0 flex items-center justify-center font-bold tabular-nums',
            size === 'sm' ? 'text-xs' : 'text-sm',
            tone.text
          )}>
          {Math.round(score)}
        </span>
      </div>
      {showLabel && (
        <div className="leading-tight">
          <p className={cn('text-sm font-semibold', tone.text)}>{tone.label} match</p>
          <p className="text-xs text-muted-foreground">out of 100</p>
        </div>
      )}
    </div>
  );
}

/** Horizontal bars explaining how the score was composed. */
export function ScoreBreakdown({ breakdown }) {
  if (!breakdown) return null;

  const labels = {
    route: 'Route fit',
    capacity: 'Capacity fit',
    timing: 'Timing',
    price: 'Price',
    rating: 'Carrier rating',
  };

  return (
    <dl className="space-y-2.5">
      {Object.entries(breakdown).map(([factor, { score, weight }]) => (
        <div key={factor} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3 text-xs">
          <dt className="text-muted-foreground">
            {labels[factor] || factor}
            <span className="ml-1 opacity-60">{Math.round(weight * 100)}%</span>
          </dt>
          <dd className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full transition-all duration-700', scoreTone(score).bg)}
              style={{ width: `${score}%` }}
            />
          </dd>
          <dd className="text-right font-medium tabular-nums">{score}</dd>
        </div>
      ))}
    </dl>
  );
}
