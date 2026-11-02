import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const { viewer } = vi.hoisted(() => ({ viewer: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/viewer', () => ({ requireViewer: viewer }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw Error('not-found');
  },
}));
import { loadTimelineReport, loadTimelineView } from '@/server/timeline-report';
import { loadTimelineSupport } from '@/server/timeline-support';
import { timelineEntryValues, timelineView } from '@/server/timeline-preview';
import { timelineCsvDownload } from '@/components/reporting/timeline-csv-download';
import { viewOf } from '@/lib/presentation/url/back';
import { preferenceSnapshot } from '@/server/preferences';
import {
  encodePreferenceDocument,
  withPreferenceSection,
} from '@/lib/presentation/preference-cookie';
import type { PreferenceSectionKey } from '@/models/preferences';

beforeEach(() => {
  viewer.mockReset().mockResolvedValue({ id: 'sample-viewer', authVersion: 0 });
});
afterEach(() => vi.unstubAllGlobals());
const view = (href: string) => viewOf(href)!;
const binding = { accountId: 'sample-viewer', authVersion: 0 };
function snapshot(
  cookie: 'repositories' | 'contributions',
  sections: Partial<Record<PreferenceSectionKey, unknown>>,
) {
  let document = null;
  for (const [section, value] of Object.entries(sections))
    document = withPreferenceSection(document, binding, section as PreferenceSectionKey, value);
  return preferenceSnapshot(cookie, binding, document ? encodePreferenceDocument(document) : '');
}

describe('Timeline downloads', () => {
  it('serve an old link whatever its return context, and only Timeline views', async () => {
    // An unusable old parent no longer refuses the download: return context changes no bytes.
    expect(
      (await loadTimelineReport('/repos/prebidjs?timeline=1&timelineParent=%2Ffoundation')).status,
    ).toBe('ready');
    expect((await loadTimelineReport('/repos/prebidjs?timeline&back=!')).status).toBe('ready');
    for (const href of [
      '/repos/prebidjs',
      '/repos?timeline&unknown',
      '/repos?timeline=1&timeline.group=decade',
      'https://example.test/repos?timeline',
    ])
      expect((await loadTimelineReport(href)).status, href).toBe('invalid');
    expect((await loadTimelineView(view('/contributors'))).status).toBe('invalid');
  });
  it('post the table’s current order, keeping an address the codec does not read', async () => {
    const fetch = vi.fn((_url: string, _init: RequestInit) =>
      Promise.resolve(new Response('a', { headers: { 'content-type': 'text/csv' } })),
    );
    vi.stubGlobal('fetch', fetch);
    const source = { source: 'sample' as const, scenarioId: 'r', asOf: '2026-10-24T12:00:00.000Z' };
    const body = async (href: string, sort: string) => {
      fetch.mockClear();
      await timelineCsvDownload(
        href,
        source,
      )({
        columnIds: ['period'],
        query: { search: '', sort, descending: false, page: 1 },
        signal: new AbortController().signal,
      });
      const [, init] = fetch.mock.calls[0];
      return (JSON.parse(init.body as string) as { href: string }).href;
    };
    expect(await body('/repos/prebidjs?timeline&sort=-prsOpened', 'period')).toBe(
      '/repos/prebidjs?timeline',
    );
    expect(await body('/repos/prebidjs?timeline', '')).toBe('/repos/prebidjs?timeline');
    expect(await body('/repos/prebidjs?timeline=1', 'period')).toBe('/repos/prebidjs?timeline=1');
  });
});

describe('Timeline pages from registry values', () => {
  it('render the invalid view for values the Timeline cannot read', async () => {
    for (const href of [
      '/repos/prebidjs?timeline&cols=unknown',
      '/companies?timeline&lens=reviewers',
      '/repos?timeline&back=~q:' + 'x'.repeat(7480),
    ])
      expect((await timelineView(view(href))).status, href).toBe('invalid');
    await expect(timelineView(view('/repos/absent?timeline'))).rejects.toThrow('not-found');
    await expect(timelineView(view('/contributors/account-absent?timeline'))).rejects.toThrow(
      'not-found',
    );
  });
  it('name a subject’s Over time crumbs, unavailable when their frame cannot be restored', async () => {
    const company = await timelineView(view('/companies/unmapped?timeline'));
    if (company.status !== 'ready' || !('reportHref' in company)) throw Error('Expected Over time');
    expect([company.reportHref, company.returnTo]).toEqual([
      '/companies/unmapped?v=1',
      '/companies?v=1',
    ]);
    const lost = await timelineView(view('/contributors/account-alice?timeline&back=-&back=!'));
    expect(lost.status === 'ready' && 'reportHref' in lost && lost.returnTo).toBeNull();
    const overview = await timelineView(view('/companies?timeline'));
    expect(overview.status === 'ready' && 'reportHref' in overview && overview.returnTo).toBe(
      undefined,
    );
  });
  it('resolve an entry’s saved view per route, and nothing for an unreadable entry', async () => {
    const week = { version: 1, query: 'timeline.group=week' };
    expect(
      await timelineEntryValues(
        view('/repos/prebidjs?timeline'),
        snapshot('repositories', { 'timeline.repository': week }),
      ),
    ).toEqual({ scope: {}, presentation: { group: 'week' } });
    expect(
      await timelineEntryValues(
        view('/contributors/account-alice?timeline'),
        snapshot('contributions', { 'timeline.contributors.contributor': week }),
      ),
    ).toEqual({ scope: {}, presentation: { group: 'week' } });
    expect(
      await timelineEntryValues(
        view('/companies/id/company-acme?timeline'),
        snapshot('contributions', { 'timeline.companies.company': week }),
      ),
    ).toEqual({ scope: {}, presentation: { group: 'week' } });
    expect(
      await timelineEntryValues(
        view('/companies?timeline&lens=reviewers'),
        snapshot('contributions', { 'timeline.companies.overview': week }),
      ),
    ).toBeNull();
  });
});

