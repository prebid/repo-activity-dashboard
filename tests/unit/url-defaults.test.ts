import { describe, expect, it } from 'vitest';
import { repositoryTimelineMetricDefinitions } from '@/features/repositories/repository-timeline-columns';
import {
  allRepositorySlugs,
  columnTableOf,
  columnTokens,
  contributionColumnTable,
  contributionDetailColumnTable,
  contributionTableOf,
  contributionTimelineColumnTable,
  defaultValue,
  isInsightMetric,
  lensOf,
  recordColumnTable,
  recordKindOf,
  repositoryTimelineColumnTable,
  urlDefaultsV1,
  visibleColumns,
} from '@/lib/presentation/url/defaults';
import { repositoryColumnDefaults } from '@/lib/presentation/repository-page-preferences';
import { stableJson } from '../support/golden-urls';
import { repositoryCatalog } from '@/config/repositories';
import { activityMetricIds, backlogMetricIds } from '@/models/repository-overview';
import { contributionMetricIds } from '@/models/contributions';
import { repositoryTimelineFamilyMetrics } from '@/models/repository-timeline';
import type { RepositoryPageSource } from '@/models/repository-page';

const shown = (table: { ids: readonly string[]; visible: ReadonlySet<string> }) =>
  table.ids.filter((id) => table.visible.has(id));

it('keeps the frozen v1 defaults unchanged', async () => {
  // Any edit to a v1 default changes the meaning of every URL that omits it; it shows here.
  const records = Object.fromEntries(
    [...backlogMetricIds, 'agedPrs', ...activityMetricIds, 'medianMergeDays'].flatMap((metric) =>
      (['prs', 'issues'] as const).map((kind) => [
        kind + ':' + metric,
        shown(recordColumnTable(kind, metric)),
      ]),
    ),
  );
  await expect(
    stableJson({
      table: urlDefaultsV1,
      repositories: allRepositorySlugs(),
      records,
      authorRecords: shown(recordColumnTable('prs', 'prsOpened', true)),
      repositoryTimeline: Object.fromEntries(
        ['prs.activity', 'prs.snapshot', 'issues.activity', 'issues.snapshot'].map((key) => {
          const [kind, family] = key.split('.') as ['prs', 'activity'];
          return [key, shown(repositoryTimelineColumnTable(kind, family))];
        }),
      ),
    }),
  ).toMatchFileSnapshot('../fixtures/golden/url-defaults-v1.json');
});

