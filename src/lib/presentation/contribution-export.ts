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
import { effectiveTableQuery, writeTableQuery } from './table-query';
import { type TableQuery } from '@/models/table-query';
import { writeContributionSettings } from './contribution-settings';
import { contributionContextColumns } from './contribution-csv';
import { serializeCsv } from './csv-export';
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
  const columns =
    focus.data.kind === 'overview'
      ? area === 'contributors'
        ? contributorValues()
        : companyValues()
      : focus.data.kind === 'company' && breakdown === 'members'
        ? contributorValues(false)
        : repositoryContributionValues();
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
export function contributionExportHref(
  page: ContributionPage,
  query: TableQuery,
  layout: ContributionExportRequest['layout'],
  metrics: readonly string[],
): string {
  const params = new URLSearchParams(
    writeContributionSettings('', {
      period: page.report.context.period,
      selection: page.report.context.selection,
    }),
  );
  if (page.sample !== 'reference') params.set('sample', page.sample);
  const focus = page.report.context.focus;
  params.set('entity', focus.kind);
  if (focus.kind === 'contributor') params.set('entityId', focus.accountId);
  if (focus.kind === 'company') params.set('entityId', focus.companyId ?? '');
  params.set('view', page.breakdown);
  params.set('layout', layout);
  if (page.hideZeroMembers) params.set('members.zero', 'hide');
  for (const column of ['name', 'actorType', 'company', 'members', ...reportMetricIds])
    if (metrics.includes(column)) params.append('column', column);
  return (
    '/' +
    page.area +
    '/export?' +
    writeTableQuery(params.toString(), 'export', { ...query, page: 1 })
  );
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
