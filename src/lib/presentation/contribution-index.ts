import {
  contributionMetricIds,
  type ContributionSource,
  type ContributionAccount,
  type ContributionRepository,
  type ContributionValues,
  type ContributionCoverage,
} from '@/models/contributions';
import {
  additionalMetricIds,
  changeStatIds,
  volumeMetricId,
  type AdditionalValues,
} from '@/models/contribution-activity';
import { reportMetricIds, isCoreMetric, type ReportMetric } from '@/models/contribution-metrics';
import type { Count } from '@/models/reporting-measurement';
import { validateContributionSource } from './contribution-source';
import { sumContributionCounts } from './contribution-activity';

interface ContributionCell {
  metrics: Map<ReportMetric, Count>;
  overviewEvidence: boolean;
}
type Cells = Map<string, Map<string, ContributionCell>>;
const indexes = new WeakMap<ContributionSource, ReturnType<typeof buildIndex>>();
function baseline(coverage: ContributionCoverage): Count {
  if (coverage.status === 'complete') return { status: 'complete', value: 0 };
  return coverage.status === 'missing'
    ? { status: 'missing', value: null, reason: coverage.reason }
    : { status: 'partial', value: 0, reason: coverage.reason };
}
function buildIndex(source: ContributionSource) {
  const records = new Map(source.records.map((record) => [record.id, record]));
  const companies = new Map(source.companies.map((company) => [company.id, company]));
  const raw = new Map<string, Map<string, Map<ReportMetric, Count[]>>>();
  const cell = (accountId: string, repositoryId: string) => {
    let repos = raw.get(accountId);
    if (!repos) raw.set(accountId, (repos = new Map<string, Map<ReportMetric, Count[]>>()));
    let metrics = repos.get(repositoryId);
    if (!metrics) repos.set(repositoryId, (metrics = new Map<ReportMetric, Count[]>()));
    return metrics;
  };
  const add = (accountId: string, repositoryId: string, metric: ReportMetric, value: Count) => {
    const metrics = cell(accountId, repositoryId);
    const values = metrics.get(metric) ?? [];
    values.push(value);
    metrics.set(metric, values);
  };
  for (const credit of source.credits)
    add(credit.accountId, records.get(credit.recordId)!.repositoryId, credit.metric, {
      status: 'complete',
      value: 1,
    });
  for (const comment of source.activity.comments)
    add(comment.accountId, records.get(comment.recordId)!.repositoryId, comment.kind, {
      status: 'complete',
      value: 1,
    });
  for (const volume of source.activity.volumes) {
    const record = records.get(volume.recordId)!;
    if (record.kind !== 'pr') throw Error('Expected PR volume');
    for (const stat of changeStatIds)
      add(
        volume.accountId,
        record.repositoryId,
        volumeMetricId(volume.role, stat),
        record.mergedDiff?.[stat] ?? {
          status: 'missing',
          value: null,
          reason: 'Final merged diff values are unavailable.',
        },
      );
  }
  const defaults = new Map<ReportMetric, Count>();
  for (const metric of reportMetricIds) {
    const coverage = isCoreMetric(metric)
      ? source.coverage[metric]
      : source.activity.coverage[metric];
    defaults.set(metric, baseline(coverage));
  }
  const overrides = new Map<string, Map<string, Map<ReportMetric, Count>>>();
  for (const override of source.coverageOverrides) {
    cell(override.accountId, override.repositoryId).set(
      override.metric,
      cell(override.accountId, override.repositoryId).get(override.metric) ?? [],
    );
    let repos = overrides.get(override.accountId);
    if (!repos)
      overrides.set(override.accountId, (repos = new Map<string, Map<ReportMetric, Count>>()));
    let metrics = repos.get(override.repositoryId);
    if (!metrics) repos.set(override.repositoryId, (metrics = new Map<ReportMetric, Count>()));
    metrics.set(override.metric, baseline(override.coverage));
  }
  const cells: Cells = new Map();
  for (const [account, repositories] of raw) {
    const selected = new Map<string, ContributionCell>();
    cells.set(account, selected);
    for (const [repository, metrics] of repositories) {
      const values = new Map<ReportMetric, Count>();
      const cell = { metrics: values, overviewEvidence: false };
      selected.set(repository, cell);
      for (const [metric, counts] of metrics) {
        const count = sumContributionCounts(counts);
        const override = overrides.get(account)?.get(repository)?.get(metric);
        // Eligibility comes from account-specific evidence before report-wide
        // coverage is applied. A global gap cannot populate the whole directory.
        cell.overviewEvidence ||=
          (count.value ?? 0) > 0 ||
          count.status === 'partial' ||
          count.status === 'missing' ||
          override?.status === 'partial' ||
          override?.status === 'missing';
        const coverage = override ?? defaults.get(metric)!;
        values.set(
          metric,
          coverage.status === 'missing'
            ? coverage
            : coverage.status === 'partial' && count.value !== null
              ? {
                  status: 'partial',
                  value: count.value,
                  reason: [
                    coverage.reason,
                    ...(count.status === 'complete' ? [] : [count.reason]),
                  ].join('; '),
                }
              : count,
        );
      }
    }
  }
  function aggregate(
    accounts: readonly ContributionAccount[],
    repositories: readonly ContributionRepository[],
  ) {
    const repoIds = new Set(repositories.map((repo) => repo.id));
    const counts = new Map<ReportMetric, Count[]>();
    for (const account of accounts) {
      for (const [repository, { metrics }] of cells.get(account.id) ?? []) {
        if (!repoIds.has(repository)) continue;
        for (const [metric, count] of metrics) {
          const values = counts.get(metric) ?? [];
          values.push(count);
          counts.set(metric, values);
        }
      }
    }
    const totalCells = accounts.length * repoIds.size;
    const measure = (metric: ReportMetric) => {
      const values = counts.get(metric) ?? [];
      // All implicit cells share a zero/null baseline. One representative preserves
      // status/reasons and the sum, without materializing the account × repo product.
      return sumContributionCounts(
        totalCells > values.length ? [defaults.get(metric)!, ...values] : values,
      );
    };
    return {
      metrics: Object.fromEntries(
        contributionMetricIds.map((metric) => [metric, measure(metric)]),
      ) as ContributionValues,
      additionalMetrics: Object.fromEntries(
        additionalMetricIds.map((metric) => [metric, measure(metric)]),
      ) as AdditionalValues,
    };
  }
  return Object.freeze({
    source,
    aggregate,
    company(id: string) {
      return companies.get(id);
    },
    hasOverviewEvidence(accountId: string, repositories: ReadonlySet<string>) {
      for (const [id, cell] of cells.get(accountId) ?? [])
        if (cell.overviewEvidence && repositories.has(id)) return true;
      return false;
    },
  });
}
/** Only immutable, validated snapshots are memoized; mutable callers are validated into a fresh copy. */
export function contributionIndex(input: ContributionSource) {
  const source = validateContributionSource(input);
  let index = indexes.get(source);
  if (!index) indexes.set(source, (index = buildIndex(source)));
  return index;
}
