import { contributionActivitySample } from './contribution-activity';
import {
  contributionSampleScenarios,
  type ContributionSampleScenario,
} from '@/models/contribution-page';
import { sampleProfileUrl } from './repository-accounts';
import { repositoryCatalog } from '@/config/repositories';
import { reportingBranchSchema } from '@/models/repository-overview';
import {
  contributionDefaultPeriod,
  contributionMetricIds,
  type ContributionSource,
  type ContributionAccount,
  type ContributionRecord,
  type ContributionCredit,
  type ContributionCoverage,
  type ContributionRepository,
} from '@/models/contributions';
import type { PeriodSelection } from '@/models/reporting-period';
import { resolveReportingPeriod, inDateRange } from '@/lib/presentation/reporting-period';
import {
  validateContributionSource,
  validateContributionDirectory,
} from '@/lib/presentation/contribution-source';
import { overviewAsOf } from './repository-overview';

export const contributionSampleAsOf = overviewAsOf;
export type ContributionScenario = ContributionSampleScenario;
const at = (date: string) => date + 'T12:00:00.000Z';
const companies = [
  { id: 'company-acme', name: 'Example Acme' },
  { id: 'company-beacon', name: 'Example Beacon' },
  { id: 'company-prebid', name: 'Example Prebid' },
];
const repositories: ContributionRepository[] = repositoryCatalog
  .filter((row) => row.enabled)
  .map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.displayName,
    primaryBranch: reportingBranchSchema.parse(row.primaryBranch),
  }));
