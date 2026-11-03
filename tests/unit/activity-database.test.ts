// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { periodActivity } from '@/mocks/repository-activity';
import { repositoryRecordSample } from '@/mocks/repository-records';
import type { RepositoryRecordSource } from '@/mocks/record-source';
import { reportingBranchSchema } from '@/models/repository-overview';

vi.mock('server-only', () => ({}));
const { databaseInstant, notConnectedReasons, repositoryRecords } =
  await import('@/server/activity-database');
const { contributionRecords } = await import('@/server/activity-contributions');

const schema = readFileSync(join(__dirname, '../fixtures/github-activity-db-schema.sql'), 'utf8');
const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

type Value = string | number | null;
/** Inserts a row, filling the columns a test does not care about with values the schema accepts. */
function insert(database: DatabaseSync, table: string, values: Record<string, Value>): number {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
    type: string;
    notnull: number;
    dflt_value: string | null;
    pk: number;
  }[];
  const row: Record<string, Value> = { ...values };
  for (const column of columns)
    if (column.notnull && column.dflt_value === null && !column.pk && !(column.name in row))
      row[column.name] = /BOOL/i.test(column.type)
        ? 0
        : /INT/i.test(column.type)
          ? ++sequence
          : /DATETIME|TIMESTAMP/i.test(column.type)
            ? '2026-01-01 00:00:00.000000'
            : 'filler-' + ++sequence;
  const names = Object.keys(row);
  const result = database
    .prepare(
      `INSERT INTO ${table} (${names.map((name) => `"${name}"`).join(', ')}) VALUES (${names.map(() => '?').join(', ')})`,
    )
    .run(...names.map((name) => row[name]));
  return Number(result.lastInsertRowid);
}
let sequence = 1000;

const at = (date: string, time = '12:00:00') => `2026-${date} ${time}.000000`;
const asOf = '2026-10-24T12:00:00.000Z';

/**
 * REF-01's R1 history (docs/implementation/test-data-plan.md) in Prebid.js, with the mapped
 * Prebid agent as a GitHub bot since the agent mapping is not connected; a second repository for
 * drafts and records after the clock; and one repository whose last sync was time limited.
 */
