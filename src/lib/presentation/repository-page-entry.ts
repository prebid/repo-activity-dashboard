import type { OverviewRepository } from '@/models/repository-overview';
import type { RepositoryDrilldown } from '@/models/repository-drilldown';
import type { RecordSelection } from '@/models/repository-records';
import { readRepositoryDrilldown } from './repository-drilldown';
import { isRecordSelection } from './repository-records';

type RepositoryPageEntry =
  | { status: 'invalid' }
  | { status: 'records'; drilldown: RepositoryDrilldown & { selection: RecordSelection } }
  | { status: 'supporting'; drilldown: RepositoryDrilldown };

/** Normalize existing entry paths without changing their metric, dates or return context. */
export function readRepositoryPageEntry(
  params: URLSearchParams,
  repo: OverviewRepository,
): RepositoryPageEntry {
  const parsed = readRepositoryDrilldown(params, repo);
  if (parsed.status === 'invalid') return parsed;
  if (parsed.status === 'valid') {
    const { selection, returnTo } = parsed.value;
    return isRecordSelection(selection)
      ? { status: 'records', drilldown: { selection, returnTo } }
      : { status: 'supporting', drilldown: parsed.value };
  }
  const view = params.get('view') ?? 'prs';
  if (view !== 'prs' && view !== 'issues') return { status: 'invalid' };
  return {
    status: 'records',
    drilldown: {
      selection: { scope: 'current', metric: view === 'prs' ? 'totalOpenPrs' : 'openIssues' },
      returnTo: params.get('returnTo') ?? '/repos',
    },
  };
}
