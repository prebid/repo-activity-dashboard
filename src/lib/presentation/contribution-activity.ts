import type {
  ContributionAccount,
  ContributionRepository,
  ContributionSource,
} from '@/models/contributions';
import {
  additionalMetricIds,
  changeStatIds,
  fileStatusStats,
  volumeMetricId,
  type AdditionalMetric,
  type AdditionalValues,
  type ChangeStats,
} from '@/models/contribution-activity';
import type { Count } from '@/models/reporting-measurement';
import { inDateRange } from './reporting-period';
import { contributionCellKey as key } from './contribution-identity';

function reconcile(
  stats: ChangeStats,
  total: 'filesChanged' | 'linesChanged',
  parts: readonly (keyof ChangeStats)[],
) {
  const sum = parts.reduce((value, part) => value + (stats[part].value ?? 0), 0);
  if (
    stats[total].status === 'complete' &&
    (sum > stats[total].value ||
      (parts.every((part) => stats[part].status === 'complete') && sum !== stats[total].value))
  )
    throw new Error('Final diff ' + total + ' does not reconcile');
}
export function validateContributionActivity(source: ContributionSource): void {
  const accounts = new Set(source.accounts.map((row) => row.id));
  const records = new Map(source.records.map((row) => [row.id, row]));
  const repos = new Map(source.repositories.map((row) => [row.id, row]));
  const comments = new Set<string>(),
    volumes = new Set<string>();
  for (const record of source.records)
    if (record.kind === 'pr' && record.mergedDiff) {
      if (record.state !== 'Merged')
        throw new Error('Unmerged PR cannot have final merged diff values');
      reconcile(record.mergedDiff, 'filesChanged', fileStatusStats);
      reconcile(record.mergedDiff, 'linesChanged', ['linesAdded', 'linesRemoved']);
    }
  for (const comment of source.activity.comments) {
    if (comments.has(comment.id)) throw new Error('Duplicate comment identity');
    comments.add(comment.id);
    const record = records.get(comment.recordId);
    if (!record || !accounts.has(comment.accountId)) throw new Error('Unknown comment identity');
    if ((comment.kind === 'issueComments') !== (record.kind === 'issue'))
      throw new Error('Wrong comment record kind');
    if (comment.createdAt < record.createdAt || !inDateRange(comment.createdAt, source.range))
      throw new Error('Comment is outside the record/report range');
    if (source.activity.coverage[comment.kind].status === 'missing')
      throw new Error('Unavailable comment coverage contains known comments');
  }
  for (const volume of source.activity.volumes) {
    const id = JSON.stringify([volume.accountId, volume.recordId, volume.role]);
    if (volumes.has(id)) throw new Error('Duplicate account/PR/volume role');
    volumes.add(id);
    const record = records.get(volume.recordId);
    if (!record || !accounts.has(volume.accountId)) throw new Error('Unknown volume identity');
    if (
      record.kind !== 'pr' ||
      record.state !== 'Merged' ||
      !record.mergedAt ||
      !inDateRange(record.mergedAt, source.range) ||
      record.baseBranch !== repos.get(record.repositoryId)!.primaryBranch
    )
      throw new Error('Volume requires a primary-branch PR merged in the period');
    if (volume.qualifiedAt < record.createdAt || volume.qualifiedAt > record.mergedAt)
      throw new Error('Volume participation must precede the merge');
    if (
      volume.role === 'authored'
        ? volume.accountId !== record.authorId || volume.qualifiedAt !== record.createdAt
        : volume.accountId === record.authorId
    )
      throw new Error('Wrong volume role actor');
    const knownCredit = source.credits.find(
      (credit) =>
        credit.recordId === volume.recordId &&
        credit.accountId === volume.accountId &&
        credit.metric ===
          (volume.role === 'reviewed'
            ? 'reviewerContributions'
            : volume.role === 'approved'
              ? 'approvalContributions'
              : 'prsAuthored'),
    );
    if (knownCredit && volume.qualifiedAt < knownCredit.creditedAt)
      throw new Error('Volume evidence predates the established first credit');
    for (const stat of changeStatIds)
      if (
        source.activity.coverage[volumeMetricId(volume.role, stat)].status === 'missing' &&
        record.mergedDiff?.[stat].value !== null &&
        record.mergedDiff?.[stat].value !== undefined
      )
        throw new Error('Unavailable volume coverage contains known values');
  }
  for (const record of source.records) {
    if (
      record.kind !== 'pr' ||
      record.state !== 'Merged' ||
      !record.mergedAt ||
      !inDateRange(record.mergedAt, source.range) ||
      record.baseBranch !== repos.get(record.repositoryId)!.primaryBranch
    )
      continue;
    const expected = [
      ...(record.authorId ? [{ accountId: record.authorId, role: 'authored' as const }] : []),
      ...source.credits
        .filter(
          (credit) =>
            credit.recordId === record.id &&
            credit.creditedAt <= record.mergedAt! &&
            ['reviewerContributions', 'approvalContributions'].includes(credit.metric),
        )
        .map((credit) => ({
          accountId: credit.accountId,
          role:
            credit.metric === 'reviewerContributions'
              ? ('reviewed' as const)
              : ('approved' as const),
          at: credit.creditedAt,
        })),
    ];
    for (const item of expected) {
      const assignment = source.activity.volumes.find(
        (volume) =>
          volume.recordId === record.id &&
          volume.accountId === item.accountId &&
          volume.role === item.role,
      );
      if (
        !assignment &&
        changeStatIds.some(
          (stat) => source.activity.coverage[volumeMetricId(item.role, stat)].status === 'complete',
        )
      )
        throw new Error('Complete volume coverage omitted a known eligible role');
    }
  }
}
export function sumContributionCounts(counts: Count[]): Count {
  if (!counts.length) return { status: 'complete', value: 0 };
  const reasons = [
    ...new Set(counts.flatMap((count) => (count.status === 'complete' ? [] : [count.reason]))),
  ];
  const available = counts.filter((count) => count.value !== null);
  if (!available.length)
    return {
      status: counts.every((count) => count.status === 'not-applicable')
        ? 'not-applicable'
        : 'missing',
      value: null,
      reason: reasons.join('; '),
    };
  const value = available.reduce((sum, count) => sum + count.value, 0);
  if (!Number.isSafeInteger(value))
    throw new Error('Aggregated contribution volume exceeds the safe count range');
  return reasons.length
    ? { status: 'partial', value, reason: reasons.join('; ') }
    : { status: 'complete', value };
}
/** Aggregate prepared comment identities and final-diff assignments; never reconstruct GitHub history here. */
export function contributionActivitySelector(source: ContributionSource) {
  const records = new Map(source.records.map((row) => [row.id, row]));
  const cells = new Map<string, Count[]>();
  function add(accountId: string, repositoryId: string, metric: AdditionalMetric, count: Count) {
    const id = key(accountId, repositoryId, metric);
    const values = cells.get(id) ?? [];
    values.push(count);
    cells.set(id, values);
  }
  for (const comment of source.activity.comments)
    add(comment.accountId, records.get(comment.recordId)!.repositoryId, comment.kind, {
      status: 'complete',
      value: 1,
    });
  for (const volume of source.activity.volumes) {
    const record = records.get(volume.recordId)!;
    if (record.kind !== 'pr') throw new Error('Expected PR volume');
    for (const stat of changeStatIds)
      add(
        volume.accountId,
        record.repositoryId,
        volumeMetricId(volume.role, stat),
        record.mergedDiff?.[stat] ?? {
          status: 'missing',
          value: null,
          reason: 'Final merged diff values are unavailable.',
        },
      );
  }
  return (
    accounts: ContributionAccount[],
    repositories: ContributionRepository[],
  ): AdditionalValues =>
    Object.fromEntries(
      additionalMetricIds.map((metric) => {
        const counts: Count[] = [];
        for (const account of accounts)
          for (const repository of repositories) {
            const coverage = source.activity.coverage[metric];
            const count = sumContributionCounts(
              cells.get(key(account.id, repository.id, metric)) ?? [],
            );
            counts.push(
              coverage.status === 'missing'
                ? { status: 'missing', value: null, reason: coverage.reason }
                : coverage.status === 'partial' && count.value !== null
                  ? {
                      status: 'partial',
                      value: count.value,
                      reason: [
                        coverage.reason,
                        ...(count.status === 'complete' ? [] : [count.reason]),
                      ].join('; '),
                    }
                  : count,
            );
          }
        return [metric, sumContributionCounts(counts)];
      }),
    ) as AdditionalValues;
}
export function hasAdditionalActivity(values: AdditionalValues): boolean {
  return additionalMetricIds.some(
    (metric) =>
      (values[metric].value ?? 0) > 0 || ['partial', 'missing'].includes(values[metric].status),
  );
}