function referenceDatabase(options: { version?: number; finished?: boolean } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'activity-database-'));
  directories.push(directory);
  const path = join(directory, 'activity.db');
  const database = new DatabaseSync(path);
  database.exec(schema);
  if (options.version !== undefined) database.exec(`PRAGMA user_version = ${options.version}`);
  const run = insert(database, 'sync_runs', {
    started_at: at('10-24', '11:00:00'),
    finished_at: options.finished === false ? null : at('10-24', '14:00:00'),
    status: options.finished === false ? 'running' : 'complete',
    exit_code: options.finished === false ? null : 0,
    trigger: 'manual',
  });
  const user = (login: string, type = 'User') =>
    insert(database, 'github_users', { github_id: ++sequence, login, type });
  const [alice, bob, carol, drew, agent, bot] = [
    user('alice'),
    user('bob'),
    user('carol'),
    user('drew'),
    user('prebid-agent[bot]', 'Bot'),
    user('other-bot[bot]', 'Bot'),
  ];
  const repository = (githubId: number, name: string, outcome = 'complete') => {
    const id = insert(database, 'repositories', {
      github_id: githubId,
      owner: 'prebid',
      name,
      full_name: 'prebid/' + name,
      default_branch: 'master',
    });
    // The index starts at the reporting clock; hydration runs until the run finishes at 14:00.
    insert(database, 'repo_sync_state', {
      repository_id: id,
      last_run_id: run,
      last_outcome: outcome,
      last_index_started_at: at('10-24'),
    });
    return id;
  };
  const prebidjs = repository(39321023, 'Prebid.js');
  const server = repository(88511474, 'prebid-server');
  repository(132915235, 'go-gdpr', 'time_limited');
  const pr = (
    repositoryId: number,
    number: number,
    author: number,
    created: string,
    end: {
      merged?: string;
      mergedBy?: number;
      closed?: string;
      draft?: boolean;
      base?: string;
    } = {},
  ) =>
    insert(database, 'pull_requests', {
      repository_id: repositoryId,
      number,
      github_id: ++sequence,
      state: end.merged ? 'MERGED' : end.closed ? 'CLOSED' : 'OPEN',
      is_draft: end.draft ? 1 : 0,
      title: 'PR ' + number,
      author_id: author,
      created_at: created,
      merged_at: end.merged ?? null,
      closed_at: end.merged ?? end.closed ?? null,
      merged_by_id: end.mergedBy ?? null,
      base_ref: end.base ?? 'master',
    });
  const review = (prId: number, reviewer: number, state: string, submitted: string, inline = 0) =>
    insert(database, 'pr_reviews', {
      github_id: ++sequence,
      pr_id: prId,
      reviewer_id: reviewer,
      state,
      submitted_at: submitted,
      inline_comments_total: inline,
    });
  const comment = (prId: number, author: number, created: string) =>
    insert(database, 'pr_comments', {
      github_id: ++sequence,
      pr_id: prId,
      author_id: author,
      created_at: created,
    });
  const p101 = pr(prebidjs, 101, alice, at('08-05'), { merged: at('10-05'), mergedBy: carol });
  comment(p101, bob, at('08-06'));
  review(p101, bob, 'APPROVED', at('08-07'));
  comment(p101, bob, at('09-10'));
  review(p101, bob, 'APPROVED', at('09-11'));
  const p105 = pr(prebidjs, 105, bob, at('10-11'));
  review(p105, carol, 'CHANGES_REQUESTED', at('10-12'));
  comment(p105, agent, at('10-13'));
  review(p105, agent, 'APPROVED', at('10-14'));
  comment(p105, bot, at('10-15'));
  // Alice comments after the index started, while the run was still hydrating.
  comment(p105, alice, at('10-24', '12:30:00'));
  const p107 = pr(prebidjs, 107, drew, at('10-18'));
  comment(p107, alice, at('10-19'));
  // Alice's approval was dismissed after Drew's push; GitHub reports the review as DISMISSED.
  review(p107, alice, 'DISMISSED', at('10-20'));
  insert(database, 'pr_commits', { pr_id: p107, sha: 'c107', authored_at: at('10-21') });
  pr(prebidjs, 108, bob, at('10-20'), { merged: at('10-21'), mergedBy: drew });
  pr(server, 201, carol, at('10-22'), { merged: at('10-25'), mergedBy: bob });
  pr(server, 202, carol, at('10-25'));
  pr(server, 205, carol, at('10-24', '13:00:00'));
  pr(server, 203, drew, at('09-01'), { draft: true });
  // A merge into a release branch is authored work but not a primary-branch merge.
  pr(server, 204, carol, at('10-02'), { merged: at('10-03'), mergedBy: bob, base: 'release' });
  database.close();
  return path;
}

const october = { start: '2026-10-01T00:00:00.000Z', end: asOf, endInclusive: true };
const records = (path: string) => repositoryRecords(path);
const identity = (source: RepositoryRecordSource, id: string) => {
  const repository = source.repositories().get(id)!;
  return {
    id,
    slug: repository.slug,
    name: repository.name,
    primaryBranch: reportingBranchSchema.parse(repository.primaryBranch),
  };
};

