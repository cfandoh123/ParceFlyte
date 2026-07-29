'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const SessionContext = createContext(null);

/**
 * Loads the signed-in user from /api/session.
 *
 * This works the same whether the app is running on Auth0 or on the demo
 * session, so no component needs to know which is in play.
 */
export function SessionProvider({ children }) {
  const [state, setState] = useState({ user: null, demoMode: false, loading: true, error: null });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/session');
      if (!res.ok) throw new Error('Could not load your session');
      const data = await res.json();
      setState({ user: data.user, demoMode: data.demoMode, loading: false, error: null });
    } catch (error) {
      setState({ user: null, demoMode: false, loading: false, error: error.message });
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
