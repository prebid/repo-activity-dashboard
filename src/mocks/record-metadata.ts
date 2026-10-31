import type { LatestRecordActivity } from '@/models/repository-page';
import type { LatestActor } from '@/models/repository-records';
import { sampleAuthorType } from './repository-accounts';

const latestAccounts: Record<Exclude<LatestActor, 'unknown' | 'contributor'>, string> = {
  agent: 'sample-prebid-agent-a',
  bot: 'sample-bot-a',
  'prebid-reviewer': 'sample-reviewer',
  'other-human': 'sample-other-human',
};
/** A record's invented latest-activity time: recent, never before it was opened. */
function latestAt(createdAt: string, number: number, asOf: string): string {
  return new Date(
    Math.max(Date.parse(createdAt), Date.parse(asOf) - (number % 14) * 86_400_000),
  ).toISOString();
}
/** The latest activity a pull request shows on record pages and in Timeline supporting rows. */
export function pullRequestActivity(
  row: { author: string; createdAt: string; number: number; latestActor: LatestActor },
  asOf: string,
  periodList = false,
): LatestRecordActivity | null {
  if (row.latestActor === 'unknown' && periodList) return null;
  return {
    at: latestAt(row.createdAt, row.number, asOf),
    category: row.latestActor,
    account:
      row.latestActor === 'unknown'
        ? null
        : row.latestActor === 'contributor'
          ? row.author
          : latestAccounts[row.latestActor],
  };
}
/** The latest activity and assignees an issue shows on record pages and in Timeline rows. */
export function issueMetadata(
  row: { author: string; createdAt: string; closedAt: string | null; number: number },
  asOf: string,
): { latestActivity: LatestRecordActivity | null; assignees: string[] | null } {
  const authorType = sampleAuthorType(row.author);
  return {
    latestActivity:
      row.number % 5 === 0
        ? null
        : {
            at: row.closedAt ?? latestAt(row.createdAt, row.number, asOf),
            category: authorType === 'human' ? 'contributor' : authorType,
            account: row.author,
          },
    assignees: row.number % 5 === 0 ? null : row.number % 2 === 0 ? [] : ['sample-maintainer'],
  };
}
