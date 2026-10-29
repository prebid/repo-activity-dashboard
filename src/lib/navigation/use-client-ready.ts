'use client';
import { useEffect, useState } from 'react';

/** Server markup can appear before React handlers and navigation listeners are attached. */
export function useClientReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}
