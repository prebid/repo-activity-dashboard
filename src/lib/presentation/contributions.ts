import { selectTableRows } from '@/lib/presentation/table-rows';
import type { AdditionalValues } from '@/models/contribution-activity';
import type {
  ContributionExportRequest,
  ContributionExportRow,
} from '@/models/contribution-export';
import {
  contributorValues,
  companyValues,
  repositoryContributionValues,
  isKnownZeroContribution,
} from './contribution-table-values';
import { contributionDetailRows } from './contribution-detail-rows';
import { isCoreMetric, isReportMetric, type ReportMetric } from '@/models/contribution-metrics';
import type { ContributionMetricDetails } from '@/models/contribution-details';
import {
  type ContributionSource,
  type ContributionAccount,
  type ContributionSelection,
  type ContributionFocus,
  type ContributionReport,
  type ContributionContext,
  type ContributionValues,
  type ContributorMetricRow,
  type CompanyMetricRow,
  type RepositoryContributionRow,
} from '@/models/contributions';
import { contributionScope } from './contribution-scope';

export { defaultContributionSelection } from './contribution-scope';
function prepare(
  input: ContributionSource,
  requested?: ContributionSelection,
  requestedFocus: ContributionFocus = { kind: 'overview' },
) {
  const {
    index,
    source,
    selection,
    focus,
    accounts,
    repositories,
    chosenRepositories,
    companyFor,
    grouped,
  } = contributionScope(input, requested, requestedFocus);
  const aggregates = new Map<string, ReturnType<typeof index.aggregate>>();
  function accountValues(account: ContributionAccount) {
    let values = aggregates.get(account.id);
    if (!values) aggregates.set(account.id, (values = index.aggregate([account], repositories)));
    return values;
  }
  const eligibleAccounts =
    focus.kind === 'overview'
      ? accounts.filter((account) => index.hasOverviewEvidence(account.id, chosenRepositories))
      : [];
  function contributors(includeZeros = false): ContributorMetricRow[] {
    if (!repositories.length) return [];
    return (includeZeros ? accounts : eligibleAccounts).map((account) => ({
      id: account.id,
      account,
      company: companyFor(account.companyId),
      ...accountValues(account),
    }));
  }
  const companyMeasures = new Map<string | null, ReturnType<typeof index.aggregate>>();
  for (const id of new Set(eligibleAccounts.map((account) => account.companyId)))
    companyMeasures.set(id, index.aggregate(grouped.get(id)!, repositories));
  function companies(): CompanyMetricRow[] {
    return [...companyMeasures.keys()].map((id) => ({
      id: JSON.stringify(['company', id]),
      company: companyFor(id),
      memberCount: grouped.get(id)!.length,
      ...companyMeasures.get(id)!,
    }));
  }
  const context: ContributionContext = {
    source: source.source,
    scenarioId: source.scenarioId,
    asOf: source.asOf,
    period: source.period,
    range: source.range,
    companyAttribution: source.companyAttribution,
    selection,
    focus,
    includedAccountCount: accounts.length,
  };
  return {
    source,
    focus,
    accounts,
    repositories,
    grouped,
    companyFor,
    contributors,
    companies,
    contributorCount: eligibleAccounts.length,
    companyCount: companyMeasures.size,
    context,
    aggregate: index.aggregate,
  };
}
export interface ContributionReportView {
  area?: 'contributors' | 'companies';
  breakdown?: 'members' | 'repositories';
}
/** Select only the requested display collection; all metrics still use the full selected scope. */
export function selectContributions(
  source: ContributionSource,
  selection?: ContributionSelection,
  focus: ContributionFocus = { kind: 'overview' },
  view: ContributionReportView = {},
): ContributionReport {
  return reportFrom(prepare(source, selection, focus), view);
}
function repositoryContributions(
  data: ReturnType<typeof prepare>,
  accounts = data.accounts,
): RepositoryContributionRow[] {
  return data.repositories
    .map((repository) => ({
      id: repository.id,
      repository,
      ...data.aggregate(accounts, [repository]),
    }))
    .filter((row) => !isKnownZeroContribution(row));
}
function reportFrom(
  data: ReturnType<typeof prepare>,
  view: ContributionReportView,
  details = false,
): ContributionReport {
  const values = data.aggregate(data.accounts, data.repositories);
  const base = {
    context: data.context,
    totals: values.metrics,
    additionalTotals: values.additionalMetrics,
  };
  if (data.focus.kind === 'overview')
    return {
      ...base,
      kind: 'overview',
      contributorCount: data.contributorCount,
      companyCount: data.companyCount,
      table: details
        ? null
        : view.area === 'companies'
          ? { kind: 'companies', rows: data.companies() }
          : { kind: 'contributors', rows: data.contributors() },
    };
  if (data.focus.kind === 'company')
    return {
      ...base,
      kind: 'company',
      company: data.companyFor(data.focus.companyId),
      memberCount: data.accounts.length,
      table: details
        ? null
        : view.breakdown === 'repositories'
          ? { kind: 'repositories', rows: repositoryContributions(data) }
          : { kind: 'members', rows: data.contributors(true) },
    };
  const accountId = data.focus.accountId,
    account = data.source.accounts.find((row) => row.id === accountId)!;
  return {
    ...base,
    kind: 'contributor',
    account,
    company: data.companyFor(account.companyId),
    table: details ? null : { kind: 'repositories', rows: repositoryContributions(data) },
  };
}
export function selectContributionPresentation(
  source: ContributionSource,
  selection: ContributionSelection,
  focus: ContributionFocus,
  metric?: ReportMetric,
  view: ContributionReportView = {},
): { report: ContributionReport; details?: ContributionMetricDetails } {
  if (metric !== undefined && !isReportMetric(metric)) throw Error('Unknown contribution metric');
  const data = prepare(source, selection, focus),
    report = reportFrom(data, view, !!metric);
  if (!metric) return { report };
  const rows = contributionDetailRows(data.source, data.context, metric, data.accounts);
  return {
    report,
    details: {
      context: data.context,
      metric,
      measurement: isCoreMetric(metric) ? report.totals[metric] : report.additionalTotals[metric],
      basis: isCoreMetric(metric) ? 'credit' : metric.includes('.') ? 'merged-volume' : 'comments',
      rows,
      distinctRecords: new Set(rows.map((row) => row.record.id)).size,
    },
  };
}

