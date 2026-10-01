/**
 * Load the demo dataset into a real MongoDB, and create the indexes the app's
 * hot queries depend on.
 *
 *   MONGODB_URI=mongodb://localhost:27017/parceflyte npm run seed
 *
 * Existing collections are dropped first, so this is a reset, not a merge.
 */

import { MongoClient, ObjectId } from 'mongodb';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

// Load .env.local without adding a dotenv dependency to the runtime.
try {
  const env = readFileSync(resolve(here, '../.env.local'), 'utf8');
  for (const line of env.split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
} catch {
  // No .env.local — rely on the ambient environment.
}

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not set. Example:');
  console.error('  MONGODB_URI=mongodb://localhost:27017/parceflyte npm run seed');
  process.exit(1);
}

const { buildSeedData } = await import('../src/lib/demo-data.js');

/** 24-char hex ids in the seed become real ObjectIds. */
function toObjectIds(value) {
  if (Array.isArray(value)) return value.map(toObjectIds);
  if (value instanceof Date) return value;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, toObjectIds(v)]));
  }
  if (typeof value === 'string' && /^[0-9a-f]{24}$/.test(value)) return new ObjectId(value);
  return value;
}

const { INDEXES, ensureIndexes } = await import('../src/lib/indexes.js');

// `--indexes-only` prepares an empty database for real users: no demo data.
const indexesOnly = process.argv.includes('--indexes-only');

const client = new MongoClient(uri);
await client.connect();
const db = client.db('parceflyte');

if (!indexesOnly) {
  const data = buildSeedData();

  for (const [name, documents] of Object.entries(data)) {
    const collection = db.collection(name);
    await collection.deleteMany({});
    if (documents.length) await collection.insertMany(documents.map(toObjectIds));
    console.log(`  ${name.padEnd(9)} ${String(documents.length).padStart(3)} documents`);
  }
}

console.log('\nCreating indexes…');
await ensureIndexes(db);
for (const [name, specs] of Object.entries(INDEXES)) {
  console.log(`  ${name.padEnd(9)} ${specs.length} indexes`);
}

await client.close();
console.log(
  indexesOnly
    ? '\nIndexes created. The database is ready for real sign-ins.'
    : '\nSeeded. Start the app with the same MONGODB_URI to run against it.'
);
