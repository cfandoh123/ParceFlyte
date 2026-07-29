import { withAuth } from '@/lib/auth';
import { ok, pagination, paginated } from '@/lib/api';
import matchingService from '@/lib/matching-service';

/** These handlers read the request and the session, so they are never prerendered. */
export const dynamic = 'force-dynamic';

/**
 * Carrier discovery.
 *
 * With `parcelId`, every candidate travel is scored against that parcel and
 * returned with a full score breakdown. Without it, this is a plain search over
 * open travels — useful before a sender has listed anything.
 */
export const GET = withAuth(['read:matches'], async (req) => {
  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = pagination(searchParams);
  const get = (key) => searchParams.get(key);

  const parcelId = get('parcelId');

  if (parcelId) {
    const options = {
      maxFee: get('maxFee') || undefined,
      travelMode: get('travelMode') || undefined,
      departureCountry: get('departureCountry') || undefined,
      arrivalCountry: get('arrivalCountry') || undefined,
    };

    let matches = await matchingService.findMatchesForParcel(parcelId, options);

    const minScore = get('minScore');
    if (minScore) matches = matches.filter((m) => m.matchScore >= parseFloat(minScore));

    const minRating = get('minRating');
    if (minRating) {
      matches = matches.filter((m) => (m.carrier?.rating?.average || 0) >= parseFloat(minRating));
    }

    return ok({
      ...paginated(matches.slice(skip, skip + limit), matches.length, { page, limit }),
      mode: 'scored',
      parcelId,
    });
  }

  const criteria = {
    departureCity: get('departureCity') || undefined,
    arrivalCity: get('arrivalCity') || undefined,
    departureCountry: get('departureCountry') || undefined,
    arrivalCountry: get('arrivalCountry') || undefined,
    weight: get('weight') || undefined,
    volume: get('volume') || undefined,
    maxFee: get('maxFee') || undefined,
    travelMode: get('travelMode') || undefined,
    deliveryDeadline: get('deliveryDeadline') || undefined,
  };

  let { results, total } = await matchingService.findAvailableTravels(criteria, { skip, limit });

  const minRating = get('minRating');
  if (minRating) {
    results = results.filter((r) => (r.carrier?.rating?.average || 0) >= parseFloat(minRating));
  }

  return ok({ ...paginated(results, total, { page, limit }), mode: 'browse' });
});
