// URL values of the repositories area: record-list presentation (columns, sort and charts) as codec
// fields, and the viewer's saved presentation those fields carry into links (decision C3).
import type { DrilldownSelection } from '@/models/repository-drilldown';
import { authorTableColumnIds } from '@/models/repository-insights';
import {
  insightCreditColumnIds,
  mergedPrColumnIds,
  recordIssueColumnIds,
  recordPrColumnIds,
} from '@/models/table-columns';
import type { TableQuery } from '@/models/table-query';
import type { RepositoryPresentation } from './repository-page-preferences';
import { recordListKind, isRecordSelection } from './repository-records';
import {
  columnTokens,
  recordColumnTable,
  visibleColumns,
  type UrlColumnTable,
} from './url/defaults';
import type { UrlValue, UrlValues } from './url/registry';

type SavedSort = Pick<TableQuery, 'sort' | 'descending'>;

/** Values with a patch applied; an undefined field in the patch removes that field. */
export function mergeValues(
  base: UrlValues,
  patch: Readonly<Record<string, UrlValue | undefined>>,
): Record<string, UrlValue> {
  const result: Record<string, UrlValue> = { ...base };
  for (const [name, value] of Object.entries(patch))
    if (value === undefined) delete result[name];
    else result[name] = value;
  return result;
}

/** A sort as a `sort` token: `id` ascending, `-id` descending; undefined for no sort. */
export function sortToken(sort: SavedSort | null | undefined): string | undefined {
  return sort?.sort ? (sort.descending ? '-' : '') + sort.sort : undefined;
}

/**
 * Record columns that are not a viewer's choice: the number and title always show, and the status,
 * labels and author type show inline in the title and author cells.
 */
const fixedRecordColumns: ReadonlySet<string> = new Set([
  'number',
  'title',
  'labels',
  'state',
  'authorType',
]);
/** The record columns the Columns menu lists, in table order. */
export function recordMenuColumnIds(kind: 'prs' | 'issues'): readonly string[] {
  return (kind === 'prs' ? recordPrColumnIds : recordIssueColumnIds).filter(
    (id) => !fixedRecordColumns.has(id),
  );
}
/** The Columns menu's choices a `cols` field describes, or null when it names an unknown column. */
export function recordColumnChoices(
  table: UrlColumnTable,
  tokens: UrlValue | undefined,
): Record<string, boolean> | null {
  const visible = visibleColumns(table, Array.isArray(tokens) ? tokens : []);
  if (!visible) return null;
  return Object.fromEntries(
    table.ids.filter((id) => !fixedRecordColumns.has(id)).map((id) => [id, visible.includes(id)]),
  );
}
/** The `cols` field for the Columns menu's choices; fixed columns keep the table's default. */
export function recordColumnField(
  table: UrlColumnTable,
  choices: Readonly<Record<string, boolean>>,
): readonly string[] | undefined {
  const visible = table.ids.filter((id) =>
    fixedRecordColumns.has(id) || choices[id] === undefined ? table.visible.has(id) : choices[id],
  );
  const tokens = columnTokens(table, visible);
  return tokens.length ? tokens : undefined;
}

/** A record list's saved sort and its saved columns and charts. */
export interface SavedRecordPresentation {
  readonly sort?: SavedSort | null;
  readonly presentation?: RepositoryPresentation | null;
}
/** The viewer's saved repository presentation, by table, as the server validated it. */
export interface RepositoryLinkPresentation {
  readonly prs?: SavedRecordPresentation;
  readonly issues?: SavedRecordPresentation;
  readonly authors?: SavedSort | null;
  readonly mergedPrs?: SavedSort | null;
  readonly credits?: SavedSort | null;
}
const savedSortField = (sort: SavedSort | null | undefined, ids: readonly string[]) =>
  sort && ids.includes(sort.sort) ? sortToken(sort) : undefined;
/**
 * The presentation fields a link to a repository list or insight carries for the viewer's saved
 * choices: the target table's sort, and a record list's columns and charts. A list scoped to one
 * author keeps that author's column table. Choices for columns the target lacks do not apply.
 */
export function drilldownPresentation(
  selection: DrilldownSelection,
  saved: RepositoryLinkPresentation | undefined,
  authorScoped = false,
): Record<string, UrlValue> {
  if (!saved) return {};
  const fields: Record<string, UrlValue | undefined> = {};
  if (isRecordSelection(selection)) {
    const kind = recordListKind(selection);
    const list = saved[kind];
    const table = recordColumnTable(kind, selection.metric, authorScoped);
    fields.sort = savedSortField(list?.sort, table.ids);
    const choices = list?.presentation?.columns ?? {};
    fields.cols = recordColumnField(
      table,
      Object.fromEntries(
        Object.entries(choices).filter(([id]) => recordMenuColumnIds(kind).includes(id)),
      ),
    );
    fields.charts = list?.presentation?.chartsVisible || undefined;
  } else
    fields.sort =
      selection.metric === 'prAuthors' || selection.metric === 'issueAuthors'
        ? savedSortField(saved.authors, authorTableColumnIds)
        : selection.metric === 'medianMergeDays'
          ? savedSortField(saved.mergedPrs, mergedPrColumnIds)
          : savedSortField(saved.credits, insightCreditColumnIds);
  return mergeValues({}, fields);
}
