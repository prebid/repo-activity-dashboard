import { useSyncExternalStore } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimelineSupportScreen } from '@/app/_screens/timeline-support-screen';
import { selectRepositoryTimelineSupport } from '@/lib/presentation/timeline-support';
import { repositoryTimelineSample } from '@/mocks/repository-timeline';
import { selectRepositoryTimeline } from '@/lib/presentation/repository-timeline';
import type { TimelineSupport } from '@/models/timeline-support';

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
const subscribe = (notify: () => void) => {
  window.addEventListener('test-navigation', notify);
  window.addEventListener('popstate', notify);
  return () => {
    window.removeEventListener('test-navigation', notify);
    window.removeEventListener('popstate', notify);
  };
};
vi.mock('next/navigation', () => ({
  useRouter: () => navigation,
  usePathname: () => useSyncExternalStore(subscribe, () => window.location.pathname),
  useSearchParams: () =>
    new URLSearchParams(useSyncExternalStore(subscribe, () => window.location.search)),
}));
const request = {
  grouping: 'month' as const,
  range: { start: '2026-01-01T00:00:00.000Z', end: '2026-10-24T12:00:00.000Z', endInclusive: true },
};
const source = repositoryTimelineSample(),
  report = selectRepositoryTimeline(source, request);
const href = '/repos/prebidjs?timeline=1&timeline.detail=prAuthors';
const detail: TimelineSupport = selectRepositoryTimelineSupport(source, report, {
  source: report.source,
  interval: report.rows[9].interval,
  metric: 'prAuthors',
  measurement: report.rows[9].values.prAuthors!,
  href,
  parentHref: '/repos/prebidjs?timeline=1',
  scope: '/repos/prebidjs?timeline=1',
});
const writes: string[] = [];
beforeEach(() => {
  writes.length = 0;
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = window.history[method].bind(window.history);
    vi.spyOn(window.history, method).mockImplementation((state, unused, url) => {
      original(state, unused, url);
      writes.push(method + ' ' + String(url));
      window.dispatchEvent(new Event('test-navigation'));
    });
  }
  navigation.push.mockReset();
});
afterEach(() => vi.restoreAllMocks());
it('freezes the authors table into history before following an author', async () => {
  window.history.replaceState(null, '', href);
  writes.length = 0;
  render(<TimelineSupportScreen detail={detail} viewerId="alice" />);
  const table = screen.getByRole('table');
  const author = within(table)
    .getAllByRole('link')
    .find((link) => link.getAttribute('href')?.includes('support.author'))!;
  await userEvent.click(author);
  expect(writes[0]).toMatch(/^replaceState \/repos\/prebidjs\?/);
  expect(navigation.push).toHaveBeenCalledTimes(1);
  expect(String(navigation.push.mock.calls[0][0])).toContain('support.author=');
});
it('writes no history and follows nothing while another scope is arriving', async () => {
  window.history.replaceState(null, '', '/repos/prebidjs?timeline=1&timeline.detail=prsOpened');
  writes.length = 0;
  render(<TimelineSupportScreen detail={detail} viewerId="alice" />);
  const table = screen.getByRole('table');
  for (const link of within(table).queryAllByRole('link')) await userEvent.click(link);
  expect(writes).toEqual([]);
  expect(navigation.push).not.toHaveBeenCalled();
  for (const control of screen.getAllByRole('group'))
    if (control.getAttribute('aria-label')?.endsWith('table controls'))
      expect(control).toBeDisabled();
});
it('opens supporting record lists with the shared record column defaults', () => {
  const headers = () =>
    screen.getAllByRole('columnheader').map((cell) => cell.textContent?.trim() ?? '');
  const merged = report.rows.findIndex((row) => (row.values.prsMerged?.value ?? 0) > 0);
  const event = selectRepositoryTimelineSupport(source, report, {
    source: report.source,
    interval: report.rows[merged].interval,
    metric: 'prsMerged',
    measurement: report.rows[merged].values.prsMerged!,
    href: '/repos/prebidjs?timeline=1&timeline.detail=prsMerged',
    parentHref: '/repos/prebidjs?timeline=1',
    scope: '/repos/prebidjs?timeline=1',
  });
  window.history.replaceState(null, '', '/repos/prebidjs?timeline=1&timeline.detail=prsMerged');
  const first = render(<TimelineSupportScreen detail={event} viewerId="alice" />);
  const activity = headers();
  for (const visible of [/^Merged/, /^Base branch/, /^Created/])
    expect(activity.some((name) => visible.test(name))).toBe(true);
  for (const hidden of [/^Latest activity/, /^Age/, /^Latest actor/])
    expect(activity.some((name) => hidden.test(name))).toBe(false);
  first.unmount();
  const cutoff = selectRepositoryTimeline(
    source,
    {
      grouping: 'day',
      range: {
        start: '2026-10-21T00:00:00.000Z',
        end: '2026-10-22T00:00:00.000Z',
        endInclusive: false,
      },
    },
    'snapshot',
  );
  const snapshot = selectRepositoryTimelineSupport(source, cutoff, {
    source: cutoff.source,
    interval: cutoff.rows[0].interval,
    metric: 'humanApprovals1',
    measurement: cutoff.rows[0].values.humanApprovals1!,
    href: '/repos/prebidjs?timeline=1&timeline.detail=humanApprovals1',
    parentHref: '/repos/prebidjs?timeline=1',
    scope: '/repos/prebidjs?timeline=1',
  });
  window.history.replaceState(
    null,
    '',
    '/repos/prebidjs?timeline=1&timeline.detail=humanApprovals1',
  );
  render(<TimelineSupportScreen detail={snapshot} viewerId="alice" />);
  const atCutoff = headers();
  for (const visible of [
    /^Human approvals at cutoff/,
    /^Age at cutoff \(days\)/,
    /^Latest activity/,
  ])
    expect(atCutoff.some((name) => visible.test(name))).toBe(true);
  for (const hidden of [/^Created/, /^Merged/, /^Latest actor/])
    expect(atCutoff.some((name) => hidden.test(name))).toBe(false);
});
