import type { RepositoryDrilldown } from '@/models/repository-drilldown';
import type { OverviewRepository } from '@/models/repository-overview';
import type { Count } from '@/models/reporting-measurement';
import type {
  InsightSelection,
  RepositoryInsight,
  RepositoryAuthor,
  AuthorSelection,
  SupportingRecord,
} from '@/models/repository-insights';
import type {
  RepositoryPullRequest,
  RepositoryIssue,
  RepositoryRecordList,
} from '@/models/repository-records';
import { repositoryRecordSample } from './repository-records';
import { sampleAuthorType, sampleProfileUrl } from './repository-accounts';
import { preparedPeriodSample } from './overview-period-sample';
import { overviewAsOf } from './repository-overview';

const creditedAccounts = {
  agent: ['sample-prebid-agent-a', 'sample-prebid-agent-b'],
  bot: ['sample-bot-a', 'sample-bot-b'],
};
function reference(row: RepositoryPullRequest | RepositoryIssue): SupportingRecord {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    url: row.url,
    state: row.state,
    ...('draft' in row ? { draft: row.draft } : {}),
  };
}
export function repositoryInsightSample(
  repo: OverviewRepository,
  drilldown: RepositoryDrilldown & { selection: InsightSelection },
): RepositoryInsight {
  const { selection, returnTo } = drilldown;
  const prepared = preparedPeriodSample(repo.id, selection.range)?.activity;
  const context = {
    repository: { ...repo },
    asOf: overviewAsOf,
    drilldown: structuredClone(drilldown),
  };
  if (selection.metric === 'medianMergeDays') {
    const records = repositoryRecordSample(repo, {
      selection: { ...selection, metric: 'prsMerged' },
      returnTo,
    });
    if (records.kind !== 'prs') throw new Error('Expected merged PR sample');
    return {
      ...context,
      kind: 'duration',
      measurement: { ...records.measurement },
      days: prepared
        ? { ...prepared.mergeDuration.days }
        : {
            status: 'missing',
            value: null,
            reason: 'No prepared merge-duration sample for this date range.',
          },
      records,
    };
  }
  const measurement: Count = prepared
    ? { ...prepared.counts[selection.metric] }
    : { status: 'missing', value: null, reason: 'No prepared sample for this date range.' };
  if (selection.metric === 'prAuthors' || selection.metric === 'issueAuthors') {
    const isPr = selection.metric === 'prAuthors';
    const source = repositoryRecordSample(repo, {
      selection: { ...selection, metric: isPr ? 'prsOpened' : 'issuesOpened' },
      returnTo,
    });
    const authors = new Map<string, RepositoryAuthor>();
    if (measurement.value !== null)
      for (const row of source.rows) {
        const author = authors.get(row.author) ?? {
          id: repo.id + ':' + row.author,
          account: row.author,
          profileUrl: sampleProfileUrl(row.author),
          accountType: sampleAuthorType(row.author),
          recordCount: 0,
        };
        author.recordCount += 1;
        authors.set(row.author, author);
      }
    return {
      ...context,
      kind: 'authors',
      measurement,
      recordKind: isPr ? 'prs' : 'issues',
      rows: [...authors.values()].sort(
        (a, b) => b.recordCount - a.recordCount || a.account.localeCompare(b.account, 'en'),
      ),
    };
  }
  const rows: Extract<RepositoryInsight, { kind: 'contributions' }>['rows'] = [];
  if (measurement.value) {
    const opened = repositoryRecordSample(repo, {
      selection: { scope: 'period', metric: 'prsOpened', range: selection.range },
      returnTo,
    });
    const merged = repositoryRecordSample(repo, {
      selection: {
        scope: 'period',
        metric: 'prsMerged',
        range: selection.range,
        branch: repo.primaryBranch,
      },
      returnTo,
    });
    if (opened.kind !== 'prs' || merged.kind !== 'prs') throw new Error('Expected PR samples');
    // Include older PRs: first-credit activity is not restricted to PRs created in this period.
    const pool = [
      ...merged.rows.filter((row) => row.createdAt < selection.range.start),
      ...opened.rows,
    ];
    const accountType = selection.metric.startsWith('agent') ? 'agent' : 'bot';
    const contribution = selection.metric.endsWith('ApprovalCredits') ? 'approval' : 'reviewer';
    const start = Date.parse(selection.range.start),
      end = Date.parse(selection.range.end) - Number(!selection.range.endInclusive);
    if (Math.ceil(measurement.value / 2) > pool.length)
      throw new Error('Insufficient prepared PRs for contribution sample');
    for (let index = 0; index < measurement.value; index++) {
      const pr = pool[Math.floor(index / 2)],
        account = creditedAccounts[accountType][index % 2];
      const first = Math.max(start, Date.parse(pr.createdAt)),
        last = Math.min(end, pr.mergedAt ? Date.parse(pr.mergedAt) : end);
      const firstCreditAt = new Date(
        first + Math.floor((last - first) * (((index % 2) + 1) / 3)),
      ).toISOString();
      rows.push({
        id: repo.id + ':' + account + ':' + pr.id + ':' + contribution,
        account,
        profileUrl: sampleProfileUrl(account),
        accountType,
        contribution,
        firstCreditAt,
        pr: reference(pr),
      });
    }
  }
  return {
    ...context,
    kind: 'contributions',
    measurement,
    rows: rows.sort(
      (a, b) => b.firstCreditAt.localeCompare(a.firstCreditAt) || a.id.localeCompare(b.id, 'en'),
    ),
  };
}

/** Expand records only after selecting an author; the overview carries counts, not record arrays. */
export function repositoryAuthorRecordSample(
  repo: OverviewRepository,
  drilldown: RepositoryDrilldown & { selection: AuthorSelection },
  account: string,
  returnToAuthors: string,
): RepositoryRecordList {
  const source = repositoryRecordSample(repo, {
    selection: {
      scope: 'period',
      metric: drilldown.selection.metric === 'prAuthors' ? 'prsOpened' : 'issuesOpened',
      range: drilldown.selection.range,
    },
    returnTo: drilldown.returnTo,
  });
  const author = { account, returnTo: returnToAuthors };
  const measurement = (count: number) =>
    source.measurement.value === null
      ? { ...source.measurement }
      : { ...source.measurement, value: count };
  if (source.kind === 'prs') {
    const rows = source.rows.filter((row) => row.author.toLowerCase() === account);
    return { ...source, rows, measurement: measurement(rows.length), author };
  }
  const rows = source.rows.filter((row) => row.author.toLowerCase() === account);
  return { ...source, rows, measurement: measurement(rows.length), author };
}
