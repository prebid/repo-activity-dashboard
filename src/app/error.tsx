'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h2>Application Error</h2>
      <details style={{ whiteSpace: 'pre-wrap', marginTop: '20px' }}>
        <summary>Error Details (click to expand)</summary>
        <pre style={{ background: '#f0f0f0', padding: '10px', marginTop: '10px', overflow: 'auto' }}>
          {error.message}
          {'\n\n'}
          {error.stack}
        </pre>
      </details>
      <button
        onClick={reset}
        style={{
          marginTop: '20px',
          padding: '10px 20px',
          background: '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        Try again
      </button>
    </div>
  );
}