import { useSyncExternalStore } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimelineSupportScreen } from '@/app/_screens/timeline-support-screen';
import { selectRepositoryTimelineSupport } from '@/lib/presentation/timeline-support';
import { castTimelineSample as repositoryTimelineSample } from '../support/cast-timeline';
import { selectRepositoryTimeline } from '@/lib/presentation/repository-timeline';
import type { TimelineSupport } from '@/models/timeline-support';
import { savedSection } from '../support/preference-cookies';
import { timelineQueryOf } from '../support/timeline-urls';
import {
  readTimelineSupportQuery,
  timelineSupportHref,
} from '@/lib/presentation/timeline-support-query';

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('server-only', () => ({}));
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
const href = '/repos/prebidjs?timeline&detail=prAuthors';
const detail: TimelineSupport = selectRepositoryTimelineSupport(source, report, {
  source: report.source,
  interval: report.rows[9].interval,
  metric: 'prAuthors',
  measurement: report.rows[9].values.prAuthors!,
  href,
  parentHref: '/repos/prebidjs?timeline',
  scope: '/repos/prebidjs?timeline',
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
it('starts sorted by its address, whose absent sort is the v1 default, never a saved one', () => {
  window.history.replaceState(null, '', href);
  writes.length = 0;
  const sorted = () =>
    screen
      .getAllByRole('columnheader')
      .filter((header) => /^(a|de)scending$/.test(header.getAttribute('aria-sort') ?? ''))
      .map((header) => [header.getAttribute('aria-sort'), header.textContent?.trim()]);
  const first = render(
    <TimelineSupportScreen
      detail={detail}
      viewerId="alice"
      savedSort={savedSection('timeline-support.authors.prs.sort', {
        sort: 'account',
        descending: false,
      })}
    />,
  );
  // A supporting view is never an entry, so a saved sort does not apply to its address.
  expect(sorted()).toEqual([['descending', expect.stringMatching(/^Records authored/)]]);
  first.unmount();
  window.history.replaceState(null, '', href + '&listsort=account');
  writes.length = 0;
  render(
    <TimelineSupportScreen
      detail={detail}
      viewerId="alice"
      savedSort={savedSection('timeline-support.authors.prs.sort', {
        sort: 'createdAt',
        descending: false,
      })}
    />,
  );
  expect(sorted()).toEqual([['ascending', 'GitHub account']]);
  expect(writes).toEqual([]);
});
it('freezes the authors table into history before following an author', async () => {
  window.history.replaceState(null, '', href);
  writes.length = 0;
  render(<TimelineSupportScreen detail={detail} viewerId="alice" />);
  const table = screen.getByRole('table');
  const author = within(table)
    .getAllByRole('link')
    .find((link) => link.getAttribute('href')?.includes('&author='))!;
  await userEvent.click(author);
  // The list's shown order is written into its entry first, so Back returns to it.
  expect(writes).toEqual([
    'replaceState /repos/prebidjs?timeline&listsort=-recordCount&detail=prAuthors',
  ]);
  expect(navigation.push).toHaveBeenCalledTimes(1);
  expect(String(navigation.push.mock.calls[0][0])).toBe(author.getAttribute('href'));
});
it('writes no history and follows nothing while another scope is arriving', async () => {
  window.history.replaceState(null, '', '/repos/prebidjs?timeline&detail=prsOpened');
  writes.length = 0;
  render(<TimelineSupportScreen detail={detail} viewerId="alice" />);
  const table = screen.getByRole('table');
  for (const link of within(table).queryAllByRole('link')) await userEvent.click(link);
  expect(writes).toEqual([]);
  expect(navigation.push).not.toHaveBeenCalled();
  for (const control of screen.getAllByRole('group'))
    if (control.getAttribute('aria-label')?.endsWith('table controls'))
      expect(control).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Columns' })).toBeDisabled();
});
it('freezes the list before a column change, and Back restores the earlier columns', async () => {
  const user = userEvent.setup();
  window.history.replaceState(null, '', href);
  writes.length = 0;
  render(<TimelineSupportScreen detail={detail} viewerId="alice" />);
  await user.click(screen.getByRole('button', { name: 'Columns' }));
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'Account type' }));
  // The list's columns at their defaults need no freezing: the change is one new entry.
  expect(writes).toEqual(['pushState ' + href + '&dcols=-accountType']);
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('columnheader', { name: /^Account type/ })).not.toBeInTheDocument();
  window.history.back();
  await waitFor(() =>
    expect(screen.getByRole('columnheader', { name: /^Account type/ })).toBeInTheDocument(),
  );
  expect(window.location.pathname + window.location.search).toBe(href);
});
it('moves Back and Forward through a search in an author records list', async () => {
  const user = userEvent.setup();
  if (detail.kind !== 'authors') throw Error('Expected an authors list');
  const account = detail.rows[0].account;
  const authorHref = href + '&author=' + account;
  const records = selectRepositoryTimelineSupport(
    source,
    report,
    { ...detail.context, href: authorHref },
    account,
  );
  window.history.replaceState(null, '', authorHref);
  writes.length = 0;
  render(<TimelineSupportScreen detail={records} viewerId="alice" />);
  const search = screen.getByRole('textbox', { name: /^Search / });
  await user.type(search, 'Sample{Enter}');
  expect(writes.some((write) => /^pushState .*&dq=Sample/.test(write))).toBe(true);
  const query = () => new URL(window.location.href).searchParams.get('dq');
  window.history.back();
  await waitFor(() => expect(query()).toBeNull());
  await waitFor(() => expect(screen.getByRole('textbox', { name: /^Search / })).toHaveValue(''));
  window.history.forward();
  await waitFor(() => expect(query()).toBe('Sample'));
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: /^Search / })).toHaveValue('Sample'),
  );
});
it('opens an author records list without its Author column', () => {
  if (detail.kind !== 'authors') throw Error('Expected an authors list');
  const account = detail.rows[0].account;
  const authorHref = href + '&author=' + account;
  const records = selectRepositoryTimelineSupport(
    source,
    report,
    { ...detail.context, href: authorHref },
    account,
  );
  window.history.replaceState(null, '', authorHref);
  render(<TimelineSupportScreen detail={records} viewerId="alice" />);
  const table = screen.getByRole('table', { name: 'Records by @' + account });
  expect(within(table).getByRole('columnheader', { name: 'Title' })).toBeVisible();
  expect(within(table).queryByRole('columnheader', { name: 'Author' })).not.toBeInTheDocument();
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
    href: '/repos/prebidjs?timeline&detail=prsMerged',
    parentHref: '/repos/prebidjs?timeline',
    scope: '/repos/prebidjs?timeline',
  });
  window.history.replaceState(null, '', '/repos/prebidjs?timeline&detail=prsMerged');
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
    href: '/repos/prebidjs?timeline&detail=humanApprovals1',
    parentHref: '/repos/prebidjs?timeline',
    scope: '/repos/prebidjs?timeline',
  });
  window.history.replaceState(null, '', '/repos/prebidjs?timeline&detail=humanApprovals1');
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
it('stops supporting-table search at the length the support loader accepts', async () => {
  const supportHref = timelineSupportHref(
    '/repos/prebidjs?timeline',
    report.source,
    'prAuthors',
    report.rows[9].interval.id,
  )!;
  expect(readTimelineSupportQuery(timelineQueryOf(supportHref))).not.toBeNull();
  const linked = selectRepositoryTimelineSupport(source, report, {
    source: report.source,
    interval: report.rows[9].interval,
    metric: 'prAuthors',
    measurement: report.rows[9].values.prAuthors!,
    href: supportHref,
    parentHref: '/repos/prebidjs?timeline',
    scope: '/repos/prebidjs?timeline',
  });
  window.history.replaceState(null, '', supportHref);
  render(<TimelineSupportScreen detail={linked} viewerId="alice" />);
  const search = screen.getByRole('textbox', { name: /^Search / });
  expect(search).toHaveAttribute('maxlength', '200');
  await userEvent.type(search, 'a'.repeat(201) + '{Enter}');
  expect(search).toHaveValue('a'.repeat(200));
  const params = new URL(window.location.href).searchParams;
  expect(params.get('listq')).toBe('a'.repeat(200));
  expect(readTimelineSupportQuery(timelineQueryOf(window.location.href))).not.toBeNull();
});