function account(
  id: string,
  name: string,
  companyId: string | null,
  actorType: ContributionAccount['actorType'] = 'human',
): ContributionAccount {
  const login = 'sample-' + id.replace('account-', '') + (actorType === 'bot' ? '[bot]' : '');
  return { id, name, companyId, actorType, login, profileUrl: sampleProfileUrl(login) };
}
function record(
  repository: ContributionRepository,
  number: number,
  authorId: string,
  date: string,
  kind: 'pr' | 'issue',
  merged?: { date: string; by: string },
  draft = false,
): ContributionRecord {
  const common = {
    id: JSON.stringify(['contribution-sample', repository.id, number]),
    repositoryId: repository.id,
    number,
    authorId,
    createdAt: at(date),
    title: 'Sample ' + (kind === 'pr' ? 'PR' : 'issue') + ' ' + number,
    url:
      'https://github.example/contributions/' +
      repository.slug +
      '/' +
      (kind === 'pr' ? 'pull' : 'issues') +
      '/' +
      number,
  };
  return kind === 'issue'
    ? { ...common, kind, state: 'Open' }
    : {
        ...common,
        kind,
        state: merged ? 'Merged' : 'Open',
        draft,
        baseBranch: repository.primaryBranch,
        mergedAt: merged ? at(merged.date) : null,
        mergerId: merged?.by ?? null,
      };
}
/** These are already-attributed display credits, not raw comment/review events. */
function authorAndMergeCredits(records: ContributionRecord[]): ContributionCredit[] {
  return records.flatMap((row): ContributionCredit[] => {
    const credits: ContributionCredit[] = [
      {
        accountId: row.authorId!,
        recordId: row.id,
        metric: row.kind === 'pr' ? 'prsAuthored' : 'issuesAuthored',
        creditedAt: row.createdAt,
      },
    ];
    if (row.kind === 'pr' && row.state === 'Merged')
      credits.push(
        {
          accountId: row.authorId!,
          recordId: row.id,
          metric: 'authoredPrsMerged',
          creditedAt: row.mergedAt!,
        },
        {
          accountId: row.mergerId!,
          recordId: row.id,
          metric: 'mergesPerformed',
          creditedAt: row.mergedAt!,
        },
      );
    return credits;
  });
}
function referenceAccounts(): ContributionAccount[] {
  return [
    account('account-alice', 'Alice', 'company-acme'),
    account('account-bob', 'Bob', 'company-acme'),
    account('account-carol', 'Carol', 'company-beacon'),
    account('account-drew', 'Drew', null),
    account('account-eve', 'Eve', 'company-acme'),
    account('account-finn', 'Finn', 'company-beacon'),
    account('account-agent', 'Prebid sample agent', 'company-prebid', 'agent'),
    account('account-bot', 'Sample bot', null, 'bot'),
  ];
}
function reference() {
  const accounts = referenceAccounts();
  const [r1, r2] = repositories;
  const records = [
    record(r1, 101, 'account-alice', '2026-08-05', 'pr', {
      date: '2026-10-05',
      by: 'account-carol',
    }),
    record(r1, 102, 'account-carol', '2026-09-01', 'pr', {
      date: '2026-09-06',
      by: 'account-carol',
    }),
    record(r2, 103, 'account-drew', '2026-10-02', 'pr', { date: '2026-10-04', by: 'account-bob' }),
    record(r2, 104, 'account-alice', '2026-10-10', 'pr', undefined, true),
    record(r1, 105, 'account-bob', '2026-10-11', 'pr'),
    record(r2, 106, 'account-carol', '2026-10-16', 'pr', {
      date: '2026-10-20',
      by: 'account-agent',
    }),
    record(r1, 107, 'account-drew', '2026-10-18', 'pr'),
    record(r1, 108, 'account-bob', '2026-10-20', 'pr', { date: '2026-10-21', by: 'account-drew' }),
    record(r1, 201, 'account-drew', '2026-08-08', 'issue'),
    { ...record(r1, 202, 'account-alice', '2026-09-09', 'issue'), state: 'Closed' as const },
    record(r2, 203, 'account-bob', '2026-10-06', 'issue'),
    record(r2, 204, 'account-carol', '2026-10-06', 'issue'),
    record(r2, 205, 'account-agent', '2026-10-09', 'issue'),
    record(r1, 206, 'account-finn', '2026-10-10', 'issue'),
  ];
  const credits = authorAndMergeCredits(records);
  for (const [number, who, metric, date] of [
    [101, 'bob', 'reviewerContributions', '2026-08-06'],
    [101, 'bob', 'approvalContributions', '2026-08-07'],
    [102, 'alice', 'reviewerContributions', '2026-09-02'],
    [102, 'alice', 'approvalContributions', '2026-09-03'],
    [102, 'bob', 'reviewerContributions', '2026-09-04'],
    [102, 'bob', 'approvalContributions', '2026-09-05'],
    [103, 'alice', 'approvalContributions', '2026-10-03'],
    [105, 'carol', 'reviewerContributions', '2026-10-12'],
    [105, 'agent', 'reviewerContributions', '2026-10-13'],
    [105, 'agent', 'approvalContributions', '2026-10-14'],
    [105, 'bot', 'reviewerContributions', '2026-10-15'],
    [106, 'agent', 'reviewerContributions', '2026-10-17'],
    [106, 'agent', 'approvalContributions', '2026-10-18'],
    [106, 'bot', 'reviewerContributions', '2026-10-19'],
    [107, 'alice', 'reviewerContributions', '2026-10-19'],
    [107, 'alice', 'approvalContributions', '2026-10-20'],
  ] as const)
    credits.push({
      accountId: 'account-' + who,
      recordId: records.find((row) => row.number === number)!.id,
      metric,
      creditedAt: at(date),
    });
  return { accounts, records, credits };
}
function largeAccounts(extra = 0): ContributionAccount[] {
  return [
    ...Array.from({ length: 250 }, (_, i) =>
      account(
        'account-person-' + String(i + 1).padStart(3, '0'),
        'Sample contributor ' + (i + 1),
        i < 100 ? 'company-acme' : i < 200 ? 'company-beacon' : null,
      ),
    ),
    account(
      'account-heavy-agent',
      'Sample agent with hundreds of records and a deliberately long display name',
      'company-prebid',
      'agent',
    ),
    ...Array.from({ length: extra }, (_, i) =>
      account(
        'account-inactive-' + String(i + 1).padStart(4, '0'),
        'Sample inactive account ' + (i + 1),
        null,
      ),
    ),
  ];
}
export function contributionDirectorySample(scenario: ContributionScenario = 'reference') {
  if (!contributionSampleScenarios.includes(scenario))
    throw Error('Unknown contribution sample scenario');
  return validateContributionDirectory({
    accounts:
      scenario === 'coverage-gap'
        ? largeAccounts(3000)
        : scenario === 'large'
          ? largeAccounts()
          : referenceAccounts(),
    companies: structuredClone(companies),
    repositories: structuredClone(repositories),
  });
}
function large(extra = 0) {
  const accounts = largeAccounts(extra),
    records: ContributionRecord[] = [];
  for (let index = 1; index <= 250; index++) {
    const id = accounts[index - 1].id;
    records.push(
      record(repositories[(index - 1) % repositories.length], index, id, '2026-10-01', 'pr', {
        date: '2026-10-02',
        by: id,
      }),
    );
  }
  const id = 'account-heavy-agent';
  for (let index = 0; index < 240; index++)
    records.push(record(repositories[0], 1001 + index, id, '2026-10-01', 'pr'));
  for (let index = 0; index < 350; index++)
    records.push(record(repositories[0], 2001 + index, id, '2026-10-01', 'issue'));
  const closed = records.find((row) => row.number === 1001)!;
  closed.state = 'Closed';
  closed.title =
    'Sample: a long PR title with punctuation, “quoted text”, and Unicode — closed without merging';
  const draft = records.find((row) => row.number === 1002)!;
  if (draft.kind === 'pr') draft.draft = true;
  return { accounts, records, credits: authorAndMergeCredits(records) };
}
export function contributionSample({
  scenario = 'reference',
  period = contributionDefaultPeriod,
}: {
  scenario?: ContributionScenario;
  period?: PeriodSelection;
} = {}): ContributionSource {
  if (!contributionSampleScenarios.includes(scenario))
    throw new Error('Unknown contribution sample scenario');
  const data =
    scenario === 'coverage-gap' ? large(3000) : scenario === 'large' ? large() : reference();
  const { range } = resolveReportingPeriod(period, contributionSampleAsOf);
  const unsupported = range.start < '2026-01-01T00:00:00.000Z';
  const unavailable = scenario === 'missing' || unsupported;
  const coverage: ContributionCoverage = unavailable
    ? {
        status: 'missing',
        reason: unsupported
          ? 'This range has no prepared contribution scenario.'
          : 'Contribution samples are unavailable.',
      }
    : { status: 'complete' };
  const unverifiedApprovalRecord =
    scenario === 'partial' ? data.records.find((row) => row.number === 107)!.id : null;
  const credits =
    unavailable || scenario === 'empty'
      ? []
      : data.credits.filter(
          (row) =>
            inDateRange(row.creditedAt, range) &&
            !(
              row.recordId === unverifiedApprovalRecord &&
              row.accountId === 'account-alice' &&
              row.metric === 'approvalContributions'
            ),
        );
  const activity = contributionActivitySample(
    data,
    range,
    scenario === 'coverage-gap' ? 'large' : scenario,
    unavailable || scenario === 'coverage-gap',
  );
  const ids = new Set(
    [...credits, ...activity.comments, ...activity.volumes].map((row) => row.recordId),
  );
  return validateContributionSource({
    source: 'sample',
    scenarioId: 'contributions-' + scenario + '-v2',
    asOf: contributionSampleAsOf,
    companyAttribution: 'current-mapping',
    period,
    range,
    accounts: data.accounts,
    companies: structuredClone(companies),
    repositories: structuredClone(repositories),
    records: data.records.filter((row) => ids.has(row.id)),
    credits,
    activity,
    coverage: Object.fromEntries(
      contributionMetricIds.map((metric) => [
        metric,
        scenario === 'coverage-gap' && !unavailable && metric === 'reviewerContributions'
          ? { status: 'partial', reason: 'Early reviewer history is incomplete.' }
          : coverage,
      ]),
    ),
    coverageOverrides:
      scenario === 'partial' && !unavailable
        ? [
            {
              accountId: 'account-alice',
              repositoryId: repositories[0].id,
              metric: 'approvalContributions',
              coverage: {
                status: 'partial',
                reason:
                  'The first approval date on sample PR 107 is unestablished; its approval is not a confirmed period credit.',
              },
            },
            {
              accountId: 'account-drew',
              repositoryId: repositories[0].id,
              metric: 'reviewerContributions',
              coverage: {
                status: 'missing',
                reason: 'Reviewer history is unavailable for this account/repository.',
              },
            },
          ]
        : [],
  });
}
