import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
afterEach(() => {
  if (typeof window !== 'undefined') {
    cleanup();
    window.history.replaceState(null, '', '/');
    window.localStorage.clear();
  }
});
