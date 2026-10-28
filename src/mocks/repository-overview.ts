import { repositoryCatalog } from '@/config/repositories';
import { defaultPeriod, periodPresets, type PeriodSelection } from '@/models/reporting-period';
import {
  activityMetricIds,
  activitySchema,
  backlogSchema,
  reportingBranchSchema,
  type ActivityMetric,
  type RepositoryActivity,
  type RepositoryOverview,
  type RepositoryOverviewSamples,
} from '@/models/repository-overview';
import { resolveReportingPeriod } from '@/lib/presentation/reporting-period';
import { busyPeriods, preparedCustomPeriod, secondPreparedCustomPeriod } from './overview-activity';
import { overviewBacklogs } from './overview-backlog';
import { activity, emptyActivity, missing, partial } from './overview-values';

export const overviewAsOf = '2026-10-24T12:00:00.000Z';
export const customSampleSelection: PeriodSelection = {
  kind: 'custom',
  from: '2026-10-06',
  through: '2026-10-08',
};
export const secondCustomSampleSelection: PeriodSelection = {
  kind: 'custom',
  from: '2026-10-13',
  through: '2026-10-15',
};

// These factors vary invented display examples. They are not estimates of real repository activity.
const sampleSizes: Record<string, number | 'empty'> = {
  'repo-prebidjs': 1,
  'repo-prebidserver': 2,
  'repo-prebidserverjava': 3,
  'repo-prebiddocs': 2,
  'repo-prebidmobileandroid': 4,
  'repo-prebidmobileios': 5,
  'repo-prebid-mobile-ios-sdk': 'empty',
  'repo-prebid-universal-creative': 6,
  'repo-professor-prebid': 8,
  'repo-salesagent': 3,
  'repo-prebid-agent-skills': 7,
  'repo-line-item-manager': 9,
  'repo-go-gdpr': 40,
  'repo-prebid-cache-java': 8,
  'repo-repo-activity-dashboard': 6,
  'repo-openrtb': 40,
  'repo-github-activity-db': 12,
  'repo-prebid-integration-monitor': 'empty',
};

function sizedSample(source: RepositoryActivity, divisor: number): RepositoryActivity {
  const counts = Object.fromEntries(
    activityMetricIds.map((key) => {
      const metric = source.counts[key];
      if (metric.status !== 'complete')
        throw new Error('Sample template must contain complete counts');
      return [key, Math.floor(metric.value / divisor)];
    }),
  ) as Record<ActivityMetric, number>;
  if (counts.prsOpened > 0) counts.prAuthors = Math.max(1, counts.prAuthors);
  if (counts.issuesOpened > 0) counts.issueAuthors = Math.max(1, counts.issueAuthors);
  const days = source.mergeDuration.days;
  if (counts.prsMerged > 0 && days.status !== 'complete')
    throw new Error('Sample template is missing merge duration');
  return activity(counts, counts.prsMerged > 0 ? days.value : null);
}

export function repositoryOverviewSamples(): RepositoryOverviewSamples {
  const reports = [
    ...periodPresets.map((preset) => repositoryOverviewSample({ kind: 'preset', preset })),
    repositoryOverviewSample(customSampleSelection),
    repositoryOverviewSample(secondCustomSampleSelection),
  ];
  const first = reports[0];
  return {
    source: 'sample',
    scenarioId: first.scenarioId,
    asOf: first.asOf,
    repositories: first.rows.map(({ repository, backlog }) => ({ repository, backlog })),
    periods: reports.map((report) => ({
      period: report.period,
      rows: Object.fromEntries(
        report.rows.map((row) => [
          row.repository.id,
          { activity: row.activity, comparison: row.comparison },
        ]),
      ),
    })),
  };
}

function unavailableActivity(reason: string): RepositoryActivity {
  return {
    counts: Object.fromEntries(
      activityMetricIds.map((key) => [key, missing(reason)]),
    ) as RepositoryActivity['counts'],
    mergeDuration: { days: missing(reason), sampleSize: missing(reason) },
  };
}

/** Prepared summaries only. Supporting row lists belong to the later drilldown step. */
export function repositoryOverviewSample(
  selection: PeriodSelection = defaultPeriod,
  repositoryIds?: readonly string[],
): RepositoryOverview {
  const period = resolveReportingPeriod(selection, overviewAsOf);
  const selected = repositoryIds === undefined ? null : new Set(repositoryIds);
  const catalog = repositoryCatalog.filter((repo) => repo.enabled);
  if (selected && [...selected].some((id) => !catalog.some((repo) => repo.id === id)))
    throw new Error('Unknown sample repository selection');
  const input = period.selection;
  const pair =
    input.kind === 'preset'
      ? busyPeriods[input.preset]
      : input.from === '2026-10-06' && input.through === '2026-10-08'
        ? preparedCustomPeriod
        : input.from === '2026-10-13' && input.through === '2026-10-15'
          ? secondPreparedCustomPeriod
          : null;
  const rows = catalog
    .filter((repo) => !selected || selected.has(repo.id))
    .map((repo) => {
      const size = sampleSizes[repo.id];
      const backlog = overviewBacklogs[repo.id];
      if (size === undefined || !backlog) throw new Error('Missing overview sample for ' + repo.id);
      let current: RepositoryActivity;
      let comparison: RepositoryActivity;
      if (!pair) {
        current = unavailableActivity('No prepared sample for this custom date range.');
        comparison = unavailableActivity('No prepared comparison for this custom date range.');
      } else if (size === 'empty') {
        current = structuredClone(emptyActivity);
        comparison = structuredClone(emptyActivity);
      } else {
        current = sizedSample(pair.current, size);
        comparison = sizedSample(pair.comparison, size);
      }
      if (pair && repo.id === 'repo-prebid-cache-java') {
        const value = current.counts.issuesClosed.value;
        if (value !== null)
          current.counts.issuesClosed = partial(
            value,
            'Only part of the issue closure sample is available.',
          );
      }
      if (pair && repo.id === 'repo-github-activity-db')
        comparison = unavailableActivity('Comparison history is missing in this sample.');
      return {
        repository: {
          id: repo.id,
          slug: repo.slug,
          name: repo.displayName,
          primaryBranch: reportingBranchSchema.parse(repo.primaryBranch),
        },
        backlog: backlogSchema.parse(backlog),
        activity: activitySchema.parse(current),
        comparison: activitySchema.parse(comparison),
      };
    });
  return {
    source: 'sample',
    scenarioId: 'all-repositories-v1',
    asOf: overviewAsOf,
    period,
    activitySample: pair ? 'prepared' : 'unprepared',
    rows,
  };
}
