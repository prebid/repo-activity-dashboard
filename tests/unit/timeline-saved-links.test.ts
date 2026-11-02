import { describe, expect, it } from 'vitest';
import { savedTimelineLink } from '@/lib/presentation/url/legacy/timeline-state';
import { matrixRepositoryTimelineHref } from '@/lib/presentation/timeline-navigation';
import { repositoryMatrixEntryHref } from '@/lib/presentation/repository-timeline-matrix-entry';
import { contributionTimelineHref } from '@/lib/presentation/contribution-timeline';
import { defaultContributionSettings } from '@/lib/presentation/contribution-settings-rules';
import { contributionSample } from '@/mocks/contributions';
import { repositoryCatalog } from '@/config/repositories';
import type { TimelineViewState } from '@/models/timeline-controls';
import type { UrlView } from '@/lib/presentation/url/back';
import type { UrlValues } from '@/lib/presentation/url/registry';

const asOf = '2026-10-24T12:00:00.000Z';
const query = (href: string | null) => Object.fromEntries(new URL(href!, 'http://x').searchParams);

describe('links into a Timeline carry the saved presentation (decision C3)', () => {
  it('leaves a link unchanged when nothing is saved', () => {
    const values: UrlValues = { timeline: true, metric: 'prsMerged' };
    expect(savedTimelineLink('/repos/[slug]', values, ['metric'], null, asOf)).toBe(values);
  });
  it('adds the saved chart and keeps the metric the link names, without saved record filters', () => {
    const saved =
      'timeline.chart=1&timeline.metric=medianMergeDays&prs.filter.authors=sample-alice';
    expect(
      savedTimelineLink(
        '/repos/[slug]',
        { timeline: true, metric: 'prsOpened' },
        ['view', 'family', 'metric', 'period'],
        saved,
        asOf,
      ),
    ).toEqual({ timeline: true, chart: true, v: '1' });
  });
  it('keeps a list link’s exact interval, record filters and omitted-records choice', () => {
    const values: UrlValues = {
      timeline: true,
      period: '2026-10-01..2026-10-07',
      at: '2026-10-08',
      authors: ['sample-alice'],
      omitted: true,
    };
    expect(
      savedTimelineLink(
        '/repos/[slug]',
        values,
        ['view', 'family', 'period'],
        'timeline.chart=1',
        asOf,
      ),
    ).toEqual({ ...values, chart: true, v: '1' });
  });
  it('takes the saved chart metric when the link leaves the metric to the viewer', () => {
    expect(
      savedTimelineLink(
        '/repos/[slug]',
        { timeline: true },
        ['view', 'family', 'period'],
        'timeline.chart=1&timeline.metric=medianMergeDays',
        asOf,
      ),
    ).toEqual({ timeline: true, chart: true, metric: 'medianMergeDays', v: '1' });
  });
  it('pins the link to its own fields when its view cannot take the saved presentation', () => {
    // A saved metric no Timeline has fails on a bare entry, so the saved section is not applied.
    const values: UrlValues = { timeline: true, period: 'last-7-days', group: 'week' };
    expect(
      savedTimelineLink(
        '/repos/[slug]',
        values,
        ['period', 'group'],
        'timeline.chart=1&timeline.metric=unknownMetric',
        asOf,
      ),
    ).toEqual({ ...values, v: '1' });
    expect(
      savedTimelineLink('/repos/[slug]', { timeline: true, group: 'nope' }, [], 'x=1', asOf),
    ).toEqual({ timeline: true, group: 'nope' });
  });
  it('pins a link whose explicit fields equal the saved ones, so it does not become an entry', () => {
    expect(
      savedTimelineLink(
        '/repos/[slug]',
        { timeline: true },
        ['view', 'family', 'metric', 'period'],
        'timeline.metric=medianMergeDays',
        asOf,
      ),
    ).toEqual({ timeline: true, v: '1' });
  });
  it('carries the saved chart from the matrix to a repository Timeline, behind the matrix frame', () => {
    const href = matrixRepositoryTimelineHref(
      { view: { metric: 'prsOpened' } as TimelineViewState, asOf },
      'prebidjs',
      '/repos?timeline',
      undefined,
      'timeline.chart=1&timeline.metric=medianMergeDays',
    );
    expect(href).toBe('/repos/prebidjs?timeline&chart&back=/repos~timeline');
  });
  it('carries the saved matrix view on a Summary link narrowed to some repositories', () => {
    const some = repositoryCatalog.filter((row) => row.enabled).slice(0, 2);
    const source = { source: 'sample' as const, scenarioId: 'rev-1', asOf };
    const saved = 'timeline.group=week';
    expect(query(repositoryMatrixEntryHref(some, '/repos', source, saved))).toMatchObject({
      group: 'week',
    });
    // The all-repositories entry stays bare: the matrix applies the saved view where it opens.
    expect(repositoryMatrixEntryHref(repositoryCatalog, '/repos', source, saved)).toBe(
      '/repos?timeline',
    );
  });
  it('carries the saved Over time presentation on the explicit report link', () => {
    const view: UrlView = { route: '/contributors', segments: {}, values: {} };
    const settings = defaultContributionSettings(contributionSample());
    const plain = contributionTimelineHref(view, settings, null, asOf);
    const saved = contributionTimelineHref(view, settings, 'timeline.group=week', asOf);
    expect(query(plain)).not.toHaveProperty('group');
    expect(query(plain)).toMatchObject({ timeline: '', v: '1' });
    expect(query(saved)).toEqual({ timeline: '', group: 'week' });
  });
});
