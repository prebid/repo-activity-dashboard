import {
  contributionFocusSchema,
  contributionDefaultSort,
  type ContributionContext,
} from '@/models/contributions';
import {
  reportMetricIds,
  isReportMetric,
  isCoreMetric,
  reportMetricLabel,
  reportMetricDescription,
} from '@/models/contribution-metrics';
import type {
  ContributionExportRequest,
  ContributionExportRow,
} from '@/models/contribution-export';
import type { ContributionArea, ContributionPage } from '@/models/contribution-page';
import {
  contributorValues,
  companyValues,
  repositoryContributionValues,
  type ValueColumn,
} from './contribution-table-values';
import { effectiveTableQuery } from './table-query';
import { type TableQuery } from '@/models/table-query';
import { contributionContextColumns } from './contribution-csv';
import { contributionScopeValues } from './contribution-url';
import { serializeCsv } from './csv-export';
import { legacySearchParams, parseQuery, queryPairs, urlHref, type QueryInput } from './url/codec';
import { defaultValue } from './url/defaults';
import type { UrlRoute, UrlValue, UrlValues } from './url/registry';
/** The frozen reader of a legacy export query. */
export function readContributionExport(
  params: URLSearchParams,
  area: ContributionArea,
): ContributionExportRequest | null {
  const kind = params.get('entity') ?? 'overview';
  if (params.getAll('entityId').length > 1 || (kind === 'company' && !params.has('entityId')))
    return null;
  const focus = contributionFocusSchema.safeParse(
    kind === 'contributor'
      ? { kind, accountId: params.get('entityId') }
      : kind === 'company'
        ? { kind, companyId: params.get('entityId') || null }
        : { kind },
  );
  const breakdown = params.get('view') ?? 'members',
    layout = params.get('layout') ?? 'summary';
  const requested = params.getAll('column');
  if (
    !focus.success ||
    !['members', 'repositories'].includes(breakdown) ||
    !['summary', 'repositories'].includes(layout) ||
    !requested.length ||
    requested.some(
      (id) => !isReportMetric(id) && !['name', 'actorType', 'company', 'members'].includes(id),
    )
  )
    return null;
  const columns = exportColumns(
    focus.data,
    area,
    breakdown as ContributionExportRequest['breakdown'],
  );
  const query = effectiveTableQuery(
    params.toString(),
    'export',
    columns.map((column) => column.id),
    contributionDefaultSort,
  );
  if (
    focus.data.kind === 'contributor' ||
    (focus.data.kind === 'company' && breakdown === 'repositories')
  )
    query.search = '';
  return {
    area,
    focus: focus.data,
    breakdown: breakdown as ContributionExportRequest['breakdown'],
    layout: layout as ContributionExportRequest['layout'],
    hideZeroMembers: params.get('members.zero') === 'hide',
    identityColumns: (['actorType', 'company', 'members'] as const).filter((id) =>
      requested.includes(id),
    ),
    metrics: reportMetricIds.filter((metric) => requested.includes(metric)),
    query,
  };
}
const exportColumnOrder = ['name', 'actorType', 'company', 'members', ...reportMetricIds];
const exportRoutes = {
  contributors: '/contributors/export',
  companies: '/companies/export',
} as const satisfies Record<ContributionArea, UrlRoute>;
/** Return context never changes an export, so it is dropped before the query is read. */
const returnKeys: ReadonlySet<string> = new Set([
  'back',
  'returnTo',
  'summary',
  'timelineParent',
  'nav',
]);
const exportOnly = (key: string) =>
  key === 'column' ||
  key === 'layout' ||
  key === 'entity' ||
  key === 'entityId' ||
  key.startsWith('export.');
const text = (values: UrlValues, name: string) =>
  typeof values[name] === 'string' ? values[name] : undefined;
/** An export request from canonical registry values; null when a choice is missing or unknown. */
function canonicalExport(
  values: UrlValues,
  area: ContributionArea,
): ContributionExportRequest | null {
  const kind = text(values, 'entity') ?? 'overview',
    id = text(values, 'id');
  const focus = contributionFocusSchema.safeParse(
    kind === 'contributor'
      ? { kind, accountId: id }
      : kind === 'company'
        ? { kind, companyId: id === 'unmapped' ? null : id }
        : { kind },
  );
  const requested = typeof values.columns === 'object' ? values.columns : [];
  if (
    !focus.success ||
    (kind === 'overview' && id !== undefined) ||
    values.lens === 'reviewers' ||
    !requested.length ||
    requested.some((column) => !exportColumnOrder.includes(column))
  )
    return null;
  const breakdown = values.view === 'repositories' ? 'repositories' : 'members';
  const columns = exportColumns(focus.data, area, breakdown);
  const sort = text(values, 'sort') ?? defaultValue(exportRoutes[area], 'sort', values);
  const sortId = typeof sort === 'string' ? sort.replace(/^-/, '') : '';
  const searchable = !(
    focus.data.kind === 'contributor' ||
    (focus.data.kind === 'company' && breakdown === 'repositories')
  );
  return {
    area,
    focus: focus.data,
    breakdown,
    layout: text(values, 'layout') === 'repositories' ? 'repositories' : 'summary',
    hideZeroMembers: values.zero === 'hide',
    identityColumns: (['actorType', 'company', 'members'] as const).filter((column) =>
      requested.includes(column),
    ),
    metrics: reportMetricIds.filter((metric) => requested.includes(metric)),
    query: {
      search: searchable ? (text(values, 'q') ?? '') : '',
      ...(columns.some((column) => column.id === sortId)
        ? { sort: sortId, descending: typeof sort === 'string' && sort.startsWith('-') }
        : { sort: '', descending: false }),
      page: 1,
    },
  };
}
/** The value columns an export's table has. */
function exportColumns(
  focus: ContributionExportRequest['focus'],
  area: ContributionArea,
  breakdown: ContributionExportRequest['breakdown'],
) {
  return focus.kind === 'overview'
    ? area === 'contributors'
      ? contributorValues()
      : companyValues()
    : focus.kind === 'company' && breakdown === 'members'
      ? contributorValues(false)
      : repositoryContributionValues();
}
/** An export query in either form, with the scope the report loads it from. */
export type ContributionExportQuery =
  | { form: 'canonical'; request: ContributionExportRequest; values: UrlValues }
  | { form: 'legacy'; request: ContributionExportRequest; scope: URLSearchParams };
