/**
 * In-memory data store implementing the subset of the MongoDB collection API
 * that the API routes use. This is what lets the app run with no database:
 * `getDb()` hands back one of these instead of a real Mongo `Db`.
 *
 * Supported query operators: $in, $nin, $gte, $lte, $gt, $lt, $ne, $or, $and,
 * $regex, $exists. Dotted paths ('rating.average') resolve into nested objects.
 * Supported update operators: $set, $push, $inc.
 *
 * State lives on globalThis so it survives Next.js hot module replacement in
 * development — otherwise every edit would wipe anything created in the demo.
 */

import { buildSeedData } from './demo-data';

const STORE_KEY = '__parceflyteDemoStore';

function freshStore() {
  return { data: buildSeedData(), seededAt: new Date() };
}

function store() {
  if (!globalThis[STORE_KEY]) globalThis[STORE_KEY] = freshStore();
  return globalThis[STORE_KEY];
}

/** Wipe any demo-session changes and reload the pristine seed dataset. */
export function resetDemoStore() {
  globalThis[STORE_KEY] = freshStore();
  return globalThis[STORE_KEY].seededAt;
}

// --- value helpers ---------------------------------------------------------

/** ObjectId, string id, Date and primitive values all compare as strings. */
function normalize(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object' && typeof value.toHexString === 'function') return value.toHexString();
  if (typeof value === 'object' && value._bsontype === 'ObjectId') return String(value);
  return value;
}

function looseEqual(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;
  // Ids may be compared as ObjectId vs 24-char hex string.
  if (na != null && nb != null && String(na) === String(nb)) return true;
  return false;
}

function comparable(value) {
  const n = normalize(value);
  if (typeof n === 'string') {
    const asDate = Date.parse(n);
    if (!Number.isNaN(asDate)) return asDate;
  }
  return n;
}

function getPath(doc, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), doc);
}

function setPath(doc, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((acc, key) => {
    if (acc[key] == null || typeof acc[key] !== 'object') acc[key] = {};
    return acc[key];
  }, doc);
  target[last] = value;
}

// --- query matching --------------------------------------------------------

function matchesCondition(actual, condition) {
  if (condition === null) return actual === null || actual === undefined;

  const isOperatorObject =
    condition &&
    typeof condition === 'object' &&
    !Array.isArray(condition) &&
    !(condition instanceof Date) &&
    Object.keys(condition).some((k) => k.startsWith('$'));

  if (!isOperatorObject) {
    // Matching a scalar against an array field matches if the array contains it.
    if (Array.isArray(actual)) return actual.some((item) => looseEqual(item, condition));
    return looseEqual(actual, condition);
  }

  return Object.entries(condition).every(([op, operand]) => {
    switch (op) {
      case '$in':
        return (operand || []).some((v) =>
          Array.isArray(actual) ? actual.some((a) => looseEqual(a, v)) : looseEqual(actual, v)
        );
      case '$nin':
        return !(operand || []).some((v) =>
          Array.isArray(actual) ? actual.some((a) => looseEqual(a, v)) : looseEqual(actual, v)
        );
      case '$ne':
        return !looseEqual(actual, operand);
      case '$gte':
        return actual != null && comparable(actual) >= comparable(operand);
      case '$lte':
        return actual != null && comparable(actual) <= comparable(operand);
      case '$gt':
        return actual != null && comparable(actual) > comparable(operand);
      case '$lt':
        return actual != null && comparable(actual) < comparable(operand);
      case '$exists':
        return (actual !== undefined) === Boolean(operand);
      case '$regex': {
        const flags = condition.$options || '';
        const re = operand instanceof RegExp ? operand : new RegExp(operand, flags);
        return typeof actual === 'string' && re.test(actual);
      }
      case '$options':
        return true; // handled alongside $regex
      default:
        return false;
    }
  });
}

function matchesQuery(doc, query = {}) {
  return Object.entries(query).every(([key, condition]) => {
    if (key === '$or') return (condition || []).some((sub) => matchesQuery(doc, sub));
    if (key === '$and') return (condition || []).every((sub) => matchesQuery(doc, sub));
    if (key === '$nor') return !(condition || []).some((sub) => matchesQuery(doc, sub));
    return matchesCondition(getPath(doc, key), condition);
  });
}