describe('activity database records', () => {
  it('reads the stored UTC text as ISO instants', () => {
    expect(databaseInstant('2026-10-24 12:00:00.000000')).toBe('2026-10-24T12:00:00.000Z');
    expect(databaseInstant('2026-10-24 12:00:00.123456')).toBe('2026-10-24T12:00:00.123Z');
    expect(() => databaseInstant('2026-10-24T12:00:00Z')).toThrow('Unexpected timestamp');
  });

  it('counts the REF-01 repository backlog from current GitHub state', () => {
    const source = records(referenceDatabase());
    expect(source.kind).toBe('database');
    expect(source.asOf).toBe(asOf);
    const { counts, agedPrs } = source.backlog('repo-prebidjs');
    const value = (metric: keyof typeof counts) => counts[metric];
    expect(value('totalOpenPrs')).toEqual({ status: 'complete', value: 2 });
    expect(value('draftPrs')).toEqual({ status: 'complete', value: 0 });
    expect(value('nonDraftPrs')).toEqual({ status: 'complete', value: 2 });
    // P105 (Carol's change request) and P107 (Alice's comment) each have one human reviewer, and
    // neither has a current human approval: Alice's approval of P107 was dismissed.
    expect(value('humanReviewers1')).toEqual({ status: 'complete', value: 2 });
    expect(value('humanApprovals0')).toEqual({ status: 'complete', value: 2 });
    expect(value('botFeedbackPrs')).toEqual({ status: 'complete', value: 1 });
    // P105's latest event is the bot's comment; P107's is a commit, whose pusher GitHub does not
    // record, so its latest actor is unknown rather than its author.
    expect(value('lastBot')).toEqual({ status: 'complete', value: 1 });
    expect(value('lastUnknown')).toEqual({ status: 'complete', value: 1 });
    expect(value('lastContributor')).toEqual({ status: 'complete', value: 0 });
    expect(value('lastOtherHuman')).toMatchObject({ status: 'partial', value: 0 });
    expect(agedPrs[30]).toEqual({ status: 'complete', value: 0 });
    for (const metric of [
      'openIssues',
      'agentFeedbackPrs',
      'lastAgent',
      'lastPrebidReviewer',
    ] as const)
      expect(value(metric)).toMatchObject({ status: 'missing', value: null, notConnected: true });
    expect(value('openIssues')).toMatchObject({ reason: notConnectedReasons.issues });
  });

  it('counts REF-01 October activity and leaves issue and agent metrics not connected', () => {
    const source = records(referenceDatabase());
    const { counts, mergeDuration } = periodActivity('repo-prebidjs', october, source);
    expect(counts.prsOpened).toEqual({ status: 'complete', value: 3 });
    expect(counts.prsMerged).toEqual({ status: 'complete', value: 2 });
    expect(counts.prAuthors).toEqual({ status: 'complete', value: 2 });
    expect(mergeDuration.days).toEqual({ status: 'complete', value: 31 });
    // The agent's and the other bot's first feedback on P105, and the agent's approval.
    expect(counts.botFeedbackCredits).toEqual({ status: 'complete', value: 2 });
    expect(counts.botApprovalCredits).toEqual({ status: 'complete', value: 1 });
    for (const metric of [
      'issuesOpened',
      'issuesClosed',
      'issueAuthors',
      'agentFeedbackCredits',
    ] as const)
      expect(counts[metric]).toMatchObject({ status: 'missing', notConnected: true });
  });

  it('lists the same open pull requests the backlog counts, with real GitHub links', () => {
    const source = records(referenceDatabase());
    const list = repositoryRecordSample(
      identity(source, 'repo-prebidjs'),
      { selection: { scope: 'current', metric: 'humanApprovals0' }, returnTo: null },
      source,
    );
    if (list.kind !== 'prs') throw new Error('Expected pull requests');
    expect(list.measurement).toEqual({ status: 'complete', value: 2 });
    expect(list.rows.map((row) => [row.number, row.url, row.authorUrl])).toEqual([
      [107, 'https://github.com/prebid/Prebid.js/pull/107', 'https://github.com/drew'],
      [105, 'https://github.com/prebid/Prebid.js/pull/105', 'https://github.com/bob'],
    ]);
  });

  it('states GitHub as it was when the index started, not when the run finished', () => {
    const source = records(referenceDatabase());
    expect(source.asOf).toBe(asOf);
    // Alice's 12:30 comment and PR 205 opened at 13:00 came after the index started.
    expect(source.backlog('repo-prebidjs').counts.lastBot).toEqual({
      status: 'complete',
      value: 1,
    });
    expect(
      source
        .repositories()
        .get('repo-prebidserver')!
        .pullRequests.map((row) => row.number),
    ).not.toContain(205);
  });

  it('states GitHub as it was at the clock: later merges stay open and later records are absent', () => {
    const source = records(referenceDatabase());
    const server = source.repositories().get('repo-prebidserver')!;
    expect(server.pullRequests.map((row) => [row.number, row.state, row.draft])).toEqual([
      [203, 'Open', true],
      [204, 'Merged', false],
      [201, 'Open', false],
    ]);
    expect(source.backlog('repo-prebidserver').counts.draftPrs).toEqual({
      status: 'complete',
      value: 1,
    });
  });

  it('marks repositories the database has not completely synced as not connected', () => {
    const source = records(referenceDatabase());
    const limited = source.backlog('repo-go-gdpr').counts.totalOpenPrs;
    expect(limited).toEqual({
      status: 'missing',
      value: null,
      reason: notConnectedReasons.unsynced,
      notConnected: true,
    });
    expect(source.backlog('repo-prebid-agent-skills').counts.totalOpenPrs).toMatchObject({
      reason: notConnectedReasons.private,
      notConnected: true,
    });
    expect(
      periodActivity('repo-prebid-agent-skills', october, source).counts.prsOpened,
    ).toMatchObject({ notConnected: true });
  });

  it('refuses a database it cannot read correctly instead of showing samples', () => {
    expect(() => records(referenceDatabase({ version: 3 }))).toThrow('schema version 3');
    expect(() => records(referenceDatabase({ finished: false }))).toThrow('no finished sync run');
  });

  it('reads samples when no database is configured', () => {
    expect(repositoryRecords('').kind).toBe('sample');
  });
});

