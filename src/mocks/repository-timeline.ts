import {
  repositoryTimelineSourceSchema,
  type RepositoryTimelineSource,
} from '@/models/repository-timeline';
import { contributionTimelineSample } from './contribution-timeline';
import type { RepositoryTimelineMatrixSource } from '@/models/repository-timeline-matrix';
import type { ContributionRecord } from '@/models/contributions';

export type RepositoryTimelineScenario = Parameters<typeof contributionTimelineSample>[0] | 'mixed';

/** Prepare the common fake facts once, then build only the requested repository sources. */
function prepareRepositoryTimelineSamples(scenario: RepositoryTimelineScenario, gap: boolean) {
  const baseScenario = scenario === 'mixed' ? 'reference' : scenario;
  const prepared = contributionTimelineSample(baseScenario, gap),
    source = prepared.contributions;
  const repositories = new Map(source.repositories.map((row) => [row.id, row]));
  const accounts = new Map(source.accounts.map((row) => [row.id, row]));
  const byRepository = new Map<string, ContributionRecord[]>();
  for (const row of source.records) {
    const records = byRepository.get(row.repositoryId) ?? [];
    records.push(row);
    byRepository.set(row.repositoryId, records);
  }
  const identity = {
    source: source.source,
    scenarioId: source.scenarioId + (scenario === 'mixed' ? '-matrix-mixed' : ''),
    asOf: source.asOf,
  };
  function build(repositoryId: string, kind: 'prs' | 'issues'): RepositoryTimelineSource {
    const repository = repositories.get(repositoryId);
    if (!repository) throw Error('Unknown sample repository');
    const year = source.range.start.slice(0, 4),
      at = (date: string) => year + '-' + date + 'T00:00:00.000Z';
    const records = (byRepository.get(repositoryId) ?? []).filter((row) =>
      kind === 'prs' ? row.kind === 'pr' : row.kind === 'issue',
    );
    const rows = records.map((record) => {
      const author = accounts.get(record.authorId!)!;
      const common = {
        id: record.id,
        number: record.number,
        title: record.title,
        url: record.url,
        author: author.login,
        authorType: author.actorType === 'unknown' ? null : author.actorType,
        createdAt: record.createdAt,
        labels: [record.number % 2 ? 'maintenance' : 'feature'],
        ageDays: (Date.parse(source.asOf) - Date.parse(record.createdAt)) / 86400000,
        latestActivity: {
          at: record.createdAt,
          account: author.login,
          category: 'contributor' as const,
        },
        state: record.state,
      };
      return record.kind === 'pr'
        ? {
            ...common,
            draft: record.draft,
            mergedAt: record.mergedAt,
            baseBranch: record.baseBranch,
            humanReviewers: record.number === 107 ? 1 : 0,
            approvals: 0,
            agentReviewer: false,
            botReviewer: false,
            latestActor: 'contributor' as const,
          }
        : { ...common, closedAt: record.state === 'Closed' ? at('09-11') : null, assignees: [] };
    });
    const snapshots =
      baseScenario === 'reference' || baseScenario === 'partial' || baseScenario === 'calendar'
        ? ['10-12', '10-22'].map((date, index) => ({
            cutoff: { at: at(date), inclusive: false },
            coverage:
              baseScenario === 'partial'
                ? { status: 'partial', reason: 'Some historical sample records are unavailable.' }
                : { status: 'complete' },
            // Membership and review state are supplied independently; no reconstruction from today's list.
            rows: rows
              .filter((row) =>
                kind === 'prs'
                  ? (index === 0 ? [104, 105] : [104, 105, 107]).includes(row.number)
                  : [201, 206].includes(row.number),
              )
              .map((row) => ({
                ...row,
                state: 'Open',
                ageDays: (Date.parse(at(date)) - Date.parse(row.createdAt)) / 86400000,
                ...('draft' in row
                  ? {
                      mergedAt: null,
                      humanReviewers: index === 0 ? 0 : 1,
                      approvals: row.number === 107 ? 1 : 0,
                    }
                  : { closedAt: null }),
              })),
          }))
        : [];
    const result = repositoryTimelineSourceSchema.parse({
      ...identity,
      repository,
      kind,
      availableRanges: prepared.availableRanges,
      rows,
      snapshots,
    });

    if (scenario === 'mixed' && repositoryId === 'repo-prebidserver') {
      const earliest = year + '-02-01T00:00:00.000Z';
      result.availableRanges = result.availableRanges.flatMap((range) => {
        const start = range.start < earliest ? earliest : range.start;
        return start > range.end || (start === range.end && !range.endInclusive)
          ? []
          : [{ ...range, start }];
      });
      for (const snapshot of result.snapshots)
        snapshot.coverage = {
          status: 'partial',
          reason: 'This repository has incomplete prepared historical coverage.',
        };
    }
    if (scenario === 'mixed' && repositoryId === 'repo-prebidserverjava') {
      result.availableRanges = [];
      result.rows = [];
      result.snapshots = [];
    }
    return result;
  }
  return { identity, repositoryIds: [...repositories.keys()], build };
}
export function repositoryTimelineSample(
  kind: 'prs' | 'issues' = 'prs',
  repositoryId = 'repo-prebidjs',
  scenario: RepositoryTimelineScenario = 'reference',
  gap = false,
): RepositoryTimelineSource {
  return prepareRepositoryTimelineSamples(scenario, gap).build(repositoryId, kind);
}
export function repositoryTimelineMatrixSample(
  kind: 'prs' | 'issues' | 'mixed' = 'prs',
  scenario: RepositoryTimelineScenario = 'reference',
  gap = false,
): RepositoryTimelineMatrixSource {
  const prepared = prepareRepositoryTimelineSamples(scenario, gap);
  return {
    ...prepared.identity,
    kind,
    repositories: prepared.repositoryIds.flatMap((id) =>
      kind === 'mixed'
        ? [prepared.build(id, 'prs'), prepared.build(id, 'issues')]
        : [prepared.build(id, kind)],
    ),
  };
}
