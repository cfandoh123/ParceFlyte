'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

const SIZES = { sm: 'h-3.5 w-3.5', default: 'h-5 w-5', lg: 'h-7 w-7' };

/** Read-only star display. */
export function StarRating({ value = 0, size = 'default', className }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} role="img" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden="true"
          className={cn(SIZES[size], star <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')}
        />
      ))}
    </span>
  );
}

/**
 * Interactive star input. Renders as a radio group so it is keyboard-operable
 * and announced correctly, with the hover preview layered on top.
 */
export function StarRatingInput({ value, onChange, name = 'score', size = 'lg' }) {
  const [hovered, setHovered] = useState(0);
  const shown = hovered || value;

  return (
    <div
      role="radiogroup"
      aria-label="Rating out of 5"
      className="inline-flex items-center gap-1"
      onMouseLeave={() => setHovered(0)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <label
          key={star}
          onMouseEnter={() => setHovered(star)}
          className="cursor-pointer rounded focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
          <input
            type="radio"
            name={name}
            value={star}
            checked={value === star}
            onChange={() => onChange(star)}
            className="sr-only"
          />
          <span className="sr-only">
            {star} star{star === 1 ? '' : 's'}
          </span>
          <Star
            aria-hidden="true"
            className={cn(
              SIZES[size],
              'transition-colors',
              star <= shown ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30 hover:text-amber-300'
            )}
          />
        </label>
      ))}
    </div>
  );
}
