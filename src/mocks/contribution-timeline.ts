import type { ContributionTimelineSource } from '@/models/contribution-timeline';
import {
  contributionPreparedRange,
  contributionSample,
  type ContributionScenario,
} from './contributions';
import { validateContributionSource } from '@/lib/presentation/contribution-source';
import { resolveReportingPeriod } from '@/lib/presentation/reporting-period';

/** One fixed full-range source is shared by every grouping and supporting-record selection. */
export function contributionTimelineSample(
  scenario: ContributionScenario | 'calendar' = 'reference',
  gap = false,
): ContributionTimelineSource {
  let contributions = contributionSample({
    scenario: scenario === 'calendar' ? 'reference' : scenario,
  });
  if (scenario === 'calendar') {
    const copy = structuredClone(contributions),
      shift = (at: string) => at.replace(/^2026-/, '2024-');
    copy.period = { kind: 'custom', from: '2024-01-01', through: '2024-12-31' };
    copy.range = resolveReportingPeriod(copy.period, copy.asOf).range;
    copy.scenarioId = 'contributions-timeline-calendar-v1';
    for (const row of copy.records) {
      row.createdAt = shift(row.createdAt);
      if (row.kind === 'pr' && row.mergedAt) row.mergedAt = shift(row.mergedAt);
    }
    for (const row of copy.credits) row.creditedAt = shift(row.creditedAt);
    for (const row of copy.activity.comments) row.createdAt = shift(row.createdAt);
    for (const row of copy.activity.volumes) row.qualifiedAt = shift(row.qualifiedAt);
    contributions = validateContributionSource(copy);
  }
  if (gap)
    contributions = validateContributionSource({
      ...contributions,
      scenarioId: contributions.scenarioId + '-temporal-gap',
    });
  // The report's prepared history, so both apply one rule to ranges that leave it.
  const prepared = scenario === 'calendar' ? contributions.range : contributionPreparedRange;
  const year = prepared.start.slice(0, 4);
  return {
    contributions,
    availableRanges:
      scenario === 'missing'
        ? []
        : gap
          ? [
              {
                start: prepared.start,
                end: year + '-02-01T00:00:00.000Z',
                endInclusive: false,
              },
              {
                start: year + '-03-01T00:00:00.000Z',
                end: prepared.end,
                endInclusive: prepared.endInclusive,
              },
            ]
          : [prepared],
  };
}
