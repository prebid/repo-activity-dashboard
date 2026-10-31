import { performance } from 'node:perf_hooks';
import { contributionTimelineSample } from '../src/mocks/contribution-timeline';
import {
  repositoryTimelineSample,
  repositoryTimelineMatrixSample,
} from '../src/mocks/repository-timeline';
import { selectRepositoryTimelineMatrix } from '../src/lib/presentation/repository-timeline-matrix';
import { repositoryTimelineMetricScope } from '../src/models/repository-timeline';
import { selectContributionTimeline } from '../src/lib/presentation/contribution-timeline';
import { selectRepositoryTimeline } from '../src/lib/presentation/repository-timeline';
import { validateContributionSource } from '../src/lib/presentation/contribution-source';
import { timelineIntervalLimit, type TimelineRequest } from '../src/models/reporting-timeline';

// Local diagnostics only; payload invariants have deterministic tests, elapsed time is not a CI gate.
for (const extraAccounts of [0, 3000]) {
  const sample = structuredClone(contributionTimelineSample('large', true));
  for (let index = 0; index < extraAccounts; index++)
    sample.contributions.accounts.push({
      id: `idle-${index}`,
      login: `idle-${index}`,
      name: `Idle ${index}`,
      companyId: null,
      actorType: 'human',
    });
  sample.contributions = validateContributionSource(sample.contributions);
  const lastDay = Date.parse(sample.contributions.asOf.slice(0, 10) + 'T00:00:00.000Z');
  const boundedRange = {
    start: new Date(lastDay - (timelineIntervalLimit - 1) * 86400000).toISOString(),
    end: sample.contributions.asOf,
    endInclusive: true,
  };
  const requests: TimelineRequest[] = [
    { range: sample.contributions.range, grouping: 'month' },
    { range: sample.contributions.range, grouping: 'day' },
    { range: boundedRange, grouping: 'day' },
  ];
  for (const request of requests) {
    const start = performance.now(),
      report = selectContributionTimeline(sample, request);
    console.log(
      JSON.stringify({
        area: 'contributions',
        extraAccounts,
        intervals: report.rows.length,
        milliseconds: Number((performance.now() - start).toFixed(2)),
        bytes: Buffer.byteLength(JSON.stringify(report)),
      }),
    );
  }
}
for (const family of ['activity', 'snapshot'] as const) {
  const source = repositoryTimelineSample(),
    start = performance.now();
  const report = selectRepositoryTimeline(
    source,
    {
      range: { start: '2026-01-01T00:00:00.000Z', end: source.asOf, endInclusive: true },
      grouping: 'day',
    },
    family,
  );
  console.log(
    JSON.stringify({
      area: 'repository',
      family,
      intervals: report.rows.length,
      milliseconds: Number((performance.now() - start).toFixed(2)),
      bytes: Buffer.byteLength(JSON.stringify(report)),
    }),
  );
}

for (const scenario of ['large', 'mixed'] as const) {
  for (const metric of [
    'prsOpened',
    'medianMergeDays',
    'humanApprovals1',
    'issuesClosed',
  ] as const) {
    const preparation = performance.now();
    const source = repositoryTimelineMatrixSample(
      repositoryTimelineMetricScope(metric).recordKind,
      scenario,
    );
    const preparedMs = performance.now() - preparation;
    const start = performance.now();
    const matrix = selectRepositoryTimelineMatrix(
      source,
      {
        grouping: 'day',
        range: { start: '2025-06-12T00:00:00.000Z', end: source.asOf, endInclusive: true },
      },
      { metric, repositoryIds: source.repositories.map((item) => item.repository.id) },
    );
    console.log(
      JSON.stringify({
        area: 'repository-matrix',
        scenario,
        metric,
        repositories: matrix.rows.length,
        intervals: matrix.intervals.length,
        cells: matrix.rows.reduce((sum, row) => sum + row.values.length, 0),
        preparationMs: Number(preparedMs.toFixed(2)),
        projectionMs: Number((performance.now() - start).toFixed(2)),
        bytes: Buffer.byteLength(JSON.stringify(matrix)),
      }),
    );
  }
}
{
  const source = repositoryTimelineMatrixSample('mixed', 'large');
  const metrics = ['prsOpened', 'issuesClosed', 'medianMergeDays'] as const;
  const start = performance.now();
  const matrix = selectRepositoryTimelineMatrix(
    source,
    {
      grouping: 'week',
      range: { start: '2025-01-01T00:00:00.000Z', end: source.asOf, endInclusive: true },
    },
    {
      metrics: [...metrics],
      repositoryIds: [...new Set(source.repositories.map((row) => row.repository.id))],
    },
  );
  console.log(
    JSON.stringify({
      area: 'grouped-repository-matrix',
      statistics: metrics.length,
      repositories: matrix.scope.repositoryIds.length,
      intervals: matrix.intervals.length,
      cells: matrix.rows.reduce((sum, row) => sum + row.values.length, 0),
      projectionMs: Number((performance.now() - start).toFixed(2)),
      bytes: Buffer.byteLength(JSON.stringify(matrix)),
    }),
  );
}
