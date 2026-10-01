'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const SessionContext = createContext(null);

const SIGNED_OUT = { user: null, demoMode: false, authEnabled: false, loading: false, error: null };

/**
 * Loads the signed-in user from /api/session.
 *
 * This works the same whether the app is running on Auth0 or on the demo
 * session: `user` is null when nobody is signed in, and `authEnabled` says
 * whether there is a real sign-in to send them to.
 */
export function SessionProvider({ children }) {
  const [state, setState] = useState({ ...SIGNED_OUT, loading: true });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/session');
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Could not load your session');
      setState({
        user: data.user,
        demoMode: data.demoMode,
        authEnabled: data.authEnabled,
        loading: false,
        error: null,
      });
    } catch (error) {
      setState({ ...SIGNED_OUT, error: error.message });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(() => ({ ...state, refresh }), [state, refresh]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside a SessionProvider');
  return ctx;
}