describe('supporting views from registry values', () => {
  it('render the invalid view for a cell the codec cannot write or that does not fit', async () => {
    expect(
      (await loadTimelineSupport(view('/repos/prebidjs?timeline&detail=prsOpened'))).status,
    ).toBe('invalid');
    expect(
      (
        await loadTimelineSupport(
          view(
            '/repos/prebidjs?timeline&cols=unknown&detail=prsOpened&interval=month:2026-10-01&snap=r@2026-10-24',
          ),
        )
      ).status,
    ).toBe('invalid');
    // A matrix-origin view whose Timeline names no matrix cannot return to one.
    const matrixless = await loadTimelineSupport(
      view(
        '/repos/prebidjs?timeline&detail=prsOpened&interval=month:2026-10-01&snap=repositories-reference-v1@2026-10-24T12:00Z&origin=matrix',
      ),
    );
    expect(matrixless).toMatchObject({ status: 'invalid', parentHref: '/repos/prebidjs?timeline' });
  });
});

describe('Timeline loader checks behind registry values', () => {
  it('render the invalid view where the Timeline readers reject the scope', async () => {
    for (const href of [
      // More than 500 intervals.
      '/repos?timeline&group=day&period=2020-01-01..2026-10-24',
      '/repos/prebidjs?timeline&group=day&period=2020-01-01..2026-10-24',
      '/contributors?timeline&group=day&period=2020-01-01..2026-10-24',
      // A snapshot-only record filter on an activity Timeline.
      '/repos/prebidjs?timeline&reviewers=0',
    ])
      expect((await timelineView(view(href))).status, href).toBe('invalid');
  });
  // Building the mixed matrix sample takes about a second on a developer machine and over five
  // seconds on a loaded CI runner, past Vitest's default timeout.
  it('load a matrix of mixed record kinds', { timeout: 15_000 }, async () => {
    const mixed = await timelineView(view('/repos?timeline&metric=prsOpened,issuesOpened'));
    expect(mixed.status === 'ready' && 'matrix' in mixed && mixed.matrix.scope.metrics).toEqual([
      'prsOpened',
      'issuesOpened',
    ]);
  });
  it('render a matrix entry whose saved values add nothing', async () => {
    const entry = await timelineView(view('/repos?timeline'), {
      entry: true,
      preferences: snapshot('repositories', { overview: 'kept' }),
    });
    expect(entry.status === 'ready' && entry.controls.preferences).toMatchObject({
      presentation: { section: 'timeline.matrix', value: null },
    });
    expect(entry.status === 'ready' && entry.controls.preferences?.notice).toBeUndefined();
  });
  it('open the matrix Summary tab and the Over time Report tab even when a frame is lost', async () => {
    const matrix = await timelineView(view('/repos?timeline&repo=prebidjs&back=!'));
    expect(matrix.status === 'ready' && 'matrix' in matrix && matrix.summaryHref).toBe(
      '/repos?repo=prebidjs',
    );
    const overTime = await timelineView(view('/contributors/account-alice?timeline&back=!'));
    expect(overTime.status === 'ready' && 'reportHref' in overTime && overTime.reportHref).toBe(
      '/contributors/account-alice?v=1',
    );
  });
  it('resolve the companies entries and ignore a timeline the readers reject', async () => {
    const week = { version: 1, query: 'timeline.group=week' };
    expect(
      await timelineEntryValues(
        view('/companies?timeline'),
        snapshot('contributions', { 'timeline.companies.overview': week }),
      ),
    ).toEqual({ scope: {}, presentation: { group: 'week' } });
    expect(
      await timelineEntryValues(
        view('/companies/unmapped?timeline'),
        snapshot('contributions', { 'timeline.companies.company': week }),
      ),
    ).toEqual({ scope: {}, presentation: { group: 'week' } });
    expect(
      await timelineEntryValues(
        view('/repos/prebidjs?timeline&cols=unknown'),
        snapshot('repositories', { 'timeline.repository': week }),
      ),
    ).toBeNull();
  });
  it('refuse a matrix-origin supporting view whose matrix cannot be read or does not hold it', async () => {
    const cell =
      '&detail=prsOpened&interval=month:2026-10-01&snap=repositories-reference-v1@2026-10-24T12:00Z&origin=matrix';
    const load = async (frame: string) =>
      (await loadTimelineSupport(view('/repos/prebidjs?timeline' + cell + '&back=' + frame)))
        .status;
    expect(await load('/repos~timeline')).toBe('ready');
    // The matrix's period window past its last one, and a matrix of another repository.
    expect(await load('/repos~timeline~window:99')).toBe('invalid');
    expect(await load('/repos~timeline~repo:prebidserver')).toBe('invalid');
    // The matrix's Timeline itself is no supporting view's parent.
    expect((await loadTimelineSupport(view('/repos?timeline' + cell))).status).toBe('invalid');
    // A Timeline the readers reject has no supporting views.
    expect(
      (
        await loadTimelineSupport(
          view('/repos/prebidjs?timeline&group=day&period=2020-01-01..2026-10-24' + cell),
        )
      ).status,
    ).toBe('invalid');
  });
  it('refuse a download address that is no URL', async () => {
    expect((await loadTimelineReport('/repos?timeline' + '%')).status).toBe('invalid');
    expect((await loadTimelineReport('http://[')).status).toBe('invalid');
    expect((await loadTimelineView(view('/repos/prebidjs?timeline&cols=unknown'))).status).toBe(
      'invalid',
    );
  });
});