describe('activity database contributions', () => {
  const period = { kind: 'custom', from: '2026-10-01', through: '2026-10-24' } as const;
  const credits = (path: string) => {
    const source = contributionRecords(path).report('reference', period);
    const login = new Map(source.accounts.map((account) => [account.id, account.login]));
    return {
      source,
      credits: source.credits
        .map((credit) => [credit.metric, login.get(credit.accountId)!, credit.recordId] as const)
        .sort((a, b) => a.join().localeCompare(b.join())),
    };
  };

  it('credits each account once per pull request and metric at its first qualifying date', () => {
    const { source, credits: october } = credits(referenceDatabase());
    expect(source.source).toBe('database');
    expect(source.companyAttribution).toBe('not-connected');
    expect(october).toEqual([
      ['approvalContributions', 'prebid-agent[bot]', 'repo-prebidjs-pr-105'],
      ['authoredPrsMerged', 'alice', 'repo-prebidjs-pr-101'],
      ['authoredPrsMerged', 'bob', 'repo-prebidjs-pr-108'],
      ['mergesPerformed', 'carol', 'repo-prebidjs-pr-101'],
      ['mergesPerformed', 'drew', 'repo-prebidjs-pr-108'],
      ['prsAuthored', 'bob', 'repo-prebidjs-pr-105'],
      ['prsAuthored', 'bob', 'repo-prebidjs-pr-108'],
      ['prsAuthored', 'carol', 'repo-prebidserver-pr-201'],
      ['prsAuthored', 'carol', 'repo-prebidserver-pr-204'],
      ['prsAuthored', 'drew', 'repo-prebidjs-pr-107'],
      // Bob's August feedback and approval of P101 are earlier credits; his September repeats add none.
      ['reviewerContributions', 'alice', 'repo-prebidjs-pr-107'],
      ['reviewerContributions', 'carol', 'repo-prebidjs-pr-105'],
      ['reviewerContributions', 'other-bot[bot]', 'repo-prebidjs-pr-105'],
      ['reviewerContributions', 'prebid-agent[bot]', 'repo-prebidjs-pr-105'],
    ]);
  });

  it('keeps unknown review history and uncollected data explicit', () => {
    const { source } = credits(referenceDatabase());
    // Alice's dismissed review on P107 may have been an approval GitHub no longer reports.
    const alice = source.accounts.find((account) => account.login === 'alice')!;
    expect(
      source.coverageOverrides
        .filter((row) => row.accountId === alice.id)
        .map((row) => [row.repositoryId, row.metric, row.coverage.status]),
    ).toEqual([
      ['repo-prebidjs', 'reviewerContributions', 'partial'],
      ['repo-prebidjs', 'approvalContributions', 'partial'],
    ]);
    expect(source.coverage.issuesAuthored).toMatchObject({ status: 'missing', notConnected: true });
    expect(source.activity.coverage.inlineComments).toMatchObject({ notConnected: true });
    expect(source.activity.coverage.issueComments).toMatchObject({ notConnected: true });
    // Repositories the database has not completely synced leave the totals incomplete.
    expect(source.coverage.prsAuthored).toMatchObject({ status: 'partial' });
    expect(source.activity.comments.map((row) => row.createdAt)).toEqual([
      '2026-10-13T12:00:00.000Z',
      '2026-10-15T12:00:00.000Z',
      '2026-10-19T12:00:00.000Z',
    ]);
    expect(
      source.activity.volumes
        .map((row) => [row.role, row.recordId])
        .sort((a, b) => a.join().localeCompare(b.join())),
    ).toEqual([
      ['approved', 'repo-prebidjs-pr-101'],
      ['authored', 'repo-prebidjs-pr-101'],
      ['authored', 'repo-prebidjs-pr-108'],
      ['reviewed', 'repo-prebidjs-pr-101'],
    ]);
  });

  it('reads samples when no database is configured', () => {
    expect(contributionRecords('').kind).toBe('sample');
  });
});
