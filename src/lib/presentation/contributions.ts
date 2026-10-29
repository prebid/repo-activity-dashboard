import type { AdditionalValues } from '@/models/contribution-activity';
import type {
  ContributionExportRequest,
  ContributionExportRow,
} from '@/models/contribution-export';
import {
  contributorValues,
  companyValues,
  repositoryContributionValues,
  contributionTableRows,
  isKnownZeroContribution,
} from './contribution-table-values';
import { contributionDetailRows } from './contribution-detail-rows';
import { isCoreMetric, isReportMetric, type ReportMetric } from '@/models/contribution-metrics';
import type { ContributionMetricDetails } from '@/models/contribution-details';
import { contributionActivitySelector, hasAdditionalActivity } from './contribution-activity';
import {
  contributionActorTypes,
  contributionMetricIds,
  contributionSelectionSchema,
  contributionFocusSchema,
  type ContributionSource,
  type ContributionAccount,
  type ContributionSelection,
  type ContributionFocus,
  type ContributionReport,
  type ContributionContext,
  type ContributionValues,
  type ContributionCount,
  type ContributorMetricRow,
  type CompanyMetricRow,
  type RepositoryContributionRow,
} from '@/models/contributions';
import { contributionCellKey, validateContributionSource } from './contribution-source';

