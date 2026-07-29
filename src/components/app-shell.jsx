'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  Package,
  Plane,
  Handshake,
  ShieldCheck,
  Search,
  Menu,
  X,
  RotateCcw,
  ClipboardCheck,
} from 'lucide-react';

import Logo from '@/assets/images/logo.png';
import { cn } from '@/lib/utils';
import { fullName, initials } from '@/lib/format';
import { useSession } from '@/components/session-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

const NAV = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/parcels', label: 'My parcels', icon: Package },
  { href: '/travels', label: 'My trips', icon: Plane },
  { href: '/browse', label: 'Find a carrier', icon: Search },
  { href: '/matches', label: 'Matches', icon: Handshake },
  { href: '/kyc', label: 'Verification', icon: ShieldCheck },
];

/** Only shown to users holding the admin role. */
const ADMIN_NAV = [{ href: '/admin/kyc', label: 'KYC queue', icon: ClipboardCheck }];

function Avatar({ user, className }) {
  return (
    <div
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white',
        className
      )}
      style={{ backgroundColor: user?.avatarColor || '#64748b' }}
      aria-hidden="true">
      {initials(user)}
    </div>
  );
}

/** Reset link, shown only when running on demo data. */
function DemoBanner() {
  const { demoMode, refresh } = useSession();
  const { toast } = useToast();
  const [resetting, setResetting] = useState(false);

  if (!demoMode) return null;

  const reset = async () => {
    setResetting(true);
    try {
      const res = await fetch('/api/demo/reset', { method: 'POST' });
      if (!res.ok) throw new Error('Reset failed');
      await refresh();
      toast({ title: 'Demo data reset', description: 'Everything is back to its starting state.' });
      // Re-fetch whatever the current page is showing.
      window.location.reload();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not reset', description: error.message });
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 border-b bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      <p>
        <strong className="font-semibold">Demo mode.</strong> Running on seeded in-memory data — changes persist until
        the server restarts.
      </p>
      <button
        onClick={reset}
        disabled={resetting}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 font-medium underline-offset-2 hover:underline disabled:opacity-50">
        <RotateCcw className={cn('h-3.5 w-3.5', resetting && 'animate-spin')} />
        {resetting ? 'Resetting…' : 'Reset data'}
      </button>
    </div>
  );
}

/** Sidebar + header chrome for every signed-in page. */
export function AppShell({ children, title, description, actions }) {
  const pathname = usePathname();
  const { user, loading } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = user?.roles?.includes('admin');

  const navLink = ({ href, label, icon: Icon }) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        key={href}
        href={href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}>
        <Icon className="h-4 w-4 shrink-0" />
        {label}
      </Link>
    );
  };

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map(navLink)}

      {isAdmin && (
        <>
          <p className="mt-4 px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Admin</p>
          {ADMIN_NAV.map(navLink)}
        </>
      )}
    </nav>
  );

  return (
    <div className="min-h-screen bg-muted/30">
      <DemoBanner />

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-background p-4 lg:flex">
          <Link href="/" className="mb-6 flex items-center gap-2 px-2">
            <Image src={Logo} alt="" className="h-9 w-auto" />
            <span className="text-lg font-bold">Parceflyte</span>
          </Link>

          {nav}

          <div className="mt-auto border-t pt-4">
            {loading ? (
              <div className="h-9 animate-pulse rounded-md bg-muted" />
            ) : (
              <div className="flex items-center gap-3 px-1">
                <Avatar user={user} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{fullName(user)}</p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>
            )}
            {user?.kycStatus && (
              <Link href="/kyc" className="mt-3 block">
                <Badge variant={user.kycStatus === 'verified' ? 'success' : 'warning'} className="w-full justify-center">
                  <ShieldCheck className="mr-1 h-3 w-3" />
                  {user.kycStatus === 'verified' ? 'Verified' : 'Verification pending'}
                </Badge>
              </Link>
            )}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {/* Mobile header */}
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen((o) => !o)} aria-label="Toggle menu">
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <Link href="/" className="flex items-center gap-2">
              <Image src={Logo} alt="" className="h-8 w-auto" />
              <span className="font-bold">Parceflyte</span>
            </Link>
            <div className="ml-auto">
              <Avatar user={user} className="h-8 w-8" />
            </div>
          </header>

          {mobileOpen && (
            <div className="border-b bg-background p-4 lg:hidden">{nav}</div>
          )}

          <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
            {(title || actions) && (
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  {title && <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>}
                  {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
                </div>
                {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
              </div>
            )}
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

export { Avatar };
