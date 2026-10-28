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
export function readRepositoryColumns(
  raw: string | null,
  allowed: readonly string[],
): Record<string, boolean> {
  try {
    const parsed: unknown = JSON.parse(raw ?? 'null');
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('version' in parsed) ||
      parsed.version !== 1 ||
      !('columns' in parsed) ||
      !parsed.columns ||
      typeof parsed.columns !== 'object' ||
      Array.isArray(parsed.columns)
    )
      return {};
    return Object.fromEntries(
      Object.entries(parsed.columns).filter(
        ([id, value]) => allowed.includes(id) && typeof value === 'boolean',
      ),
    );
  } catch {
    return {};
  }
}
export function serializeRepositoryColumns(columns: Record<string, boolean>): string {
  return JSON.stringify({ version: 1, columns });
}
/** An explicit column list is authoritative; absent keys use the saved overrides and scope defaults. */
export function resolveRepositoryColumns(
  search: string,
  kind: string,
  defaults: Record<string, boolean>,
  saved: Record<string, boolean>,
  allowed: readonly string[],
): Record<string, boolean> {
  const params = new URLSearchParams(search),
    key = kind + '.columns';
  return params.has(key)
    ? {
        ...defaults,
        ...Object.fromEntries(allowed.map((id) => [id, params.getAll(key).includes(id)])),
      }
    : { ...defaults, ...saved };
}
export function writeRepositoryColumns(
  search: string,
  kind: string,
  columns: Record<string, boolean>,
  allowed: readonly string[],
): string {
  const params = new URLSearchParams(search),
    key = kind + '.columns';
  params.delete(key);
  for (const id of allowed) if (columns[id] !== false) params.append(key, id);
  if (!params.has(key)) params.set(key, '');
  return params.toString();
}
