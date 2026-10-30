import { selectTableRows } from '@/lib/presentation/table-rows';
import { reportRows } from '../support/contribution-reports';
import { contributionReturnHref } from '@/lib/presentation/contribution-return';
import { isKnownZeroContribution } from '@/lib/presentation/contribution-table-values';
import { describe, expect, it } from 'vitest';
import { contributionSample } from '@/mocks/contributions';
import {
  defaultContributionSelection,
  selectContributionPresentation,
  selectContributions,
  selectContributionExport,
} from '@/lib/presentation/contributions';
import { contributionDetailRows } from '@/lib/presentation/contribution-detail-rows';
import { contributionMetricHref } from '@/lib/presentation/contribution-navigation';
import {
  readContributionExport,
  contributionExportHref,
  contributionCsv,
} from '@/lib/presentation/contribution-export';
import { reportMetricIds, isCoreMetric } from '@/models/contribution-metrics';
import {
  contributorValues,
  companyValues,
  repositoryContributionValues,
} from '@/lib/presentation/contribution-table-values';
import type { ContributionExportRequest } from '@/models/contribution-export';
import type { ContributionPage } from '@/models/contribution-page';
const source = contributionSample();
const selection = defaultContributionSelection(source);
const overview = { kind: 'overview' } as const;
const base: ContributionExportRequest = {
  area: 'contributors',
  focus: overview,
  breakdown: 'members',
  layout: 'summary',
  identityColumns: ['actorType', 'company', 'members'],
  metrics: ['prsAuthored', 'reviewerContributions', 'approvalContributions', 'issuesAuthored'],
  query: { search: '', sort: 'authoredPrsMerged', descending: true, page: 2 },
};
describe.each(['reference', 'large', 'coverage-gap', 'partial', 'missing', 'empty'] as const)(
  '%s contribution reconciliation',
  (scenario) => {
    const sample = contributionSample({ scenario });
    const selected = {
      ...defaultContributionSelection(sample),
      actorTypes: ['human', 'agent'] as ('human' | 'agent')[],
      repositoryIds: ['repo-prebidjs', 'repo-prebidserver'],
    };
    it.each(reportMetricIds)('reconciles %s supporting rows with filtered totals', (metric) => {
      const { report, details } = selectContributionPresentation(
        sample,
        selected,
        overview,
        metric,
      );
      const total = isCoreMetric(metric) ? report.totals[metric] : report.additionalTotals[metric];
      expect(details?.measurement).toEqual(total);
      const rows = details!.rows;
      expect(rows.every((row) => selected.repositoryIds.includes(row.repository.id))).toBe(true);
      expect(rows.every((row) => row.account.actorType !== 'bot')).toBe(true);
      if (total.value !== null)
        expect(
          rows.reduce((sum, row) => sum + (row.value.value ?? 0), 0),
          metric,
        ).toBe(total.value);
      else expect(rows.every((row) => row.value.value === null)).toBe(true);
    });
  },
);
it('keeps first-credit rows separate from PR counts and final merged volume', () => {
  const review = selectContributionPresentation(
    source,
    selection,
    overview,
    'reviewerContributions',
  ).details!;
  expect(review.measurement.value).toBe(9);
  expect(review.rows).toHaveLength(9);
  expect(review.distinctRecords).toBe(5);
  const volume = selectContributionPresentation(
    source,
    selection,
    overview,
    'reviewed.filesChanged',
  ).details!;
  expect(volume.measurement.value).toBe(36);
  expect(volume.rows).toHaveLength(5);
  expect(volume.distinctRecords).toBe(3);
  expect(
    volume.rows.every((row) => row.record.kind === 'pr' && row.creditedAt === row.record.mergedAt),
  ).toBe(true);
  const samePr = review.rows.filter((row) => row.record.number === 102);
  expect(samePr.map((row) => row.account.id).sort()).toEqual(['account-alice', 'account-bob']);
});
it('groups comment identities by account/record with first and last dates and no comment bodies', () => {
  const sample = structuredClone(source);
  const original = sample.activity.comments.find((row) => row.kind === 'prComments')!;
  sample.activity.comments.push(
    { ...original, id: 'extra-later', createdAt: '2026-10-02T12:00:00.000Z' },
    { ...original, id: 'extra-earlier', createdAt: '2026-08-06T12:00:00.000Z' },
  );
  const details = selectContributionPresentation(
    sample,
    selection,
    overview,
    'prComments',
  ).details!;
  expect(details.measurement.value).toBe(10);
  const row = details.rows.find(
    (row) => row.record.id === original.recordId && row.account.id === original.accountId,
  )!;
  expect(row.value.value).toBe(3);
  expect(row.creditedAt).toBe('2026-08-06T12:00:00.000Z');
  expect(row.lastAt).toBe('2026-10-02T12:00:00.000Z');
  expect('body' in row).toBe(false);
});
it('preserves missing diff details without inventing zero and rejects a non-PR volume row', () => {
  const sample = structuredClone(source);
  for (const record of sample.records) if (record.kind === 'pr') delete record.mergedDiff;
  const details = selectContributionPresentation(
    sample,
    selection,
    overview,
    'authored.linesAdded',
  ).details!;
  expect(details.measurement).toMatchObject({ status: 'partial', value: 0 });
  expect(details.rows).toHaveLength(5);
  expect(details.rows.every((row) => row.value.value === null)).toBe(true);
  const issue = sample.records.find((record) => record.kind === 'issue')!;
  sample.activity.volumes = [
    {
      recordId: issue.id,
      accountId: 'account-alice',
      role: 'authored',
      qualifiedAt: issue.createdAt,
    },
  ];
  expect(() =>
    contributionDetailRows(sample, details.context, 'authored.linesAdded', sample.accounts),
  ).toThrow('Expected merged PR');
});
it('retains historical closed and merged records, focused exclusions and exact period boundaries', () => {
  const sample = contributionSample({ scenario: 'large' });
  const detail = selectContributionPresentation(
    sample,
    defaultContributionSelection(sample),
    { kind: 'contributor', accountId: 'account-heavy-agent' },
    'prsAuthored',
  ).details!;
  expect(detail.rows).toHaveLength(240);
  expect(detail.rows.some((row) => row.record.state === 'Closed')).toBe(true);
  expect(detail.rows.some((row) => row.record.kind === 'pr' && row.record.draft)).toBe(true);
  const empty = selectContributionPresentation(
    source,
    { ...selection, excludedAccountIds: ['account-alice'] },
    { kind: 'contributor', accountId: 'account-alice' },
    'prsAuthored',
  ).details!;
  expect(empty.rows).toEqual([]);
  expect(empty.measurement.value).toBe(0);
  const period = contributionSample({
    period: { kind: 'custom', from: '2026-10-01', through: '2026-10-01' },
  });
  expect(
    selectContributionPresentation(period, selection, overview, 'prComments').details!.rows.map(
      (row) => row.account.id,
    ),
  ).toEqual(['account-alice']);
});
it('projects full filtered company and contributor repository exports before display pagination', () => {
  const sample = contributionSample({ scenario: 'large' }),
    selected = {
      ...defaultContributionSelection(sample),
      population: {
        kind: 'selected' as const,
        accountIds: ['account-person-001'],
        companyIds: ['company-acme'],
      },
      excludedAccountIds: ['account-person-001'],
    };
  const options = { ...base, focus: { kind: 'company' as const, companyId: 'company-acme' } };
  const summary = selectContributionExport(sample, selected, options);
  expect(summary.rows).toHaveLength(99);
  expect(summary.rows.every((row) => row.entityId !== 'account-person-001')).toBe(true);
  expect(summary.rows.reduce((sum, row) => sum + row.metrics.prsAuthored.value!, 0)).toBe(99);
  const flat = selectContributionExport(sample, selected, { ...options, layout: 'repositories' });
  expect(flat.rows).toHaveLength(99);
  expect(flat.rows.reduce((sum, row) => sum + row.metrics.prsAuthored.value!, 0)).toBe(99);
  const repo = selectContributionExport(
    sample,
    { ...selected, repositoryIds: ['repo-prebidjs'] },
    { ...options, breakdown: 'repositories' },
  );
  expect(repo.rows).toHaveLength(1);
  expect(repo.rows[0].metrics.prsAuthored.value).toBe(5);
  const companies = selectContributionExport(sample, selected, {
    ...base,
    area: 'companies',
    layout: 'repositories',
  });
  expect(companies.rows).toHaveLength(18);
  expect(companies.rows[0].entityType).toBe('company');
  const contributors = selectContributionExport(sample, selected, {
    ...base,
    query: { ...base.query, search: 'sample-person-019' },
    layout: 'repositories',
  });
  expect(contributors.rows).toHaveLength(1);
  expect(contributors.rows.every((row) => row.entityId === 'account-person-019')).toBe(true);
});
it('exports focus identities, unmapped companies, zero rows and unknown coverage truthfully', () => {
  const missing = contributionSample({ scenario: 'missing' });
  const unknown = selectContributionExport(missing, selection, {
    ...base,
    focus: { kind: 'contributor', accountId: 'account-alice' },
  });
  expect(unknown.rows).toHaveLength(18);
  expect(unknown.rows[0].metrics.prsAuthored.value).toBeNull();
  const unmapped = selectContributionExport(source, selection, {
    ...base,
    area: 'companies',
    query: { ...base.query, search: 'Unmapped company' },
  });
  expect(unmapped.rows).toHaveLength(1);
  expect(unmapped.rows[0].companyId).toBeNull();
  const empty = selectContributionExport(
    source,
    { ...selection, excludedAccountIds: ['account-alice'] },
    { ...base, focus: { kind: 'contributor', accountId: 'account-alice' } },
  );
  expect(empty.rows).toEqual([]);
  expect(selectContributionExport(source, { ...selection, repositoryIds: [] }, base).rows).toEqual(
    [],
  );
  const zero = selectContributionExport(source, selection, {
    ...base,
    focus: { kind: 'contributor', accountId: 'account-eve' },
  });
  expect(zero.rows).toEqual([]);
});
it('searches and sorts on the same values as display, with missing values last', () => {
  const report = selectContributionPresentation(source, selection, overview).report;
  if (report.kind !== 'overview') throw Error('overview');
  const cols = contributorValues();
  expect(
    selectTableRows(reportRows(report, 'contributors'), cols, {
      search: 'human',
      sort: 'name',
      descending: false,
    }).map((row) => row.account.name),
  ).toEqual(['Alice', 'Bob', 'Carol', 'Drew', 'Finn']);
  expect(
    selectTableRows(reportRows(report, 'contributors'), cols, {
      search: '',
      sort: 'authoredPrsMerged',
      descending: true,
    })[0].account.name,
  ).toBe('Carol');
  expect(
    selectTableRows(
      reportRows(
        selectContributions(source, selection, overview, { area: 'companies' }),
        'companies',
      ),
      companyValues(),
      {
        search: '',
        sort: 'members',
        descending: false,
      },
    )[0].memberCount,
  ).toBe(1);
  const focused = selectContributionPresentation(source, selection, {
    kind: 'contributor',
    accountId: 'account-alice',
  }).report;
  if (focused.kind === 'overview') throw Error('focus');
  expect(
    selectTableRows(
      reportRows(focused, 'repositories'),
      repositoryContributionValues(),
      { search: 'impossible', sort: 'name', descending: false },
      false,
    ),
  ).toHaveLength(2);
  expect(
    selectTableRows(reportRows(report, 'contributors'), cols, {
      search: '',
      sort: 'unknown',
      descending: false,
    }),
  ).toEqual(reportRows(report, 'contributors'));
  const missing = structuredClone(reportRows(report, 'contributors')[0]);
  missing.metrics.prsAuthored = { status: 'missing', value: null, reason: 'test' };
  expect(
    selectTableRows([missing, reportRows(report, 'contributors')[1]], cols, {
      search: '',
      sort: 'prsAuthored',
      descending: true,
    }).at(-1)?.metrics.prsAuthored.value,
  ).toBeNull();
});
it('validates export options, preserves complete scope and selects only requested metric columns', () => {
  const report = selectContributionPresentation(
    source,
    { ...selection, excludedAccountIds: ['account-bob'] },
    overview,
  ).report;
  const page: ContributionPage = {
    area: 'contributors',
    sample: 'partial',
    breakdown: 'members',
    returnTo: '/contributors',
    report,
  };
  const href = contributionExportHref(page, base.query, 'repositories', [
    'prsAuthored',
    'approved.linesAdded',
  ]);
  const params = new URL(href, 'https://example.test').searchParams;
  const request = readContributionExport(params, 'contributors')!;
  expect(params.get('exclude')).toBe('account-bob');
  expect(params.has('export.page')).toBe(false);
  expect(request.layout).toBe('repositories');
  expect(request.metrics).toEqual(['prsAuthored', 'approved.linesAdded']);
  const exported = selectContributionExport(source, report.context.selection, request);
  const csv = contributionCsv(exported.rows, request, exported.context);
  expect(csv).toContain('Approved merged PR volume — Lines added');
  expect(csv).not.toContain('"Reviewer contributions"');
  expect(csv).toContain('Period start (UTC)');
  expect(csv.split('\r\n')).toHaveLength(exported.rows.length + 1);
  for (const query of [
    '',
    'column=bad',
    'column=prsAuthored&entity=group',
    'column=prsAuthored&entity=contributor',
    'column=prsAuthored&view=bad',
    'column=prsAuthored&layout=bad',
  ])
    expect(readContributionExport(new URLSearchParams(query), 'contributors')).toBeNull();
  for (const focus of [
    { kind: 'contributor' as const, accountId: 'account-alice' },
    { kind: 'company' as const, companyId: null },
    { kind: 'company' as const, companyId: 'company-acme' },
  ]) {
    const link = contributionExportHref(
      { ...page, report: { ...report, context: { ...report.context, focus } } },
      { ...base.query, search: 'Alice' },
      'summary',
      ['prsAuthored'],
    );
    const parsed = readContributionExport(
      new URL(link, 'https://example.test').searchParams,
      'companies',
    )!;
    expect(parsed.focus).toEqual(focus);
    if (focus.kind === 'contributor') expect(parsed.query.search).toBe('');
  }
  expect(
    readContributionExport(
      new URLSearchParams(
        'column=prsAuthored&entity=company&entityId=&view=repositories&export.q=Alice',
      ),
      'companies',
    )?.query.search,
  ).toBe('');
  const missing = selectContributionExport(
    contributionSample({ scenario: 'missing' }),
    selection,
    base,
  );
  expect(missing.rows).toEqual([]);
  expect(contributionCsv(missing.rows, base, missing.context).trim().split('\r\n')).toHaveLength(1);
  const focusedRequest = {
    ...base,
    focus: { kind: 'contributor' as const, accountId: 'account-alice' },
  };
  const focused = selectContributionExport(
    contributionSample({ scenario: 'missing' }),
    selection,
    focusedRequest,
  );
  expect(focused.rows).toHaveLength(18);
  expect(contributionCsv(focused.rows, focusedRequest, focused.context)).toContain('"missing"');
});
it('builds metric links with a narrower repository and an exact return path', () => {
  const report = selectContributionPresentation(source, selection, overview).report;
  const href = contributionMetricHref(
    { kind: 'company', companyId: 'company-acme' },
    'reference',
    report.context,
    'reviewerContributions',
    '/companies?report.page=2',
    'repo-prebidjs',
  );
  const params = new URL(href!, 'https://example.test').searchParams;
  expect(params.getAll('repo')).toEqual(['repo-prebidjs']);
  expect(params.get('metric')).toBe('reviewerContributions');
  expect(contributionReturnHref(params, '/contributors')).toBe('/companies?report.page=2');
});

