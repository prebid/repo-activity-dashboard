'use client';
import Link from 'next/link';
import type { ComponentProps } from 'react';
import { previousEntry, shouldGoBack } from '@/lib/navigation/use-url-state';

/**
 * A link up to a parent view. When the parent is the entry this page was pushed from, following
 * it goes Back (`history.go(-1)`), so Forward still returns here and the parent keeps its scroll
 * and table state; otherwise it pushes the href. Modified clicks and new tabs follow the href, and
 * a click handler that prevents the default runs first and stops both.
 */
export function HistoryLink({
  href,
  onNavigate,
  ...props
}: Omit<ComponentProps<typeof Link>, 'href'> & { href: string }) {
  return (
    <Link
      {...props}
      href={href}
      onNavigate={(event) => {
        if (shouldGoBack(previousEntry(), href)) {
          event.preventDefault();
          window.history.go(-1);
          return;
        }
        onNavigate?.(event);
      }}
    />
  );
}
