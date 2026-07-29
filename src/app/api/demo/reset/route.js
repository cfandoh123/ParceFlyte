import { isDemoMode } from '@/lib/db';
import { resetDemoStore } from '@/lib/demo-store';
import { ok, forbidden } from '@/lib/api';

/** Restore the demo dataset to its seeded state. Demo mode only. */
export async function POST() {
  if (!isDemoMode()) {
    return forbidden('Demo reset is only available when running on demo data');
  }
  const seededAt = resetDemoStore();
  return ok({ message: 'Demo data reset', seededAt });
}
