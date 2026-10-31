import type { RepositoryDrilldown } from '@/models/repository-drilldown';
import type { OverviewRepository } from '@/models/repository-overview';
import type {
  InsightSelection,
  RepositoryInsight,
  RepositoryAuthor,
  AuthorSelection,
  SupportingRecord,
} from '@/models/repository-insights';
import type { RepositoryRecordList } from '@/models/repository-records';
import { repositoryRecordSample } from './repository-records';
import { sampleAuthorType, sampleProfileUrl } from './repository-accounts';
import { medianMergeDays, periodCount, periodCredits } from './repository-activity';
import { worldRepository, type WorldPullRequest } from './repository-world';
import { overviewAsOf } from './sample-clock';

function reference(row: WorldPullRequest): SupportingRecord {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    url: row.url,
    state: row.state,
    draft: row.draft,
  };
}
export function repositoryInsightSample(
  repo: OverviewRepository,
  drilldown: RepositoryDrilldown & { selection: InsightSelection },
): RepositoryInsight {
  const { selection, returnTo } = drilldown;
  const world = worldRepository(repo.id);
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
    const merged = new Set(records.rows.map((row) => row.id));
    return {
      ...context,
      kind: 'duration',
      measurement: { ...records.measurement },
      days: medianMergeDays(
        world,
        world.pullRequests.filter((row) => merged.has(row.id)),
        selection.range,
      ),
      records,
    };
  }
  if (selection.metric === 'prAuthors' || selection.metric === 'issueAuthors') {
    const isPr = selection.metric === 'prAuthors';
    const source = repositoryRecordSample(repo, {
      selection: { ...selection, metric: isPr ? 'prsOpened' : 'issuesOpened' },
      returnTo,
    });
    // One author per login, whatever casing a record carries, as distinct-author counts use.
    const authors = new Map<string, RepositoryAuthor>();
    for (const row of source.rows) {
      const key = row.author.toLowerCase();
      const author = authors.get(key) ?? {
        id: repo.id + ':' + key,
        account: row.author,
        profileUrl: sampleProfileUrl(row.author),
        accountType: sampleAuthorType(row.author),
        recordCount: 0,
      };
      author.recordCount += 1;
      authors.set(key, author);
    }
    return {
      ...context,
      kind: 'authors',
      measurement:
        source.measurement.value === null
          ? { ...source.measurement }
          : periodCount(world, authors.size, selection.range),
      recordKind: isPr ? 'prs' : 'issues',
      rows: [...authors.values()].sort(
        (a, b) => b.recordCount - a.recordCount || a.account.localeCompare(b.account, 'en'),
      ),
    };
  }
  const credits = periodCredits(world, selection.metric, selection.range);
  const measurement = periodCount(world, credits.length, selection.range);
  return {
    ...context,
    kind: 'contributions',
    measurement,
    rows:
      measurement.value === null
        ? []
        : credits
            .map((credit) => ({
              id: repo.id + ':' + credit.account + ':' + credit.pr.id + ':' + credit.contribution,
              account: credit.account,
              profileUrl: sampleProfileUrl(credit.account),
              accountType: credit.accountType,
              contribution: credit.contribution,
              firstCreditAt: credit.firstCreditAt,
              pr: reference(credit.pr),
            }))
            .sort(
              (a, b) =>
                b.firstCreditAt.localeCompare(a.firstCreditAt) || a.id.localeCompare(b.id, 'en'),
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
