import type {
  ContributionSource,
  ContributionSelection,
  ContributionFocus,
  ContributionAccount,
  ContributionCompany,
} from './contributions';
import type { ReportMetric } from './contribution-metrics';
import type { DateRange } from './reporting-period';
import type { TimelineSeries, TimelineSourceIdentity } from './reporting-timeline';
export interface ContributionTimelineSource {
  contributions: ContributionSource;
  availableRanges: DateRange[];
}
export interface ContributionTimeline extends TimelineSeries<ReportMetric> {
  kind: 'contributions';
  scope: {
    selection: ContributionSelection;
    focus: ContributionFocus;
    includedAccountCount: number;
    subject: ContributionAccount | ContributionCompany | null;
    companyAttribution: 'current-mapping';
  };
}
export interface ContributionTimelineDetail {
  kind: 'contribution';
  source: TimelineSourceIdentity;
  metric: ReportMetric;
  basis: 'credit' | 'comments' | 'merged-volume';
  range: DateRange;
  selection: ContributionSelection;
  focus: ContributionFocus;
}