describe('column tables', () => {
  it('match the record pages’ reviewed defaults for every metric', () => {
    const metrics = [...backlogMetricIds, 'agedPrs', ...activityMetricIds, 'medianMergeDays'];
    for (const metric of metrics)
      for (const author of [false, true]) {
        const current =
          metric === 'agedPrs' || (backlogMetricIds as readonly string[]).includes(metric);
        const kind = metric.toLowerCase().includes('issue') ? 'issues' : 'prs';
        const defaults = repositoryColumnDefaults({
          drilldown: { selection: { scope: current ? 'current' : 'period', metric } },
          author: author ? { account: 'a' } : undefined,
        } as unknown as RepositoryPageSource);
        const table = recordColumnTable(kind, metric, author);
        expect(shown(table), metric).toEqual(table.ids.filter((id) => defaults[id] !== false));
      }
  });

  it('match the repository Timeline metric definitions', () => {
    for (const kind of ['prs', 'issues'] as const)
      for (const family of ['activity', 'snapshot'] as const) {
        const definitions = repositoryTimelineMetricDefinitions(
          repositoryTimelineFamilyMetrics(kind, family),
        );
        expect(shown(repositoryTimelineColumnTable(kind, family))).toEqual(
          definitions.filter((metric) => metric.defaultVisible).map((metric) => metric.id),
        );
      }
  });

  it('show the lens metric set on contribution tables and Timelines', () => {
    expect(shown(contributionColumnTable('contributors', 'contributors'))).toEqual([
      'name',
      'actorType',
      'company',
      'prsAuthored',
      'authoredPrsMerged',
      'issuesAuthored',
    ]);
    expect(shown(contributionColumnTable('companies', 'reviewers'))).toEqual([
      'name',
      'members',
      'reviewerContributions',
      'approvalContributions',
      'mergesPerformed',
    ]);
    expect(shown(contributionTimelineColumnTable('reviewers'))).toEqual([
      'reviewerContributions',
      'approvalContributions',
      'mergesPerformed',
    ]);
    // The Companies lens shows the six credits in report order, on tables and Over time.
    const credits = [
      'prsAuthored',
      'authoredPrsMerged',
      'reviewerContributions',
      'approvalContributions',
      'mergesPerformed',
      'issuesAuthored',
    ];
    expect(shown(contributionColumnTable('companies', 'all'))).toEqual([
      'name',
      'members',
      ...credits,
    ]);
    expect(shown(contributionColumnTable('members', 'all'))).toEqual([
      'name',
      'actorType',
      ...credits,
    ]);
    expect(shown(contributionTimelineColumnTable('all'))).toEqual(credits);
    expect(shown(contributionDetailColumnTable('prComments'))).toContain('lastAt');
    expect(shown(contributionDetailColumnTable('prsAuthored'))).not.toContain('lastAt');
    expect(shown(contributionDetailColumnTable('unknown'))).not.toContain('lastAt');
  });

  it('pick the table a screen diffs against', () => {
    expect(columnTableOf('/repos/[slug]', {})?.ids).toContain('approvals');
    expect(columnTableOf('/repos/[slug]', { view: 'issues' })?.ids).toContain('assignees');
    expect(columnTableOf('/repos/[slug]', { metric: 'prsMerged' })?.visible.has('mergedAt')).toBe(
      true,
    );
    expect(
      columnTableOf('/repos/[slug]/authors/[account]', { metric: 'issueAuthors' })?.visible.has(
        'author',
      ),
    ).toBe(false);
    expect(columnTableOf('/repos/[slug]/authors/[account]', {})).toBeNull();
    expect(
      columnTableOf('/repos/[slug]', { timeline: true, view: 'issues', family: 'snapshot' })?.ids,
    ).toEqual(['openIssues']);
    expect(columnTableOf('/companies', { timeline: true, lens: 'reviewers' })?.visible).toEqual(
      new Set(['reviewerContributions', 'approvalContributions', 'mergesPerformed']),
    );
    expect(columnTableOf('/companies', {})?.ids[1]).toBe('members');
    expect(
      shown(columnTableOf('/companies/[...identity]', { lens: 'all', view: 'repositories' })!),
    ).toEqual(['name', ...contributionMetricIds]);
    expect(columnTableOf('/contributors', { metric: 'prsAuthored' })?.ids[0]).toBe('record');
    expect(columnTableOf('/repos', {})).toBeNull();
    expect(contributionTableOf('/reviewers', {})).toBe('contributors');
    expect(contributionTableOf('/contributors/[accountId]', {})).toBe('repositories');
    expect(contributionTableOf('/companies/[...identity]', {})).toBe('members');
    expect(contributionTableOf('/companies/[...identity]', { view: 'repositories' })).toBe(
      'repositories',
    );
  });

  it('diff visible columns as cols tokens and back', () => {
    const table = recordColumnTable('prs', 'totalOpenPrs');
    const visible = [...shown(table).filter((id) => id !== 'author'), 'labels'];
    const tokens = columnTokens(table, visible);
    expect(tokens).toEqual(['-author', 'labels']);
    expect(visibleColumns(table, tokens)).toEqual(table.ids.filter((id) => visible.includes(id)));
    expect(visibleColumns(table, ['nope'])).toBeNull();
    expect(columnTokens(table, shown(table))).toEqual([]);
  });
});

