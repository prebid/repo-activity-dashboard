import type { DrilldownSelection } from '@/models/repository-drilldown';
import {
  insightMetrics,
  type InsightSelection,
  type InsightMetric,
} from '@/models/repository-insights';

export function isInsightSelection(selection: DrilldownSelection): selection is InsightSelection {
  return (
    selection.scope === 'period' && insightMetrics.some((metric) => metric === selection.metric)
  );
}
export const insightTitles: Record<InsightMetric, string> = {
  prAuthors: 'PR authors',
  issueAuthors: 'Issue authors',
  agentFeedbackCredits: 'Prebid agent reviewer contributions',
  agentApprovalCredits: 'Prebid agent approval contributions',
  botFeedbackCredits: 'Bot reviewer contributions',
  botApprovalCredits: 'Bot approval contributions',
  medianMergeDays: 'Merge-duration details',
};
/** Elapsed calendar days, without rounding the value used for sorting. */
export function mergeElapsedDays(createdAt: string, mergedAt: string | null): number | null {
  if (mergedAt === null) return null;
  const elapsed = Date.parse(mergedAt) - Date.parse(createdAt);
  return Number.isFinite(elapsed) && elapsed >= 0 ? elapsed / 86_400_000 : null;
}
