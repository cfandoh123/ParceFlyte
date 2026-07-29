/**
 * Database access.
 *
 * With MONGODB_URI set, this connects to MongoDB and hands back a real `Db`.
 * Without it, the app falls back to the in-memory demo store, so `npm run dev`
 * works on a clean checkout with no infrastructure.
 *
 * Always go through `getDb()`. The MongoClient promise is cached on globalThis
 * in development so HMR does not open a new connection pool on every edit.
 */

import { getDemoDb } from './demo-store';

export const DB_NAME = 'parceflyte';

/** True when there is no database configured, or demo mode is forced on. */
export function isDemoMode() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') return true;
  return !process.env.MONGODB_URI;
}

let clientPromise = null;

function getClientPromise() {
  const { MongoClient } = require('mongodb');
  const uri = process.env.MONGODB_URI;

  if (process.env.NODE_ENV === 'development') {
    if (!globalThis._mongoClientPromise) {
      globalThis._mongoClientPromise = new MongoClient(uri).connect();
    }
    return globalThis._mongoClientPromise;
  }

  if (!clientPromise) clientPromise = new MongoClient(uri).connect();
  return clientPromise;
}

/**
 * Resolves to a database handle exposing `.collection(name)`.
 * The demo store implements the same surface the API routes use, so callers do
 * not need to know which backend they are talking to.
 */
export async function getDb() {
  if (isDemoMode()) return getDemoDb();
  const client = await getClientPromise();
  return client.db(DB_NAME);
}

/**
 * Normalizes an id for querying. Mongo needs a real ObjectId; the demo store
 * compares ids as strings and accepts either.
 */
export function toId(id) {
  if (id == null) return id;
  if (isDemoMode()) return String(id);
  const { ObjectId } = require('mongodb');
  if (typeof id === 'object') return id;
  return ObjectId.isValid(id) ? new ObjectId(id) : id;
}

/** Stable string form of an id, for comparisons and JSON responses. */
export function idString(id) {
  if (id == null) return null;
  return typeof id === 'object' && typeof id.toHexString === 'function' ? id.toHexString() : String(id);
}
