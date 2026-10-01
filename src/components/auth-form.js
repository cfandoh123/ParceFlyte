'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { fullName } from '@/lib/format';
import { Button } from './ui/button';
import { useSession } from './session-provider';

/**
 * Sign-in / sign-up entry point.
 *
 * With Auth0 configured this hands off to the hosted login page, which is
 * where credentials are actually entered. Without it there is nothing to
 * authenticate against, so it drops straight into the app as the seeded demo
 * user — and says so, rather than faking a login.
 */
export function UserAuthForm({ className, mode = 'login', ...props }) {
  const router = useRouter();
  const { authEnabled, user, loading, error } = useSession();
  const [submitting, setSubmitting] = useState(false);

  const signedIn = Boolean(user);

  const enter = () => {
    setSubmitting(true);
    if (!authEnabled || signedIn) {
      router.push('/dashboard');
      return;
    }
    window.location.href = mode === 'register' ? '/api/auth/signup' : '/api/auth/login?returnTo=/dashboard';
  };

  let label = mode === 'register' ? 'Create your account' : 'Sign in';
  if (signedIn) label = `Continue as ${fullName(user)}`;
  if (!authEnabled) label = 'Enter the demo';

  return (
    <div className={cn('grid gap-6', className)} {...props}>
      {!authEnabled && !loading && !error && (
        <div className="rounded-lg border bg-muted/50 p-4 text-sm">
          <p className="font-medium">Demo mode</p>
          <p className="mt-1 text-muted-foreground">
            Sign-in is not configured, so there is no login step. You will enter the app as{' '}
            <strong>{user ? fullName(user) : 'the demo user'}</strong>.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <Button onClick={enter} disabled={submitting || loading || Boolean(error)}>
        {submitting || loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {label}
        {!submitting && !loading && <ArrowRight className="ml-2 h-4 w-4" />}
      </Button>

      {authEnabled && !signedIn && (
        <p className="text-center text-xs text-muted-foreground">
          You will be taken to our secure sign-in page and returned here afterwards.
        </p>
      )}
    </div>
  );
}