it('retains ascending export order and labels the actual sort direction', () => {
  const options = { ...base, query: { ...base.query, sort: 'name', descending: false } };
  const selected = selectContributionExport(source, selection, options);
  expect(selected.rows.map((row) => row.name)).toEqual([
    'Alice',
    'Bob',
    'Carol',
    'Drew',
    'Finn',
    'Prebid sample agent',
    'Sample bot',
  ]);
  const csv = contributionCsv(selected.rows, options, selected.context);
  expect(csv.split('\r\n')[1]).toContain('"account-alice"');
  expect(csv.split('\r\n')[1]).toMatch(/"asc"$/);
});

it('hides only known-zero members in summary and flat exports, independent of visible metrics', () => {
  const request = {
    ...base,
    focus: { kind: 'company' as const, companyId: 'company-acme' },
    hideZeroMembers: true,
  };
  const all = selectContributionExport(source, selection, { ...request, hideZeroMembers: false });
  expect(all.rows.map((row) => row.name)).toContain('Eve');
  const filtered = selectContributionExport(source, selection, request);
  expect(filtered.rows.map((row) => row.name)).toEqual(['Alice', 'Bob']);
  expect(
    filtered.rows.reduce((sum, row) => sum + row.metrics.approvalContributions.value!, 0),
  ).toBe(5);
  expect(
    selectContributionExport(source, selection, { ...request, layout: 'repositories' }).rows,
  ).toHaveLength(4);
  const missing = selectContributionExport(
    contributionSample({ scenario: 'missing' }),
    selection,
    request,
  );
  expect(missing.rows).toHaveLength(3);
  const page: ContributionPage = {
    area: 'companies',
    sample: 'reference',
    breakdown: 'members',
    returnTo: '/companies',
    hideZeroMembers: true,
    report: selectContributionPresentation(source, selection, request.focus).report,
  };
  const parsed = readContributionExport(
    new URL(
      contributionExportHref(page, request.query, 'summary', ['prsAuthored']),
      'http://localhost',
    ).searchParams,
    'companies',
  );
  expect(parsed?.hideZeroMembers).toBe(true);
  const report = page.report;
  if (report.kind !== 'company') throw Error('Expected company');
  const eve = structuredClone(
    reportRows(report, 'members').find((row) => row.account.id === 'account-eve')!,
  );
  expect(isKnownZeroContribution(eve)).toBe(true);
  for (const value of [
    { status: 'missing' as const, value: null, reason: 'unknown' },
    { status: 'partial' as const, value: 0, reason: 'incomplete' },
    { status: 'not-applicable' as const, value: null, reason: 'not applicable' },
  ]) {
    eve.additionalMetrics['reviewed.filesChanged'] = value;
    expect(isKnownZeroContribution(eve)).toBe(false);
  }
});

