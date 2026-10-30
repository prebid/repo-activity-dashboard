import {
  additionalMetricIds,
  changeStatIds,
  type ChangeStats,
} from '@/models/contribution-activity';
import type {
  ContributionAccount,
  ContributionCredit,
  ContributionRecord,
  ContributionSource,
} from '@/models/contributions';
import { inDateRange } from '@/lib/presentation/reporting-period';
import type { DateRange } from '@/models/reporting-period';
import type { ContributionSampleScenario as ContributionScenario } from '@/models/contribution-page';
const instant = (day: string) => day + 'T12:00:00.000Z';
// Hand-authored complete file classifications and line totals for the reference merged PRs.
const referenceStats: Record<number, number[]> = {
  101: [10, 2, 1, 4, 1, 1, 1, 160, 120, 40],
  102: [6, 1, 1, 2, 1, 1, 0, 120, 90, 30],
  103: [3, 0, 0, 3, 0, 0, 0, 40, 30, 10],
  106: [7, 2, 1, 3, 0, 0, 1, 260, 200, 60],
  108: [1, 1, 0, 0, 0, 0, 0, 20, 20, 0],
};
function stats(values: number[]): ChangeStats {
  return Object.fromEntries(
    changeStatIds.map((stat, index) => [stat, { status: 'complete', value: values[index] }]),
  ) as ChangeStats;
}
export function contributionActivitySample(
  data: {
    accounts: ContributionAccount[];
    records: ContributionRecord[];
    credits: ContributionCredit[];
  },
  range: DateRange,
  scenario: ContributionScenario,
  unavailable: boolean,
): ContributionSource['activity'] {
  const comments: ContributionSource['activity']['comments'] = [],
    volumes: ContributionSource['activity']['volumes'] = [];
  for (const record of data.records)
    if (record.kind === 'pr' && record.state === 'Merged') {
      record.mergedDiff = stats(
        scenario === 'large' ? [4, 1, 0, 2, 1, 0, 0, 30, 20, 10] : referenceStats[record.number],
      );
      if (scenario === 'partial' && record.number === 101)
        record.mergedDiff.filesModified = {
          status: 'missing',
          value: null,
          reason: 'The complete file-status breakdown is unavailable in this sample.',
        };
      volumes.push({
        accountId: record.authorId!,
        recordId: record.id,
        role: 'authored',
        qualifiedAt: record.createdAt,
      });
      for (const credit of data.credits)
        if (
          credit.recordId === record.id &&
          credit.creditedAt <= record.mergedAt! &&
          ['reviewerContributions', 'approvalContributions'].includes(credit.metric)
        )
          volumes.push({
            accountId: credit.accountId,
            recordId: record.id,
            role: credit.metric === 'reviewerContributions' ? 'reviewed' : 'approved',
            qualifiedAt: credit.creditedAt,
          });
    }
  if (scenario === 'large')
    for (const record of data.records)
      comments.push({
        id: 'comment-' + record.id,
        accountId: record.authorId!,
        recordId: record.id,
        kind: record.kind === 'issue' ? 'issueComments' : 'prComments',
        createdAt: instant('2026-10-03'),
      });
  else
    for (const [number, account, kind, date] of [
      [101, 'bob', 'prComments', '2026-08-06'],
      [101, 'bob', 'inlineComments', '2026-09-01'],
      [101, 'alice', 'prComments', '2026-10-01'],
      [102, 'alice', 'prComments', '2026-09-02'],
      [102, 'bob', 'inlineComments', '2026-09-04'],
      [104, 'alice', 'prComments', '2026-10-11'],
      [105, 'carol', 'prComments', '2026-10-12'],
      [105, 'agent', 'inlineComments', '2026-10-13'],
      [105, 'bot', 'prComments', '2026-10-15'],
      [105, 'bob', 'prComments', '2026-10-16'],
      [106, 'agent', 'inlineComments', '2026-10-17'],
      [106, 'bot', 'prComments', '2026-10-19'],
      [107, 'alice', 'inlineComments', '2026-10-19'],
      [201, 'finn', 'issueComments', '2026-10-11'],
      [203, 'bob', 'issueComments', '2026-10-12'],
      [204, 'carol', 'issueComments', '2026-10-13'],
    ] as const) {
      const record = data.records.find((row) => row.number === number)!;
      comments.push({
        id: `comment-${number}-${account}-${date}`,
        accountId: 'account-' + account,
        recordId: record.id,
        kind,
        createdAt: instant(date),
      });
    }
  const omit = unavailable || scenario === 'empty';
  return {
    coverage: Object.fromEntries(
      additionalMetricIds.map((metric) => [
        metric,
        unavailable
          ? { status: 'missing', reason: 'No prepared activity sample for this range.' }
          : { status: 'complete' },
      ]),
    ) as ContributionSource['activity']['coverage'],
    comments: omit ? [] : comments.filter((row) => inDateRange(row.createdAt, range)),
    volumes: omit
      ? []
      : volumes.filter((row) => {
          const record = data.records.find((record) => record.id === row.recordId)!;
          return record.kind === 'pr' && inDateRange(record.mergedAt!, range);
        }),
  };
}
