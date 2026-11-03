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
import { sampleRecordSource, type RepositoryRecordSource } from './record-source';
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

const bundles = new WeakMap<RepositoryRecordSource, RepositoryOverviewSamples>();
/** The Summary bundle: every preset and the two sample custom periods, read from one record set. */
export function repositoryOverviewSamples(
  source: RepositoryRecordSource = sampleRecordSource,
): RepositoryOverviewSamples {
  let bundle = bundles.get(source);
  if (!bundle) {
    bundle = buildRepositoryOverviewSamples(source);
    bundles.set(source, bundle);
  }
  return structuredClone(bundle);
}
function buildRepositoryOverviewSamples(source: RepositoryRecordSource): RepositoryOverviewSamples {
  const reports = [
    ...periodPresets.map((preset) =>
      repositoryOverviewSample({ kind: 'preset', preset }, undefined, source),
    ),
    repositoryOverviewSample(customSampleSelection, undefined, source),
    repositoryOverviewSample(secondCustomSampleSelection, undefined, source),
  ];
  const first = reports[0];
  return {
    source: first.source,
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
  source: RepositoryRecordSource = sampleRecordSource,
): RepositoryOverview {
  const period = resolveReportingPeriod(selection, source.asOf);
  const selected = repositoryIds === undefined ? null : new Set(repositoryIds);
  const catalog = repositoryCatalog.filter((repo) => repo.enabled);
  if (selected && [...selected].some((id) => !catalog.some((repo) => repo.id === id)))
    throw new Error('Unknown sample repository selection');
  const rows = catalog
    .filter((repo) => !selected || selected.has(repo.id))
    .map((repo) => {
      const backlog = source.backlog(repo.id);
      return {
        repository: {
          id: repo.id,
          slug: repo.slug,
          name: repo.displayName,
          primaryBranch: reportingBranchSchema.parse(repo.primaryBranch),
        },
        backlog: backlogSchema.parse(backlog),
        activity: activitySchema.parse(periodActivity(repo.id, period.range, source)),
        comparison: activitySchema.parse(periodActivity(repo.id, period.comparison, source)),
      };
    });
  return {
    source: source.kind,
    scenarioId: source.kind === 'sample' ? 'all-repositories-v1' : source.scenarioId,
    asOf: source.asOf,
    period,
    activitySample: 'prepared',
    rows,
  };
}
