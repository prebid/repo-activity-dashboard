import { z } from 'zod';
import {
  changeStatsSchema,
  contributionActivitySchema,
  type AdditionalValues,
} from './contribution-activity';
import { reportingCoverageSchema as contributionCoverageSchema } from './reporting-measurement';
import { githubProfileUrlSchema } from './github-profile';
import {
  dateRangeSchema,
  periodSelectionSchema,
  utcInstantSchema,
  type PeriodSelection,
} from './reporting-period';
import { githubLoginSchema } from './github-account';
import { reportingBranchSchema } from './repository-overview';
import type { Count } from './reporting-measurement';

export const contributionMetricIds = [
  'prsAuthored',
  'authoredPrsMerged',
  'reviewerContributions',
  'approvalContributions',
  'mergesPerformed',
  'issuesAuthored',
] as const;
export type ContributionMetric = (typeof contributionMetricIds)[number];
export const contributionMetrics = {
  prsAuthored: { label: 'PRs authored', recordKind: 'pr', role: 'author', dateBasis: 'createdAt' },
  authoredPrsMerged: {
    label: 'Authored PRs merged',
    recordKind: 'pr',
    role: 'author',
    dateBasis: 'mergedAt',
  },
  reviewerContributions: {
    label: 'Reviewer contributions',
    recordKind: 'pr',
    role: 'reviewer',
    dateBasis: 'firstReviewerAt',
  },
  approvalContributions: {
    label: 'Approval contributions',
    recordKind: 'pr',
    role: 'approver',
    dateBasis: 'firstApprovalAt',
  },
  mergesPerformed: {
    label: 'Merges performed',
    recordKind: 'pr',
    role: 'merger',
    dateBasis: 'mergedAt',
  },
  issuesAuthored: {
    label: 'Issues authored',
    recordKind: 'issue',
    role: 'author',
    dateBasis: 'createdAt',
  },
} as const satisfies Record<
  ContributionMetric,
  {
    label: string;
    recordKind: 'pr' | 'issue';
    role: 'author' | 'reviewer' | 'approver' | 'merger';
    dateBasis: 'createdAt' | 'mergedAt' | 'firstReviewerAt' | 'firstApprovalAt';
  }
>;
export const contributionActorTypes = ['human', 'agent', 'bot', 'unknown'] as const;
export const contributionDefaultPeriod = {
  kind: 'preset',
  preset: 'this-year',
} as const satisfies PeriodSelection;
export const contributionDefaultSort = { sort: 'authoredPrsMerged', descending: true } as const;
const identity = z.string().trim().min(1).max(200);
const recordHosts = { sample: 'github.example', database: 'github.com' } as const;
/** How company totals attribute accounts: the current mapping, or none while it is not connected. */
export const companyAttributions = ['current-mapping', 'not-connected'] as const;
export type CompanyAttribution = (typeof companyAttributions)[number];
export const companyAttributionLabels = {
  'current-mapping': 'Company attribution: current mapping',
  'not-connected': 'Company attribution: not connected',
} as const satisfies Record<CompanyAttribution, string>;
export const contributionAccountSchema = z
  .object({
    id: identity,
    login: githubLoginSchema,
    profileUrl: githubProfileUrlSchema.optional(),
    name: z.string().trim().min(1).max(200),
    actorType: z.enum(contributionActorTypes),
    companyId: identity.nullable(),
  })
  .strict();
export const contributionCompanySchema = z
  .object({ id: identity, name: z.string().trim().min(1).max(200) })
  .strict();
export const contributionRepositorySchema = z
  .object({
    id: identity,
    slug: identity,
    name: identity,
    primaryBranch: reportingBranchSchema,
  })
  .strict();
