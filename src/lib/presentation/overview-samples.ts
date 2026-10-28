import type { PeriodSelection } from '@/models/reporting-period';
import {
  activityMetricIds,
  type RepositoryActivity,
  type RepositoryOverview,
  type RepositoryOverviewSamples,
} from '@/models/repository-overview';
import { resolveReportingPeriod } from './reporting-period';

function selectionKey(selection: PeriodSelection): string {
  return selection.kind === 'preset' ? selection.preset : selection.from + '/' + selection.through;
}
function missingActivity(): RepositoryActivity {
  const missing = {
    status: 'missing' as const,
    value: null,
    reason: 'No prepared sample for this date range.',
  };
  return {
    counts: Object.fromEntries(
      activityMetricIds.map((id) => [id, { ...missing }]),
    ) as RepositoryActivity['counts'],
    mergeDuration: { days: { ...missing }, sampleSize: { ...missing } },
  };
}

/** Select prepared values only; unsupported ranges remain visibly missing. */
export function selectOverviewSample(
  samples: RepositoryOverviewSamples,
  selection: PeriodSelection,
  repositoryIds: readonly string[],
): RepositoryOverview {
  const period = resolveReportingPeriod(selection, samples.asOf);
  const prepared = samples.periods.find(
    (sample) => selectionKey(sample.period.selection) === selectionKey(period.selection),
  );
  if (repositoryIds.some((id) => !samples.repositories.some((row) => row.repository.id === id)))
    throw new Error('Unknown sample repository');
  const rows = samples.repositories
    .filter((row) => repositoryIds.includes(row.repository.id))
    .map((row) => {
      const activity = prepared?.rows[row.repository.id];
      if (prepared && !activity) throw new Error('Incomplete prepared sample');
      return {
        ...row,
        activity: activity?.activity ?? missingActivity(),
        comparison: activity?.comparison ?? missingActivity(),
      };
    });
  return {
    source: samples.source,
    scenarioId: samples.scenarioId,
    asOf: samples.asOf,
    period,
    activitySample: prepared ? 'prepared' : 'unprepared',
    rows,
  };
}
