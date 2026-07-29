'use client';

import { useEffect } from 'react';

/**
 * Last-resort boundary for errors thrown in the root layout itself.
 *
 * This replaces the whole document, so it must render its own <html> and
 * <body> and cannot rely on the app's providers or stylesheet — the styles
 * here are inline for that reason.
 */
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error('[global error]', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          background: '#f8fafc',
          color: '#0f172a',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
        }}>
        <div
          style={{
            maxWidth: '28rem',
            width: '100%',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '0.75rem',
            padding: '2rem',
            textAlign: 'center',
          }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>ParceFlyte could not start</h1>
          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#64748b' }}>
            Something failed before the app finished loading. Reloading usually clears it.
          </p>
          {error?.digest && (
            <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#94a3b8' }}>Reference: {error.digest}</p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: '1.5rem',
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: 'none',
              background: '#0f172a',
              color: '#fff',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
