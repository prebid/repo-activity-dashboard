import type { ContributionSource } from '@/models/contributions';
import {
  additionalMetricIds,
  changeStatIds,
  fileStatusStats,
  volumeMetricId,
  type AdditionalValues,
  type ChangeStats,
} from '@/models/contribution-activity';
import type { Count } from '@/models/reporting-measurement';
import { inDateRange } from './reporting-period';
import { contributionCreditKey } from './contribution-identity';

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
  const creditByIdentity = new Map(
    source.credits.map((credit) => [contributionCreditKey(credit), credit]),
  );
  const creditsByRecord = new Map<string, typeof source.credits>();
  for (const credit of source.credits) {
    const group = creditsByRecord.get(credit.recordId) ?? [];
    group.push(credit);
    creditsByRecord.set(credit.recordId, group);
  }
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
    const knownCredit = creditByIdentity.get(
      contributionCreditKey({
        recordId: volume.recordId,
        accountId: volume.accountId,
        creditedAt: volume.qualifiedAt,
        metric:
          volume.role === 'reviewed'
            ? 'reviewerContributions'
            : volume.role === 'approved'
              ? 'approvalContributions'
              : 'prsAuthored',
      }),
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
      ...(creditsByRecord.get(record.id) ?? [])
        .filter(
          (credit) =>
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
      const assignment = volumes.has(JSON.stringify([item.accountId, record.id, item.role]));
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
export function hasAdditionalActivity(values: AdditionalValues): boolean {
  return additionalMetricIds.some(
    (metric) =>
      (values[metric].value ?? 0) > 0 || ['partial', 'missing'].includes(values[metric].status),
  );
}
