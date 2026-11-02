import { fireEvent, render, screen } from '@testing-library/react';
import type { MouseEvent, ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { HistoryLink } from '@/components/navigation/history-link';
import { PageHeader } from '@/components/navigation/page-header';
import { historyMarkerKey } from '@/lib/navigation/use-url-state';

// Vitest resolves next/link to the Pages Router copy, which never reaches `onNavigate` without a
// router. This stand-in keeps the App Router Link's order: the caller's onClick, then, for an
// unmodified click it did not prevent, onNavigate, then the navigation unless that was prevented.
const navigations = vi.hoisted(() => [] as string[]);
vi.mock('next/link', () => ({
  default: ({
    href,
    onClick,
    onNavigate,
    children,
  }: {
    href: string;
    onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
    onNavigate?: (event: { preventDefault(): void }) => void;
    children: ReactNode;
  }) => (
    <a
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || event.metaKey || event.ctrlKey) return;
        event.preventDefault();
        let prevented = false;
        onNavigate?.({ preventDefault: () => (prevented = true) });
        if (!prevented) navigations.push(href);
      }}
    >
      {children}
    </a>
  ),
  useLinkStatus: () => ({ pending: false }),
}));
afterEach(() => {
  navigations.length = 0;
  window.history.replaceState(null, '', '/');
});

it('goes Back when the crumb is the entry this page was pushed from', () => {
  const go = vi.spyOn(window.history, 'go').mockImplementation(() => undefined);
  window.history.replaceState({ [historyMarkerKey]: '/repos?v=1' }, '', '/repos/prebidjs');
  render(
    <PageHeader
      title="Prebid.js"
      asOf="2026-10-31T16:00:00.000Z"
      breadcrumbs={[{ label: 'All', href: '/repos' }]}
    />,
  );
  fireEvent.click(screen.getByRole('link', { name: 'All' }));
  expect(go).toHaveBeenCalledWith(-1);
  expect(navigations).toEqual([]);
  // A modified click opens the href the browser's way.
  go.mockClear();
  fireEvent.click(screen.getByRole('link', { name: 'All' }), { metaKey: true });
  expect(go).not.toHaveBeenCalled();
});

it('pushes the href when the parent is not the previous entry', () => {
  const go = vi.spyOn(window.history, 'go').mockImplementation(() => undefined);
  window.history.replaceState({ [historyMarkerKey]: '/repos?age=' }, '', '/repos/prebidjs');
  const onNavigate = vi.fn();
  render(
    <HistoryLink href="/repos" onNavigate={onNavigate}>
      All
    </HistoryLink>,
  );
  fireEvent.click(screen.getByRole('link', { name: 'All' }));
  expect(go).not.toHaveBeenCalled();
  expect(onNavigate).toHaveBeenCalledTimes(1);
  expect(navigations).toEqual(['/repos']);
});

it('lets a crumb’s own handler take the click first', () => {
  const go = vi.spyOn(window.history, 'go').mockImplementation(() => undefined);
  window.history.replaceState({ [historyMarkerKey]: '/contributors' }, '', '/contributors/a');
  const follow = vi.fn((event: { preventDefault(): void }) => event.preventDefault());
  render(
    <PageHeader
      title="A"
      asOf="2026-10-31T16:00:00.000Z"
      breadcrumbs={[{ label: 'Back to report', href: '/contributors', onClick: follow }]}
    />,
  );
  fireEvent.click(screen.getByRole('link', { name: 'Back to report' }));
  expect(follow).toHaveBeenCalledTimes(1);
  expect(go).not.toHaveBeenCalled();
  expect(navigations).toEqual([]);
});
