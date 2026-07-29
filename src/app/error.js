'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Route-level error boundary. Catches anything thrown while rendering a page,
 * keeps the app shell alive, and offers a retry that re-renders the segment
 * rather than forcing a full reload.
 */
export default function Error({ error, reset }) {
  useEffect(() => {
    // In production this is where an error reporter would be called.
    console.error('[page error]', error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md rounded-xl border bg-background p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>

        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This page failed to load. The rest of the app is still working, so you can retry or head back.
        </p>

        {error?.message && (
          <p className="mt-4 break-words rounded-md bg-muted px-3 py-2 text-left font-mono text-xs text-muted-foreground">
            {error.message}
            {error.digest && <span className="mt-1 block opacity-70">Reference: {error.digest}</span>}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={reset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Try again
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard">
              <Home className="mr-2 h-4 w-4" />
              Back to dashboard
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
