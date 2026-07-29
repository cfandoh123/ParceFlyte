/** Shared helpers for API route handlers. */

import { NextResponse } from 'next/server';

export function ok(data, init) {
  return NextResponse.json(data, init);
}

export function badRequest(message, extra = {}) {
  return NextResponse.json({ error: message, ...extra }, { status: 400 });
}

export function notFound(message = 'Not found') {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function forbidden(message = 'Not allowed') {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function conflict(message, extra = {}) {
  return NextResponse.json({ error: message, ...extra }, { status: 409 });
}

/** Read `page`/`limit` off the query string, clamped to sane bounds. */
export function pagination(searchParams, defaultLimit = 20) {
  const page = Math.max(1, parseInt(searchParams.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit')) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

export function paginated(items, total, { page, limit }) {
  return {
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasMore: page * limit < total,
    },
  };
}

/**
 * Check that every required field is present and non-empty.
 * Returns a 400 response listing what is missing, or null if the body is fine.
 */
export function requireFields(body, fields) {
  const missing = fields.filter((field) => {
    const value = field.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), body);
    return value === undefined || value === null || value === '';
  });
  if (!missing.length) return null;
  return badRequest(`Missing required field${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`, {
    missing,
  });
}

/** Coerce to a finite positive number, or null. */
export function positiveNumber(value) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Coerce to a valid Date, or null. */
export function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