/**
 * Read an export query. Export links are never redirected (decision 14), so both the canonical
 * form and the legacy form (`column`, `entityId`, `export.*`, `scope=1`) are served, and return
 * context is ignored. Null when the query is neither, or names an unknown choice.
 */
export function readContributionExportQuery(
  input: QueryInput,
  area: ContributionArea,
): ContributionExportQuery | null {
  const pairs = queryPairs(input).filter(([key]) => !returnKeys.has(key));
  const parsed = parseQuery(exportRoutes[area], pairs);
  if (parsed.kind === 'canonical') {
    const request = canonicalExport(parsed.values, area);
    return request && { form: 'canonical', request, values: parsed.values };
  }
  if (parsed.kind === 'invalid') return null;
  const request = readContributionExport(legacySearchParams(pairs), area);
  return (
    request && {
      form: 'legacy',
      request,
      scope: legacySearchParams(pairs.filter(([key]) => !exportOnly(key))),
    }
  );
}
/** The canonical export link of a report's table: its scope, choices, search and sort. */
export function contributionExportHref(
  page: ContributionPage,
  query: TableQuery,
  layout: ContributionExportRequest['layout'],
  metrics: readonly string[],
): string {
  const focus = page.report.context.focus;
  const values: Record<string, UrlValue> = {
    ...(page.sample !== 'reference' && { sample: page.sample }),
    ...(page.breakdown === 'repositories' && { view: 'repositories' }),
    ...contributionScopeValues({
      period: page.report.context.period,
      selection: page.report.context.selection,
    }),
    entity: focus.kind,
    ...(focus.kind === 'contributor' && { id: focus.accountId }),
    ...(focus.kind === 'company' && { id: focus.companyId ?? 'unmapped' }),
    layout,
    columns: exportColumnOrder.filter((column) => metrics.includes(column)),
    ...(page.hideZeroMembers && { zero: 'hide' }),
    ...(query.search && { q: query.search }),
    ...(query.sort && { sort: (query.descending ? '-' : '') + query.sort }),
  };
  return urlHref(exportRoutes[page.area], {}, values);
}
export function contributionCsv(
  rows: ContributionExportRow[],
  request: ContributionExportRequest,
  context: ContributionContext,
): string {
  const columns: ValueColumn<ContributionExportRow>[] = [
    { id: 'entityType', label: 'Entity type', value: (row) => row.entityType },
    { id: 'entityId', label: 'Entity ID', value: (row) => row.entityId },
    { id: 'name', label: 'Name', value: (row) => row.name },
    { id: 'login', label: 'GitHub account', value: (row) => row.login },
    ...(request.identityColumns.includes('actorType')
      ? [
          {
            id: 'actorType',
            label: 'Account type',
            value: (row: ContributionExportRow) => row.actorType,
          },
        ]
      : []),
    ...(request.identityColumns.includes('members')
      ? [
          {
            id: 'members',
            label: 'Included accounts',
            value: (row: ContributionExportRow) => row.memberCount,
          },
        ]
      : []),
    { id: 'companyId', label: 'Company ID', value: (row) => row.companyId },
    ...(request.identityColumns.includes('company')
      ? [
          {
            id: 'company',
            label: 'Current company',
            value: (row: ContributionExportRow) => row.company,
          },
        ]
      : []),
    { id: 'repositoryId', label: 'Repository ID', value: (row) => row.repositoryId },
    { id: 'repository', label: 'Repository', value: (row) => row.repository },
    ...request.metrics.flatMap((metric) => {
      const count = (row: ContributionExportRow) =>
        isCoreMetric(metric) ? row.metrics[metric] : row.additionalMetrics[metric];
      return [
        {
          id: metric,
          label: reportMetricLabel(metric),
          value: (row: ContributionExportRow) => count(row).value,
        },
        {
          id: metric + '.coverage',
          label: reportMetricLabel(metric) + ' coverage',
          value: (row: ContributionExportRow) => count(row).status,
        },
        {
          id: metric + '.reason',
          label: reportMetricLabel(metric) + ' coverage detail',
          value: (row: ContributionExportRow) => {
            const value = count(row);
            return value.status === 'complete' ? '' : value.reason;
          },
        },
        {
          id: metric + '.definition',
          label: reportMetricLabel(metric) + ' counting basis',
          value: () => reportMetricDescription(metric),
        },
      ];
    }),
    { id: 'layout', label: 'Export layout', value: () => request.layout },
    {
      id: 'hideZeroMembers',
      label: 'Hide zero member totals',
      value: () => String(request.hideZeroMembers ?? false),
    },
    ...contributionContextColumns<ContributionExportRow>(context, request.query),
  ];
  return serializeCsv(rows, columns);
}
