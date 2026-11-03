import type { ContributionDirectory } from '@/models/contribution-settings';
import type { ContributionTimelineSource } from '@/models/contribution-timeline';
import type { ContributionSource } from '@/models/contributions';
import type { PeriodSelection } from '@/models/reporting-period';
import { contributionTimelineSample } from './contribution-timeline';
import {
  contributionDirectorySample,
  contributionSample,
  contributionSampleAsOf,
  type ContributionScenario,
} from './contributions';

/**
 * Where contribution reports read accounts, records and credits: the prepared samples or the
 * activity database. A database ignores sample scenarios.
 */
export interface ContributionRecordSource {
  readonly kind: 'sample' | 'database';
  readonly asOf: string;
  report(scenario: ContributionScenario, period?: PeriodSelection): ContributionSource;
  directory(scenario: ContributionScenario): ContributionDirectory;
  timeline(scenario: ContributionScenario | 'calendar', gap: boolean): ContributionTimelineSource;
}

export const sampleContributionRecords: ContributionRecordSource = {
  kind: 'sample',
  asOf: contributionSampleAsOf,
  report: (scenario, period) => contributionSample({ scenario, period }),
  directory: contributionDirectorySample,
  timeline: contributionTimelineSample,
};
