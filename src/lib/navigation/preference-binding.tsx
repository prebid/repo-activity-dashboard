'use client';
import { createContext, useContext, type ReactNode } from 'react';
import type { PreferenceBinding } from '@/models/preferences';

const PreferenceBindingContext = createContext<PreferenceBinding | null>(null);

/**
 * The signed-in session's preference binding, for client reads that no server-validated section
 * carries, such as the masthead's Contributions entry link.
 */
export function PreferenceBindingProvider({
  binding,
  children,
}: {
  binding: PreferenceBinding;
  children: ReactNode;
}) {
  return <PreferenceBindingContext value={binding}>{children}</PreferenceBindingContext>;
}

/** The session binding, or null outside the dashboard frame. */
export function usePreferenceBinding(): PreferenceBinding | null {
  return useContext(PreferenceBindingContext);
}
