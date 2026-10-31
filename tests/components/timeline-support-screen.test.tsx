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