function sortDocs(docs, spec = {}) {
  const entries = Object.entries(spec);
  if (!entries.length) return docs;
  return [...docs].sort((a, b) => {
    for (const [key, dir] of entries) {
      const av = comparable(getPath(a, key));
      const bv = comparable(getPath(b, key));
      if (av === bv) continue;
      if (av === undefined || av === null) return 1;
      if (bv === undefined || bv === null) return -1;
      return (av > bv ? 1 : -1) * (dir < 0 ? -1 : 1);
    }
    return 0;
  });
}

/** Mongo-compatible 24-char hex id. */
export function generateId() {
  const timestamp = Math.floor(Date.now() / 1000)
    .toString(16)
    .padStart(8, '0');
  const random = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return timestamp + random;
}

// --- cursor / collection ---------------------------------------------------

class DemoCursor {
  constructor(docs) {
    this.docs = docs;
    this.sortSpec = null;
    this.skipCount = 0;
    this.limitCount = null;
  }

  sort(spec) {
    this.sortSpec = spec;
    return this;
  }

  skip(n) {
    this.skipCount = n || 0;
    return this;
  }

  limit(n) {
    this.limitCount = n ?? null;
    return this;
  }

  project(fields) {
    this.projection = fields;
    return this;
  }

  async toArray() {
    let result = this.sortSpec ? sortDocs(this.docs, this.sortSpec) : this.docs;
    result = result.slice(this.skipCount, this.limitCount == null ? undefined : this.skipCount + this.limitCount);
    return structuredClone(result);
  }
}

class DemoCollection {
  constructor(name, docs) {
    this.name = name;
    this.docs = docs;
  }

  find(query = {}) {
    return new DemoCursor(this.docs.filter((doc) => matchesQuery(doc, query)));
  }

  async findOne(query = {}) {
    const doc = this.docs.find((d) => matchesQuery(d, query));
    return doc ? structuredClone(doc) : null;
  }

  async countDocuments(query = {}) {
    return this.docs.filter((doc) => matchesQuery(doc, query)).length;
  }

  async insertOne(doc) {
    const _id = doc._id || generateId();
    this.docs.push({ ...doc, _id });
    return { acknowledged: true, insertedId: _id };
  }

  async insertMany(docs) {
    const ids = docs.map((doc) => {
      const _id = doc._id || generateId();
      this.docs.push({ ...doc, _id });
      return _id;
    });
    return { acknowledged: true, insertedIds: ids, insertedCount: ids.length };
  }

  async updateOne(filter, update) {
    const index = this.docs.findIndex((doc) => matchesQuery(doc, filter));
    if (index === -1) return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };

    const doc = this.docs[index];
    if (update.$set) {
      for (const [path, value] of Object.entries(update.$set)) setPath(doc, path, value);
    }
    if (update.$push) {
      for (const [path, value] of Object.entries(update.$push)) {
        const current = getPath(doc, path);
        const list = Array.isArray(current) ? current : [];
        const items = value && value.$each ? value.$each : [value];
        setPath(doc, path, [...list, ...items]);
      }
    }
    if (update.$inc) {
      for (const [path, value] of Object.entries(update.$inc)) {
        setPath(doc, path, (getPath(doc, path) || 0) + value);
      }
    }
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  }

  async deleteOne(filter) {
    const index = this.docs.findIndex((doc) => matchesQuery(doc, filter));
    if (index === -1) return { acknowledged: true, deletedCount: 0 };
    this.docs.splice(index, 1);
    return { acknowledged: true, deletedCount: 1 };
  }

  async createIndex() {
    return this.name; // no-op: the demo store scans in memory
  }
}

class DemoDb {
  collection(name) {
    const data = store().data;
    if (!data[name]) data[name] = [];
    return new DemoCollection(name, data[name]);
  }
}

export function getDemoDb() {
  return new DemoDb();
}

export function demoSeededAt() {
  return store().seededAt;
}
