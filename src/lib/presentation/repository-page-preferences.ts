import type { RepositoryPageSource } from '@/models/repository-page';

export function repositoryColumnDefaults(page: RepositoryPageSource): Record<string, boolean> {
  const { metric, scope } = page.drilldown.selection,
    current = scope === 'current';
  return {
    labels: false,
    state: false,
    authorType: false,
    createdAt: !current,
    ageDays: current,
    humanReviewers:
      (current && ['totalOpenPrs', 'nonDraftPrs'].includes(metric)) ||
      metric.startsWith('humanReviewers'),
    approvals:
      (current && ['totalOpenPrs', 'nonDraftPrs'].includes(metric)) ||
      metric.startsWith('humanApprovals'),
    mergedAt: metric === 'prsMerged',
    mergeDays: metric === 'prsMerged',
    baseBranch: metric === 'prsMerged',
    closedAt: metric === 'issuesClosed',
    agentReviewer: metric === 'agentFeedbackPrs',
    botReviewer: metric === 'botFeedbackPrs',
    latestActor: false,
    latestActivity: current,
    assignees: false,
  };
}
export function repositoryColumnsKey(viewerId: string, repositoryId: string, kind: string): string {
  return (
    'dashboard:repository-columns:v1:' +
    [viewerId, repositoryId, kind].map(encodeURIComponent).join(':')
  );
}
export function readRepositoryCharts(raw: string | null): boolean {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    return !!(
      value &&
      typeof value === 'object' &&
      'version' in value &&
      value.version === 1 &&
      'chartsVisible' in value &&
      value.chartsVisible === true
    );
  } catch {
    return false;
  }
}
export {
  readTableColumns as readRepositoryColumns,
  resolveTableColumns as resolveRepositoryColumns,
  writeTableColumns as writeRepositoryColumns,
} from './table-column-preferences';
export function serializeRepositoryColumns(
  columns: Record<string, boolean>,
  chartsVisible = false,
): string {
  return JSON.stringify({ version: 1, columns, chartsVisible });
}