it('omits empty repository rows without pruning the catalog, scope or aggregate metrics', () => {
  const report = selectContributionPresentation(source, selection, {
    kind: 'contributor',
    accountId: 'account-alice',
  }).report;
  if (report.kind !== 'contributor') throw Error('Expected contributor');
  expect(reportRows(report, 'repositories').map((row) => row.repository.id)).toEqual([
    'repo-prebidjs',
    'repo-prebidserver',
  ]);
  expect(source.repositories).toHaveLength(18);
  expect(report.context.selection.repositoryIds).toHaveLength(18);
  for (const metric of reportMetricIds) {
    const expected = isCoreMetric(metric) ? report.totals[metric] : report.additionalTotals[metric];
    const actual = reportRows(report, 'repositories').reduce(
      (sum, row) =>
        sum +
        (isCoreMetric(metric) ? row.metrics[metric].value! : row.additionalMetrics[metric].value!),
      0,
    );
    expect(actual, metric).toBe(expected.value);
  }
});
it('retains a repository with only optional activity, even when exporting only zero-valued core columns', () => {
  const comments = contributionSample({
    period: { kind: 'custom', from: '2026-10-01', through: '2026-10-01' },
  });
  const report = selectContributionPresentation(comments, selection, {
    kind: 'contributor',
    accountId: 'account-alice',
  }).report;
  if (report.kind !== 'contributor') throw Error('Expected contributor');
  expect(Object.values(report.totals).map((value) => value.value)).toEqual([0, 0, 0, 0, 0, 0]);
  expect(report.additionalTotals.prComments.value).toBe(1);
  expect(reportRows(report, 'repositories').map((row) => row.repository.id)).toEqual([
    'repo-prebidjs',
  ]);
  const exported = selectContributionExport(comments, selection, {
    ...base,
    focus: { kind: 'contributor', accountId: 'account-alice' },
    metrics: ['prsAuthored'],
  });
  expect(exported.rows).toHaveLength(1);
  expect(exported.rows[0].metrics.prsAuthored.value).toBe(0);
  expect(exported.rows[0].additionalMetrics.prComments.value).toBe(1);
});
it.each(['partial', 'missing'] as const)(
  'retains %s repository coverage when no positive activity is known',
  (status) => {
    const uncertain = structuredClone(source);
    uncertain.coverageOverrides.push({
      accountId: 'account-eve',
      repositoryId: 'repo-openrtb',
      metric: 'issuesAuthored',
      coverage: { status, reason: 'Issue history is incomplete' },
    });
    const report = selectContributionPresentation(uncertain, selection, {
      kind: 'contributor',
      accountId: 'account-eve',
    }).report;
    if (report.kind !== 'contributor') throw Error('Expected contributor');
    expect(reportRows(report, 'repositories').map((row) => row.repository.id)).toEqual([
      'repo-openrtb',
    ]);
    expect(reportRows(report, 'repositories')[0].metrics.issuesAuthored.status).toBe(status);
    const exported = selectContributionExport(uncertain, selection, {
      ...base,
      focus: { kind: 'contributor', accountId: 'account-eve' },
    });
    expect(exported.rows).toHaveLength(1);
    expect(exported.rows[0].metrics.issuesAuthored.status).toBe(status);
  },
);
