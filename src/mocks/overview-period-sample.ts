import type { DateRange } from '@/models/reporting-period';
import { repositoryOverviewSamples } from './repository-overview';
const periods = repositoryOverviewSamples().periods;

/** Look up an exact prepared range; never substitute another period's sample. */
export function preparedPeriodSample(repositoryId: string, range: DateRange) {
  const index = periods.findIndex(
    ({ period }) =>
      period.range.start === range.start &&
      period.range.end === range.end &&
      period.range.endInclusive === range.endInclusive,
  );
  const activity = periods[index]?.rows[repositoryId]?.activity;
  return activity ? { index, activity, selection: periods[index].period.selection } : undefined;
}
