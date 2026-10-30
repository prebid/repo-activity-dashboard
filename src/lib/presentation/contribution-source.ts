import { normalizeGithubLogin } from '@/models/github-account';
import {
  contributionDirectorySchema,
  type ContributionDirectory,
} from '@/models/contribution-settings';
import { validateContributionActivity } from './contribution-activity';
import {
  contributionSourceSchema,
  contributionMetrics,
  type ContributionSource,
} from '@/models/contributions';
import { inDateRange, resolveReportingPeriod } from './reporting-period';

import { contributionCellKey, contributionCreditKey } from './contribution-identity';

function unique(values: string[], label: string) {
  if (new Set(values).size !== values.length) throw new Error('Duplicate ' + label);
}
const validated = new WeakSet<object>();
function freezeSnapshot(value: object): void {
  const children: unknown[] = Object.values(value);
  for (const child of children) if (child && typeof child === 'object') freezeSnapshot(child);
  Object.freeze(value);
}
function directoryIdentity(directory: ContributionDirectory) {
  for (const [label, values] of [
    ['account identities', directory.accounts.map((row) => row.id)],
    ['account logins', directory.accounts.map((row) => normalizeGithubLogin(row.login))],
    ['company identities', directory.companies.map((row) => row.id)],
    ['repository identities', directory.repositories.map((row) => row.id)],
    ['repository slugs', directory.repositories.map((row) => row.slug)],
  ] as const)
    unique(values, label);
  const accounts = new Set(directory.accounts.map((row) => row.id));
  const companies = new Set(directory.companies.map((row) => row.id));
  const repositories = new Map(directory.repositories.map((row) => [row.id, row]));
  for (const account of directory.accounts)
    if (account.companyId !== null && !companies.has(account.companyId))
      throw Error('Unknown account company');
  return { accounts, repositories };
}
export function validateContributionDirectory(input: unknown): ContributionDirectory {
  const directory = contributionDirectorySchema.parse(input);
  directoryIdentity(directory);
  freezeSnapshot(directory);
  return directory;
}
/** Validate prepared display facts, not the GitHub history that would establish them. */
export function validateContributionSource(input: unknown): ContributionSource {
  if (input && typeof input === 'object' && validated.has(input))
    return input as ContributionSource;
  const source = contributionSourceSchema.parse(input);
  const { accounts, repositories } = directoryIdentity(source);
  if (
    JSON.stringify(source.range) !==
    JSON.stringify(resolveReportingPeriod(source.period, source.asOf).range)
  )
    throw new Error('Contribution range does not match its period and snapshot');
  for (const [label, values] of [
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
  const records = new Map(source.records.map((row) => [row.id, row]));
  const coverage = new Map(
    source.coverageOverrides.map((row) => [
      contributionCellKey(row.accountId, row.repositoryId, row.metric),
      row.coverage,
    ]),
  );
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
  freezeSnapshot(source);
  validated.add(source);
  return source;
}
