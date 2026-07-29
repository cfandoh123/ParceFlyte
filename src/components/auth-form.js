'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight, Loader2, Mail } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useSession } from './session-provider';

/**
 * Sign-in form.
 *
 * With Auth0 configured this hands off to the hosted login page. In demo mode
 * there is nothing to authenticate against, so it drops straight into the app
 * as the seeded demo user — and says so, rather than faking a login.
 */
export function UserAuthForm({ className, mode = 'login', ...props }) {
  const router = useRouter();
  const { demoMode, user, loading } = useSession();
  const [submitting, setSubmitting] = useState(false);

  const enter = () => {
    setSubmitting(true);
    if (demoMode) {
      router.push('/dashboard');
      return;
    }
    window.location.href = `/api/auth/login?returnTo=/dashboard`;
  };

  const verb = mode === 'register' ? 'Create account' : 'Continue';

  return (
    <div className={cn('grid gap-6', className)} {...props}>
      {demoMode && !loading && (
        <div className="rounded-lg border bg-muted/50 p-4 text-sm">
          <p className="font-medium">Demo mode</p>
          <p className="mt-1 text-muted-foreground">
            Auth0 is not configured, so there is no sign-in step. You will enter the app as{' '}
            <strong>{user ? `${user.firstName} ${user.lastName}` : 'the demo user'}</strong>.
          </p>
        </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          enter();
        }}>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              placeholder="name@example.com"
              type="email"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect="off"
              disabled={submitting || demoMode}
              defaultValue={demoMode ? user?.email || '' : ''}
            />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
            {demoMode ? 'Enter the demo' : `${verb} with email`}
          </Button>
        </div>
      </form>

      {!demoMode && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>
          <Button variant="outline" type="button" onClick={enter} disabled={submitting}>
            Continue with Auth0
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
}