const recordFields = {
  id: identity,
  repositoryId: identity,
  number: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  title: z.string().trim().min(1).max(500),
  // Sample records are invented and never link to real GitHub records; database records link to
  // GitHub. The source schema checks each record's host against its source.
  url: z.url().refine((value) => {
    try {
      const url = new URL(value);
      return (
        url.protocol === 'https:' &&
        Object.values<string>(recordHosts).includes(url.hostname) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }, 'Expected a GitHub record URL'),
  authorId: identity.nullable(),
  createdAt: utcInstantSchema,
};
export const contributionRecordSchema = z.discriminatedUnion('kind', [
  z
    .object({
      ...recordFields,
      kind: z.literal('pr'),
      state: z.enum(['Open', 'Merged', 'Closed']),
      draft: z.boolean(),
      baseBranch: identity,
      mergedAt: utcInstantSchema.nullable(),
      mergerId: identity.nullable(),
      mergedDiff: changeStatsSchema.optional(),
    })
    .strict(),
  z
    .object({ ...recordFields, kind: z.literal('issue'), state: z.enum(['Open', 'Closed']) })
    .strict(),
]);
export const contributionCreditSchema = z
  .object({
    accountId: identity,
    recordId: identity,
    metric: z.enum(contributionMetricIds),
    creditedAt: utcInstantSchema,
  })
  .strict();
/** A complete supplied display scenario, not GitHub events or a future database paging API. */
export const contributionSourceSchema = z
  .object({
    source: z.enum(['sample', 'database']),
    scenarioId: identity,
    asOf: utcInstantSchema,
    period: periodSelectionSchema,
    range: dateRangeSchema,
    companyAttribution: z.enum(companyAttributions),
    accounts: z.array(contributionAccountSchema),
    companies: z.array(contributionCompanySchema),
    repositories: z.array(contributionRepositorySchema),
    records: z.array(contributionRecordSchema),
    // Each credit is already attributed once and has its established credit date. No review-event parsing.
    credits: z.array(contributionCreditSchema),
    activity: contributionActivitySchema,
    // Explicit coverage for the supplied account/repository population; exceptions override exact cells.
    coverage: z.record(z.enum(contributionMetricIds), contributionCoverageSchema),
    coverageOverrides: z.array(
      z
        .object({
          accountId: identity,
          repositoryId: identity,
          metric: z.enum(contributionMetricIds),
          coverage: contributionCoverageSchema,
        })
        .strict(),
    ),
  })
  .strict()
  .refine(
    (source) =>
      source.records.every((record) => new URL(record.url).hostname === recordHosts[source.source]),
    'Record links must match their data source.',
  );
export type ContributionSource = z.infer<typeof contributionSourceSchema>;
export type ContributionAccount = z.infer<typeof contributionAccountSchema>;
export type ContributionCompany = z.infer<typeof contributionCompanySchema>;
export type ContributionRepository = z.infer<typeof contributionRepositorySchema>;
export type ContributionRecord = z.infer<typeof contributionRecordSchema>;
export type ContributionCredit = z.infer<typeof contributionCreditSchema>;
export type ContributionCoverage = z.infer<typeof contributionCoverageSchema>;
export type ContributionCount = Exclude<Count, { status: 'not-applicable' }>;
export type ContributionValues = Record<ContributionMetric, ContributionCount>;

export const contributionSelectionSchema = z
  .object({
    repositoryIds: z.array(identity),
    actorTypes: z.array(z.enum(contributionActorTypes)),
    population: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('all') }).strict(),
      z
        .object({
          kind: z.literal('selected'),
          accountIds: z.array(identity),
          companyIds: z.array(identity.nullable()),
        })
        .strict(),
    ]),
    excludedAccountIds: z.array(identity),
  })
  .strict();
export type ContributionSelection = z.infer<typeof contributionSelectionSchema>;
export const contributionFocusSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('overview') }).strict(),
  z.object({ kind: z.literal('contributor'), accountId: identity }).strict(),
  z.object({ kind: z.literal('company'), companyId: identity.nullable() }).strict(),
]);
export type ContributionFocus = z.infer<typeof contributionFocusSchema>;
export interface ContributorMetricRow {
  id: string;
  account: ContributionAccount;
  company: ContributionCompany | null;
  metrics: ContributionValues;
  additionalMetrics: AdditionalValues;
}
export interface CompanyMetricRow {
  id: string;
  company: ContributionCompany | null;
  memberCount: number;
  metrics: ContributionValues;
  additionalMetrics: AdditionalValues;
}
export interface RepositoryContributionRow {
  id: string;
  repository: ContributionRepository;
  metrics: ContributionValues;
  additionalMetrics: AdditionalValues;
}
export interface ContributionContext {
  source: 'sample' | 'database';
  scenarioId: string;
  asOf: string;
  period: PeriodSelection;
  range: ContributionSource['range'];
  companyAttribution: CompanyAttribution;
  selection: ContributionSelection;
  focus: ContributionFocus;
  includedAccountCount: number;
}
export type ContributionTable =
  | { kind: 'contributors'; rows: ContributorMetricRow[] }
  | { kind: 'members'; rows: ContributorMetricRow[] }
  | { kind: 'companies'; rows: CompanyMetricRow[] }
  | { kind: 'repositories'; rows: RepositoryContributionRow[] };
interface ContributionReportBase {
  context: ContributionContext;
  totals: ContributionValues;
  additionalTotals: AdditionalValues;
}
/**
 * A Reviewers-lens overview's population: the accounts with reviewer evidence, or every account
 * with activity when `showingAll`. The `all` counts name the "Show all" population.
 */
export interface ContributionPopulation {
  role: 'reviewer';
  showingAll: boolean;
  allContributorCount: number;
  allCompanyCount: number;
}
export type ContributionReport = ContributionReportBase &
  (
    | {
        kind: 'overview';
        contributorCount: number;
        companyCount: number;
        table: Extract<ContributionTable, { kind: 'contributors' | 'companies' }> | null;
        /** Present only in the Reviewers lens. */
        population?: ContributionPopulation;
      }
    | {
        kind: 'contributor';
        account: ContributionAccount;
        company: ContributionCompany | null;
        table: Extract<ContributionTable, { kind: 'repositories' }> | null;
      }
    | {
        kind: 'company';
        company: ContributionCompany | null;
        memberCount: number;
        table: Extract<ContributionTable, { kind: 'members' | 'repositories' }> | null;
      }
  );
