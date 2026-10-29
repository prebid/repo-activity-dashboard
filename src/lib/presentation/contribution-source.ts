import { validateContributionActivity } from './contribution-activity';
import {
  contributionSourceSchema,
  contributionMetrics,
  type ContributionSource,
} from '@/models/contributions';
import { inDateRange, resolveReportingPeriod } from './reporting-period';

export { contributionCellKey, contributionCreditKey } from './contribution-identity';
import { contributionCellKey, contributionCreditKey } from './contribution-identity';

function unique(values: string[], label: string) {
  if (new Set(values).size !== values.length) throw new Error('Duplicate ' + label);
}
/** Validate prepared display facts, not the GitHub history that would establish them. */
export function validateContributionSource(input: unknown): ContributionSource {
  const source = contributionSourceSchema.parse(input);
  if (
    JSON.stringify(source.range) !==
    JSON.stringify(resolveReportingPeriod(source.period, source.asOf).range)
  )
    throw new Error('Contribution range does not match its period and snapshot');
  for (const [label, values] of [
    ['account identities', source.accounts.map((row) => row.id)],
    ['account logins', source.accounts.map((row) => row.login)],
    ['company identities', source.companies.map((row) => row.id)],
    ['repository identities', source.repositories.map((row) => row.id)],
    ['repository slugs', source.repositories.map((row) => row.slug)],
    ['record identities', source.records.map((row) => row.id)],
    [
      'repository record numbers',
      source.records.map((row) => JSON.stringify([row.repositoryId, row.number])),
    ],
    ['contribution credits', source.credits.map(contributionCreditKey)],
    [
      'coverage cells',
      source.coverageOverrides.map((row) =>
        contributionCellKey(row.accountId, row.repositoryId, row.metric),
      ),
    ],
  ] as const)
    unique(values, label);
  const accounts = new Set(source.accounts.map((row) => row.id));
  const companies = new Set(source.companies.map((row) => row.id));
  const repositories = new Map(source.repositories.map((row) => [row.id, row]));
  const records = new Map(source.records.map((row) => [row.id, row]));
  const coverage = new Map(
    source.coverageOverrides.map((row) => [
      contributionCellKey(row.accountId, row.repositoryId, row.metric),
      row.coverage,
    ]),
  );
  for (const account of source.accounts)
    if (account.companyId !== null && !companies.has(account.companyId))
      throw new Error('Unknown account company');
  for (const row of source.coverageOverrides)
    if (!accounts.has(row.accountId) || !repositories.has(row.repositoryId))
      throw new Error('Unknown coverage identity');
  for (const record of source.records) {
    if (
      !repositories.has(record.repositoryId) ||
      (record.authorId !== null && !accounts.has(record.authorId))
    )
      throw new Error('Unknown record identity');
    if (record.createdAt > source.asOf) throw new Error('Record is newer than the snapshot');
    if (record.kind === 'pr') {
      if (record.mergerId !== null && !accounts.has(record.mergerId))
        throw new Error('Unknown merger');
      if (record.state === 'Merged') {
        if (
          record.draft ||
          !record.mergedAt ||
          record.mergedAt < record.createdAt ||
          record.mergedAt > source.asOf
        )
          throw new Error('Invalid merged PR metadata');
      } else if (record.mergedAt !== null || record.mergerId !== null)
        throw new Error('Unmerged PR has merge metadata');
    }
  }
  for (const credit of source.credits) {
    const record = records.get(credit.recordId);
    if (!record || !accounts.has(credit.accountId)) throw new Error('Unknown credit identity');
    const definition = contributionMetrics[credit.metric];
    if (record.kind !== definition.recordKind) throw new Error('Wrong contribution record kind');
    if (!inDateRange(credit.creditedAt, source.range) || credit.creditedAt < record.createdAt)
      throw new Error('Credit date is outside the record/report range');
    if (definition.role === 'author' && record.authorId !== credit.accountId)
      throw new Error('Authorship credit has the wrong actor');
    if (definition.role === 'reviewer' && record.authorId === credit.accountId)
      throw new Error('Author responses are not reviewer credits');
    if (definition.dateBasis === 'createdAt' && credit.creditedAt !== record.createdAt)
      throw new Error('Authorship credit has the wrong date');
    if (definition.dateBasis === 'mergedAt') {
      if (
        record.kind !== 'pr' ||
        record.state !== 'Merged' ||
        credit.creditedAt !== record.mergedAt ||
        record.baseBranch !== repositories.get(record.repositoryId)!.primaryBranch
      )
        throw new Error('Merge credit requires the primary-branch merge date');
      if (definition.role === 'merger' && record.mergerId !== credit.accountId)
        throw new Error('Merge execution credit has the wrong actor');
    }
    const cell =
      coverage.get(contributionCellKey(credit.accountId, record.repositoryId, credit.metric)) ??
      source.coverage[credit.metric];
    if (cell.status === 'missing')
      throw new Error('Unavailable coverage cannot contain known credits');
  }
  validateContributionActivity(source);
  return source;
}
