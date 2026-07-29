import { toId } from './db';

/** How long a proposed match stays open before it expires. */
export const MATCH_TTL_DAYS = 7;

/**
 * Attach the parcel, travel, sender and carrier each match references.
 * Four queries total regardless of how many matches are passed in.
 */
export async function hydrateMatches(db, matches) {
  if (!matches.length) return [];

  const unique = (values) => [...new Set(values.filter(Boolean).map(String))];
  const byId = (docs) => Object.fromEntries(docs.map((d) => [String(d._id), d]));

  const [parcels, travels, users] = await Promise.all([
    db
      .collection('parcels')
      .find({ _id: { $in: unique(matches.map((m) => m.parcelId)).map(toId) } })
      .toArray(),
    db
      .collection('travels')
      .find({ _id: { $in: unique(matches.map((m) => m.travelId)).map(toId) } })
      .toArray(),
    db
      .collection('users')
      .find({ _id: { $in: unique(matches.flatMap((m) => [m.senderId, m.carrierId])).map(toId) } })
      .toArray(),
  ]);

  const parcelMap = byId(parcels);
  const travelMap = byId(travels);
  const userMap = byId(users);

  return matches.map((match) => ({
    ...match,
    parcel: parcelMap[String(match.parcelId)] || null,
    travel: travelMap[String(match.travelId)] || null,
    sender: userMap[String(match.senderId)] || null,
    carrier: userMap[String(match.carrierId)] || null,
  }));
}