describe('defaultValue', () => {
  it('names the v1 default of every defaulted field', () => {
    const cases: [Parameters<typeof defaultValue>, unknown][] = [
      [['/repos', 'sample', {}], 'reference'],
      [['/companies', 'lens', {}], 'contributors'],
      [['/repos/[slug]', 'view', {}], 'prs'],
      [['/companies/[...identity]', 'view', {}], 'members'],
      [['/repos', 'group', { timeline: true }], 'month'],
      [['/repos/[slug]', 'family', { timeline: true }], 'activity'],
      [['/repos', 'origin', { timeline: true, detail: 'x' }], 'timeline'],
      [['/repos', 'bpage', {}], '1'],
      [['/repos', 'period', {}], 'this-month'],
      [['/repos', 'period', { timeline: true }], 'this-year'],
      [['/repos/[slug]', 'period', { metric: 'prsOpened' }], undefined],
      [['/repos', 'age', {}], ['30']],
      [['/repos/[slug]', 'age', { metric: 'agedPrs' }], undefined],
      [
        ['/contributors', 'type', {}],
        ['human', 'agent', 'bot', 'unknown'],
      ],
      [['/repos', 'bsort', {}], '-totalOpenPrs'],
      [['/repos', 'asort', {}], '-prsOpened'],
      [['/repos/[slug]', 'sort', {}], '-createdAt'],
      [['/repos/[slug]/authors/[account]', 'sort', {}], '-createdAt'],
      [['/repos/[slug]', 'sort', { metric: 'prAuthors' }], '-recordCount'],
      [['/repos/[slug]', 'sort', { metric: 'medianMergeDays' }], '-createdAt'],
      [['/repos/[slug]', 'sort', { metric: 'botApprovalCredits' }], '-firstCreditAt'],
      [['/repos', 'sort', { timeline: true }], 'repository'],
      [['/repos', 'sort', { timeline: true, detail: 'x' }], 'repository'],
      [['/repos/[slug]', 'sort', { timeline: true }], 'period'],
      [['/contributors', 'sort', { timeline: true }], 'period'],
      [['/contributors', 'sort', {}], '-authoredPrsMerged'],
      [['/reviewers', 'sort', {}], '-reviewerContributions'],
      [['/contributors', 'sort', { metric: 'prsAuthored' }], '-creditedAt'],
      [['/companies/export', 'sort', { lens: 'reviewers' }], '-reviewerContributions'],
      [['/companies', 'sort', { lens: 'all' }], '-authoredPrsMerged'],
      [['/companies/export', 'sort', { lens: 'all' }], '-authoredPrsMerged'],
      [['/companies', 'sort', { lens: 'all', timeline: true }], 'period'],
      [['/repos', 'sort', {}], undefined],
      [['/repos', 'dsort', { timeline: true, detail: 'x' }], undefined],
      [['/repos', 'metric', { timeline: true }], ['prsOpened']],
      [['/repos/[slug]', 'metric', {}], 'totalOpenPrs'],
      [['/repos/[slug]', 'metric', { view: 'issues' }], 'openIssues'],
      [
        ['/repos/[slug]', 'metric', { timeline: true, view: 'issues', family: 'snapshot' }],
        'openIssues',
      ],
      [['/repos/[slug]', 'metric', { timeline: true, detail: 'x' }], 'prsOpened'],
      [['/contributors', 'metric', {}], undefined],
      [['/repos', 'rank', { timeline: true, metric: ['prsMerged', 'prsOpened'] }], 'prsMerged'],
      [['/repos', 'rank', { timeline: true }], 'prsOpened'],
      [['/repos', 'rank', { timeline: true, metric: 'x' }], undefined],
      [['/repos/[slug]', 'cols', {}], []],
      [['/repos', 'v', {}], '1'],
      [['/repos', 'window', { timeline: true }], undefined],
      [['/repos', 'repo', {}], allRepositorySlugs()],
    ];
    for (const [args, expected] of cases)
      expect(defaultValue(...args), JSON.stringify(args)).toEqual(expected);
  });

  it('reads lens, record kind and insight metrics', () => {
    expect(lensOf('/reviewers', {})).toBe('reviewers');
    expect(lensOf('/companies', { lens: 'reviewers' })).toBe('reviewers');
    expect(lensOf('/companies', {})).toBe('contributors');
    expect(lensOf('/companies', { lens: 'all' })).toBe('all');
    expect(lensOf('/contributors/[accountId]', { lens: 'all' })).toBe('all');
    // The route is the lens on /reviewers.
    expect(lensOf('/reviewers', { lens: 'all' })).toBe('reviewers');
    expect(recordKindOf({ metric: 'issuesClosed' })).toBe('issues');
    expect(recordKindOf({ metric: 'openIssues' })).toBe('issues');
    expect(recordKindOf({ metric: 'prsOpened' })).toBe('prs');
    expect(recordKindOf({ view: 'issues' })).toBe('issues');
    expect(isInsightMetric('prAuthors')).toBe(true);
    expect(isInsightMetric('prsOpened')).toBe(false);
    expect(allRepositorySlugs()).toEqual(
      repositoryCatalog.filter((row) => row.enabled).map((row) => row.slug),
    );
  });
});
