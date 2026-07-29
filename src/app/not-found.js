import Link from 'next/link';
import { Compass, Home, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';

/** 404 — an unknown URL, or a `notFound()` call from a page. */
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md rounded-xl border bg-background p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Compass className="h-6 w-6 text-muted-foreground" />
        </div>

        <p className="text-sm font-semibold text-muted-foreground">404</p>
        <h1 className="mt-1 text-xl font-semibold">This page does not exist</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The link may be out of date, or the parcel or trip it pointed to may have been removed.
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href="/dashboard">
              <Home className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/browse">
              <Search className="mr-2 h-4 w-4" />
              Find a carrier
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
