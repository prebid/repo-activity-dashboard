import { repositoryCatalog } from '@/config/repositories';
import { defaultPeriod, periodPresets, type PeriodSelection } from '@/models/reporting-period';
import {
  activitySchema,
  backlogSchema,
  reportingBranchSchema,
  type RepositoryOverview,
  type RepositoryOverviewSamples,
} from '@/models/repository-overview';
import { resolveReportingPeriod } from '@/lib/presentation/reporting-period';
import { overviewBacklogs } from './overview-backlog';
import { periodActivity } from './repository-activity';
import { overviewAsOf } from './sample-clock';

export { overviewAsOf };
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

let samples: RepositoryOverviewSamples | undefined;
/** The Summary bundle: every preset and the two sample custom periods, read from one record set. */
export function repositoryOverviewSamples(): RepositoryOverviewSamples {
  samples ??= buildRepositoryOverviewSamples();
  return structuredClone(samples);
}
function buildRepositoryOverviewSamples(): RepositoryOverviewSamples {
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

/** Summary rows for any period: activity and comparison counted from the repository record set. */
export function repositoryOverviewSample(
  selection: PeriodSelection = defaultPeriod,
  repositoryIds?: readonly string[],
): RepositoryOverview {
  const period = resolveReportingPeriod(selection, overviewAsOf);
  const selected = repositoryIds === undefined ? null : new Set(repositoryIds);
  const catalog = repositoryCatalog.filter((repo) => repo.enabled);
  if (selected && [...selected].some((id) => !catalog.some((repo) => repo.id === id)))
    throw new Error('Unknown sample repository selection');
  const rows = catalog
    .filter((repo) => !selected || selected.has(repo.id))
    .map((repo) => {
      const backlog = overviewBacklogs[repo.id];
      if (!backlog) throw new Error('Missing overview sample for ' + repo.id);
      return {
        repository: {
          id: repo.id,
          slug: repo.slug,
          name: repo.displayName,
          primaryBranch: reportingBranchSchema.parse(repo.primaryBranch),
        },
        backlog: backlogSchema.parse(backlog),
        activity: activitySchema.parse(periodActivity(repo.id, period.range)),
        comparison: activitySchema.parse(periodActivity(repo.id, period.comparison)),
      };
    });
  return {
    source: 'sample',
    scenarioId: 'all-repositories-v1',
    asOf: overviewAsOf,
    period,
    activitySample: 'prepared',
    rows,
  };
}
