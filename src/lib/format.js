/** Display formatting shared across the UI. */

export function money(amount, currency = 'USD') {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

export function shortDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function dateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** "in 3 days" / "2 hours ago" */
export function relativeTime(value) {
  if (!value) return '—';
  const diff = new Date(value).getTime() - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  const units = [
    ['year', 365 * 86400000],
    ['month', 30 * 86400000],
    ['day', 86400000],
    ['hour', 3600000],
    ['minute', 60000],
  ];

  for (const [unit, ms] of units) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return 'just now';
}

export function fullName(user) {
  if (!user) return 'Unknown';
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'Unknown';
}

export function initials(user) {
  if (!user) return '?';
  const first = user.firstName?.[0] || '';
  const last = user.lastName?.[0] || '';
  return (first + last).toUpperCase() || (user.email?.[0] || '?').toUpperCase();
}

/** 'in_transit' -> 'In transit' */
export function humanize(value) {
  if (!value) return '';
  const spaced = String(value).replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function place(location) {
  if (!location) return '—';
  return [location.city, location.country].filter(Boolean).join(', ');
}

/** Badge variant for each domain status value. */
export function statusVariant(status) {
  switch (status) {
    case 'accepted':
    case 'delivered':
    case 'verified':
    case 'approved':
    case 'released':
    case 'completed':
    case 'confirmed':
    case 'published':
      return 'success';
    case 'proposed':
    case 'pending':
    case 'in_review':
    case 'planned':
    case 'matched':
    case 'in_transit':
    case 'funded':
    case 'paid':
      return 'warning';
    case 'rejected':
    case 'cancelled':
    case 'expired':
    case 'disputed':
    case 'lost':
    case 'failed':
      return 'destructive';
    default:
      return 'secondary';
  }
}

/** Colour ramp for the 0-100 match score. */
export function scoreTone(score) {
  if (score >= 85) return { text: 'text-emerald-600', bg: 'bg-emerald-500', label: 'Excellent' };
  if (score >= 70) return { text: 'text-sky-600', bg: 'bg-sky-500', label: 'Strong' };
  if (score >= 50) return { text: 'text-amber-600', bg: 'bg-amber-500', label: 'Fair' };
  return { text: 'text-rose-600', bg: 'bg-rose-500', label: 'Weak' };
}
