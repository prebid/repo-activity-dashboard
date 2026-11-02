import type { ContributionMetricDetails } from './contribution-details';
import type { ContributionReport } from './contributions';
export const contributionSampleScenarios = [
  'reference',
  'large',
  'coverage-gap',
  'partial',
  'missing',
  'empty',
] as const;
export type ContributionSampleScenario = (typeof contributionSampleScenarios)[number];
export type ContributionArea = 'contributors' | 'companies';
export type CompanyBreakdown = 'members' | 'repositories';
export interface ContributionPage {
  report: ContributionReport;
  details?: ContributionMetricDetails;
  area: ContributionArea;
  sample: ContributionSampleScenario;
  breakdown: CompanyBreakdown;
  hideZeroMembers?: boolean;
  /** The report "Back to report" opens; null when the page it came from cannot be restored. */
  returnTo: string | null;
}
