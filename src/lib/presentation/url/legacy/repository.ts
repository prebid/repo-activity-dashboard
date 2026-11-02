// Frozen pre-codec URL readers, moved unchanged. They decode old links for the 307 to the
// canonical form and serve callers that have not moved to the codec yet.
import { repositoryPageFiltersSchema, type RepositoryPageFilters } from '@/models/repository-page';
import {
  overviewReturnPathSchema,
  repositoryDrilldownSchema,
  type RepositoryDrilldown,
} from '@/models/repository-drilldown';
import type { OverviewRepository } from '@/models/repository-overview';
import type { RecordSelection } from '@/models/repository-records';
import { authorAccountSchema, authorTableColumnIds } from '@/models/repository-insights';
import { type TableQuery } from '@/models/table-query';
import { isRecordSelection } from '../../repository-records';
import { readTableQuery } from './table-query';
const arrayFields = [
  'labels',
  'authors',
  'authorTypes',
  'states',
  'latestActors',
  'branches',
  'assignees',
] as const;
const scalarFields = [
  'draft',
  'assignment',
  'ageBand',
  'reviewers',
  'approvals',
  'agentReviewer',
  'botReviewer',
] as const;
const rangeFields = ['eventFrom', 'eventTo', 'eventInclusive'] as const;
/** Shared syntax decoder; each consumer applies its own current/historical compatibility rule. */
export function readRepositoryFilterValues(
  search: string,
  kind: 'prs' | 'issues',
): RepositoryPageFilters | null {
  const params = new URLSearchParams(search),
    prefix = kind + '.filter.';
  if (params.getAll(kind + '.q').length > 1) return null;
  const input: Record<string, unknown> = {
    kind,
    search: params.get(kind + '.q') ?? '',
  };
  for (const key of params.keys())
    if (
      key.startsWith(prefix) &&
      ![...arrayFields, ...scalarFields, ...rangeFields].some((field) => key === prefix + field)
    )
      return null;
  for (const field of arrayFields)
    if (params.has(prefix + field)) input[field] = params.getAll(prefix + field);
  for (const field of scalarFields)
    if (params.has(prefix + field)) {
      if (params.getAll(prefix + field).length !== 1) return null;
      if (field === 'ageBand' && !/^(0|30|60|90|120|180|360)$/.test(params.get(prefix + field)!))
        return null;
      input[field] =
        field === 'ageBand' ? Number(params.get(prefix + field)) : params.get(prefix + field);
    }
  if (rangeFields.some((field) => params.has(prefix + field))) {
    if (rangeFields.some((field) => params.getAll(prefix + field).length !== 1)) return null;
    const inclusive = params.get(prefix + 'eventInclusive');
    input.eventRange = {
      start: params.get(prefix + 'eventFrom'),
      end: params.get(prefix + 'eventTo'),
      endInclusive: inclusive === '1' ? true : inclusive === '0' ? false : undefined,
    };
  }
  const parsed = repositoryPageFiltersSchema.safeParse(input);
  if (!parsed.success) return null;
  return parsed.data;
}
type ReadDrilldown =
  { status: 'none' } | { status: 'invalid' } | { status: 'valid'; value: RepositoryDrilldown };
/** The route supplies a catalog-resolved repository; malformed scope never becomes a default list. */
export function readRepositoryDrilldown(
  params: URLSearchParams,
  repo: OverviewRepository,
): ReadDrilldown {
  const fields = ['scope', 'metric', 'age', 'from', 'to', 'inclusive', 'branch'];
  if (!fields.some((key) => params.has(key)))
    return params.has('returnTo') &&
      !overviewReturnPathSchema.safeParse(params.get('returnTo')).success
      ? { status: 'invalid' }
      : { status: 'none' };
  const selection: Record<string, unknown> = {
    scope: params.get('scope'),
    metric: params.get('metric'),
  };
  if (params.has('age')) selection.ageDays = Number(params.get('age'));
  if (params.has('branch')) selection.branch = params.get('branch');
  if (['from', 'to', 'inclusive'].some((key) => params.has(key))) {
    const inclusive = params.get('inclusive');
    selection.range = {
      start: params.get('from'),
      end: params.get('to'),
      endInclusive: inclusive === '1' ? true : inclusive === '0' ? false : undefined,
    };
  }
  const parsed = repositoryDrilldownSchema.safeParse({
    selection,
    returnTo: params.get('returnTo') ?? '/repos',
  });
  if (!parsed.success) return { status: 'invalid' };
  const result = parsed.data;
  if (
    result.selection.scope === 'period' &&
    result.selection.branch !== undefined &&
    result.selection.branch !== repo.primaryBranch
  )
    return { status: 'invalid' };
  return { status: 'valid', value: result };
}
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
/** Decode the route segment once; keep logical account validation strict and shared. */
export function readAuthorAccountSegment(segment: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    return null;
  }
  const account = authorAccountSchema.safeParse(decoded);
  return account.success ? account.data : null;
}
export function authorListQuery(params: URLSearchParams): TableQuery {
  return readTableQuery(params.toString(), 'authors', authorTableColumnIds);
}