/** Lazy flat export projection; filter and sort entities before expanding repository rows. */
export function selectContributionExport(
  source: ContributionSource,
  selection: ContributionSelection,
  request: ContributionExportRequest,
): { context: ContributionContext; rows: ContributionExportRow[] } {
  const data = prepare(source, selection, request.focus);
  if (!data.accounts.length || !data.repositories.length)
    return { context: data.context, rows: [] };
  const report = reportFrom(data, request);
  const table = report.table!;
  const entity = (
    account?: ContributionAccount,
    companyId: string | null = account?.companyId ?? null,
  ) => ({
    entityType: account ? ('contributor' as const) : ('company' as const),
    entityId: account?.id ?? JSON.stringify(['company', companyId]),
    name: account?.name ?? data.companyFor(companyId)?.name ?? 'Unmapped company',
    login: account?.login ?? null,
    memberCount: account ? null : (data.grouped.get(companyId)?.length ?? 0),
    actorType: account?.actorType ?? null,
    companyId,
    company: data.companyFor(companyId)?.name ?? 'Unmapped company',
  });
  const expand = (
    identity: ReturnType<typeof entity>,
    accounts: ContributionAccount[],
    totals: ContributionValues,
    additionalMetrics: AdditionalValues,
  ): ContributionExportRow[] =>
    request.layout === 'repositories'
      ? repositoryContributions(data, accounts).map((row) => ({
          ...identity,
          id: JSON.stringify([identity.entityId, row.repository.id]),
          repositoryId: row.repository.id,
          repository: row.repository.name,
          metrics: row.metrics,
          additionalMetrics: row.additionalMetrics,
        }))
      : [
          {
            ...identity,
            id: identity.entityId,
            repositoryId: null,
            repository: null,
            metrics: totals,
            additionalMetrics,
          },
        ];
  if (table.kind === 'contributors')
    return {
      context: data.context,
      rows: selectTableRows(table.rows, contributorValues(), request.query).flatMap((row) =>
        expand(entity(row.account), [row.account], row.metrics, row.additionalMetrics),
      ),
    };
  if (table.kind === 'companies')
    return {
      context: data.context,
      rows: selectTableRows(table.rows, companyValues(), request.query).flatMap((row) =>
        expand(
          entity(undefined, row.company?.id ?? null),
          data.grouped.get(row.company?.id ?? null) ?? [],
          row.metrics,
          row.additionalMetrics,
        ),
      ),
    };
  if (table.kind === 'members')
    return {
      context: data.context,
      rows: selectTableRows(
        request.hideZeroMembers
          ? table.rows.filter((row) => !isKnownZeroContribution(row))
          : table.rows,
        contributorValues(false),
        request.query,
      ).flatMap((row) =>
        expand(entity(row.account), [row.account], row.metrics, row.additionalMetrics),
      ),
    };
  if (table.kind !== 'repositories' || report.kind === 'overview')
    throw Error('Expected repository export');
  const identity = entity(
    report.kind === 'contributor' ? report.account : undefined,
    report.company?.id ?? null,
  );
  return {
    context: data.context,
    rows: selectTableRows(table.rows, repositoryContributionValues(), request.query, false).map(
      (row) => ({
        ...identity,
        id: JSON.stringify([identity.entityId, row.repository.id]),
        repositoryId: row.repository.id,
        repository: row.repository.name,
        metrics: row.metrics,
        additionalMetrics: row.additionalMetrics,
      }),
    ),
  };
}
