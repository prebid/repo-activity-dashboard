import { contributionRecordKey } from './contribution-identity';
import { inDateRange } from './reporting-period';
import type {
  ContributionSource,
  ContributionContext,
  ContributionAccount,
  ContributionRecord,
} from '@/models/contributions';
import type { ContributionSupportingRow } from '@/models/contribution-details';
import { contributionMetricBasis, type ReportMetric } from '@/models/contribution-metrics';
import { changeStatIds, volumeMetricId } from '@/models/contribution-activity';
function recordMetadata(record: ContributionRecord): ContributionSupportingRow['record'] {
  if (record.kind === 'issue') return record;
  const { mergedDiff: _diff, ...metadata } = record;
  return metadata;
}
/** Metadata only. One row per account/record: comments are grouped, credits and role volumes are not multiplied. */
export function contributionDetailRows(
  source: ContributionSource,
  context: ContributionContext,
  metric: ReportMetric,
  includedAccounts: readonly ContributionAccount[],
): ContributionSupportingRow[] {
  const accounts = new Map(includedAccounts.map((row) => [row.id, row]));
  const repos = new Map(
    source.repositories
      .filter((row) => context.selection.repositoryIds.includes(row.id))
      .map((row) => [row.id, row]),
  );
  const records = new Map(source.records.map((row) => [row.id, row]));
  const companies = new Map(source.companies.map((company) => [company.id, company]));
  const rows = new Map<string, ContributionSupportingRow>();
  function add(
    accountId: string,
    recordId: string,
    at: string,
    value: ContributionSupportingRow['value'],
  ) {
    const account = accounts.get(accountId),
      record = records.get(recordId)!;
    const repository = repos.get(record.repositoryId);
    // Filter dated facts before grouping comments on the same account/record.
    if (!account || !repository || !inDateRange(at, context.range)) return;
    const id = contributionRecordKey(accountId, recordId, metric);
    const prior = rows.get(id);
    if (prior) {
      prior.value = { status: 'complete', value: prior.value.value! + value.value! };
      prior.creditedAt = prior.creditedAt < at ? prior.creditedAt : at;
      prior.lastAt = prior.lastAt > at ? prior.lastAt : at;
    } else
      rows.set(id, {
        id,
        account,
        company: account.companyId === null ? null : (companies.get(account.companyId) ?? null),
        repository,
        record: recordMetadata(record),
        value,
        creditedAt: at,
        lastAt: at,
      });
  }
  const basis = contributionMetricBasis(metric);
  if (basis === 'credit') {
    for (const credit of source.credits)
      if (credit.metric === metric)
        add(credit.accountId, credit.recordId, credit.creditedAt, { status: 'complete', value: 1 });
  } else if (basis === 'comments') {
    for (const comment of source.activity.comments)
      if (comment.kind === metric)
        add(comment.accountId, comment.recordId, comment.createdAt, {
          status: 'complete',
          value: 1,
        });
  } else {
    for (const volume of source.activity.volumes) {
      const stat = changeStatIds.find((stat) => volumeMetricId(volume.role, stat) === metric);
      if (!stat) continue;
      const record = records.get(volume.recordId)!;
      if (record.kind !== 'pr') throw Error('Expected merged PR');
      add(
        volume.accountId,
        volume.recordId,
        record.mergedAt!,
        record.mergedDiff?.[stat] ?? {
          status: 'missing',
          value: null,
          reason: 'Final merged diff values are unavailable.',
        },
      );
    }
  }
  return [...rows.values()];
}