export function defaultContributionSelection(source: ContributionSource): ContributionSelection {
  return {
    repositoryIds: source.repositories.map((row) => row.id),
    actorTypes: [...contributionActorTypes],
    population: { kind: 'all' },
    excludedAccountIds: [],
  };
}
/** Include incomplete rows even when their known subtotal is zero. No metric is an overall score. */
export function hasContributionActivity(metrics: ContributionValues): boolean {
  return contributionMetricIds.some(
    (metric) => metrics[metric].status !== 'complete' || metrics[metric].value > 0,
  );
}
function prepare(
  input: ContributionSource,
  requested?: ContributionSelection,
  requestedFocus: ContributionFocus = { kind: 'overview' },
) {
  const source = validateContributionSource(input);
  const selection = contributionSelectionSchema.parse(
    requested ?? defaultContributionSelection(source),
  );
  const focus = contributionFocusSchema.parse(requestedFocus);
  const accountIds = new Set(source.accounts.map((row) => row.id));
  const companyIds = new Set(source.companies.map((row) => row.id));
  const repositoryIds = new Set(source.repositories.map((row) => row.id));
  const companyKnown = (id: string | null) => id === null || companyIds.has(id);
  if (
    selection.repositoryIds.some((id) => !repositoryIds.has(id)) ||
    selection.excludedAccountIds.some((id) => !accountIds.has(id))
  )
    throw new Error('Unknown contribution selection');
  if (
    selection.population.kind === 'selected' &&
    (selection.population.accountIds.some((id) => !accountIds.has(id)) ||
      selection.population.companyIds.some((id) => !companyKnown(id)))
  )
    throw new Error('Unknown selected population');
  if (
    (focus.kind === 'contributor' && !accountIds.has(focus.accountId)) ||
    (focus.kind === 'company' && !companyKnown(focus.companyId))
  )
    throw new Error('Unknown contribution focus');
  const accounts = source.accounts.filter((account) => {
    const population = selection.population;
    return (
      selection.actorTypes.includes(account.actorType) &&
      !selection.excludedAccountIds.includes(account.id) &&
      (population.kind === 'all' ||
        population.accountIds.includes(account.id) ||
        population.companyIds.includes(account.companyId)) &&
      (focus.kind !== 'contributor' || account.id === focus.accountId) &&
      (focus.kind !== 'company' || account.companyId === focus.companyId)
    );
  });
  const repositories = source.repositories.filter((row) =>
    selection.repositoryIds.includes(row.id),
  );
  const chosenAccounts = new Set(accounts.map((row) => row.id));
  const chosenRepositories = new Set(repositories.map((row) => row.id));
  const recordMap = new Map(source.records.map((row) => [row.id, row]));
  const credits = source.credits.filter(
    (row) =>
      chosenAccounts.has(row.accountId) &&
      chosenRepositories.has(recordMap.get(row.recordId)!.repositoryId),
  );
  const cellCounts = new Map<string, number>();
  for (const credit of credits) {
    const key = contributionCellKey(
      credit.accountId,
      recordMap.get(credit.recordId)!.repositoryId,
      credit.metric,
    );
    cellCounts.set(key, (cellCounts.get(key) ?? 0) + 1);
  }
  const overrides = new Map(
    source.coverageOverrides.map((row) => [
      contributionCellKey(row.accountId, row.repositoryId, row.metric),
      row.coverage,
    ]),
  );
  function metrics(forAccounts = accounts, forRepositories = repositories): ContributionValues {
    const entries = contributionMetricIds.map((metric) => {
      let value = 0,
        available = 0,
        cells = 0;
      const reasons = new Set<string>();
      for (const account of forAccounts)
        for (const repository of forRepositories) {
          cells++;
          const key = contributionCellKey(account.id, repository.id, metric);
          const coverage = overrides.get(key) ?? source.coverage[metric];
          if (coverage.status !== 'complete') reasons.add(coverage.reason);
          if (coverage.status !== 'missing') {
            available++;
            value += cellCounts.get(key) ?? 0;
          }
        }
      const count: ContributionCount =
        cells > 0 && available === 0
          ? { status: 'missing', value: null, reason: [...reasons].join('; ') }
          : reasons.size
            ? { status: 'partial', value, reason: [...reasons].join('; ') }
            : { status: 'complete', value };
      return [metric, count];
    });
    return Object.fromEntries(entries) as ContributionValues;
  }
  const additional = contributionActivitySelector(source);
  const companyFor = (id: string | null) => source.companies.find((row) => row.id === id) ?? null;
  const contributors: ContributorMetricRow[] = accounts.map((account) => ({
    id: account.id,
    account,
    company: companyFor(account.companyId),
    metrics: metrics([account]),
    additionalMetrics: additional([account], repositories),
  }));
  const context: ContributionContext = {
    source: source.source,
    scenarioId: source.scenarioId,
    asOf: source.asOf,
    period: source.period,
    range: source.range,
    companyAttribution: source.companyAttribution,
    selection,
    focus,
    includedAccountIds: accounts.map((row) => row.id),
  };
  return {
    source,
    focus,
    accounts,
    repositories,
    credits,
    recordMap,
    metrics,
    companyFor,
    contributors,
    context,
    additional,
  };
}
export function selectContributions(
  source: ContributionSource,
  selection?: ContributionSelection,
  focus: ContributionFocus = { kind: 'overview' },
): ContributionReport {
  return reportFrom(prepare(source, selection, focus));
}
/** Omit confirmed-zero rows from the projection; keep the selected catalog and full-scope totals intact. */
function repositoryContributions(
  data: ReturnType<typeof prepare>,
  accounts = data.accounts,
): RepositoryContributionRow[] {
  return data.repositories
    .map((repository) => ({
      id: repository.id,
      repository,
      metrics: data.metrics(accounts, [repository]),
      additionalMetrics: data.additional(accounts, [repository]),
    }))
    .filter((row) => !isKnownZeroContribution(row));
}
function reportFrom(data: ReturnType<typeof prepare>): ContributionReport {
  const base = {
    context: data.context,
    totals: data.metrics(),
    additionalTotals: data.additional(data.accounts, data.repositories),
  };
  if (data.focus.kind === 'overview') {
    const companies: CompanyMetricRow[] = [
      ...new Set(data.accounts.map((account) => account.companyId)),
    ].map((id) => {
      const members = data.accounts.filter((account) => account.companyId === id);
      return {
        id: JSON.stringify(['company', id]),
        company: data.companyFor(id),
        memberCount: members.length,
        metrics: data.metrics(members),
        additionalMetrics: data.additional(members, data.repositories),
      };
    });
    return {
      ...base,
      kind: 'overview',
      contributors: data.contributors.filter(
        (row) =>
          hasContributionActivity(row.metrics) || hasAdditionalActivity(row.additionalMetrics),
      ),
      companies: companies.filter(
        (row) =>
          hasContributionActivity(row.metrics) || hasAdditionalActivity(row.additionalMetrics),
      ),
    };
  }
  const repositories = repositoryContributions(data);
  if (data.focus.kind === 'company')
    return {
      ...base,
      kind: 'company',
      company: data.companyFor(data.focus.companyId),
      members: data.contributors,
      repositories,
    };
  const accountId = data.focus.accountId;
  const account = data.source.accounts.find((row) => row.id === accountId)!;
  return {
    ...base,
    kind: 'contributor',
    account,
    company: data.companyFor(account.companyId),
    repositories,
  };
}
/** Compose a report and optional supporting list from one validated selection. */
export function selectContributionPresentation(
  source: ContributionSource,
  selection: ContributionSelection,
  focus: ContributionFocus,
  metric?: ReportMetric,
): { report: ContributionReport; details?: ContributionMetricDetails } {
  if (metric !== undefined && !isReportMetric(metric)) throw Error('Unknown contribution metric');
  const data = prepare(source, selection, focus);
  const report = reportFrom(data);
  if (!metric) return { report };
  const rows = contributionDetailRows(data.source, data.context, metric);
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
  const report = reportFrom(data);
  const entity = (
    account?: ContributionAccount,
    companyId: string | null = account?.companyId ?? null,
  ) => ({
    entityType: account ? ('contributor' as const) : ('company' as const),
    entityId: account?.id ?? JSON.stringify(['company', companyId]),
    name: account?.name ?? data.companyFor(companyId)?.name ?? 'Unmapped company',
    login: account?.login ?? null,
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
  if (report.kind === 'overview' && request.area === 'contributors')
    return {
      context: data.context,
      rows: contributionTableRows(report.contributors, contributorValues(), request.query).flatMap(
        (row) => expand(entity(row.account), [row.account], row.metrics, row.additionalMetrics),
      ),
    };
  if (report.kind === 'overview')
    return {
      context: data.context,
      rows: contributionTableRows(report.companies, companyValues(), request.query).flatMap((row) =>
        expand(
          entity(undefined, row.company?.id ?? null),
          data.accounts.filter((account) => account.companyId === (row.company?.id ?? null)),
          row.metrics,
          row.additionalMetrics,
        ),
      ),
    };
  if (report.kind === 'company' && request.breakdown === 'members')
    return {
      context: data.context,
      rows: contributionTableRows(
        request.hideZeroMembers
          ? report.members.filter((row) => !isKnownZeroContribution(row))
          : report.members,
        contributorValues(false),
        request.query,
      ).flatMap((row) =>
        expand(entity(row.account), [row.account], row.metrics, row.additionalMetrics),
      ),
    };
  const identity = entity(
    report.kind === 'contributor' ? report.account : undefined,
    report.company?.id ?? null,
  );
  return {
    context: data.context,
    rows: contributionTableRows(
      report.repositories,
      repositoryContributionValues(),
      request.query,
      false,
    ).map((row) => ({
      ...identity,
      id: JSON.stringify([identity.entityId, row.repository.id]),
      repositoryId: row.repository.id,
      repository: row.repository.name,
      metrics: row.metrics,
      additionalMetrics: row.additionalMetrics,
    })),
  };
}
