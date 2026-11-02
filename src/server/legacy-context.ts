import 'server-only';
import { repositoryCatalog } from '@/config/repositories';
import { contributionTimelineSample } from '@/mocks/contribution-timeline';
import { contributionSample, contributionSampleAsOf } from '@/mocks/contributions';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';
import { reportingBranchSchema } from '@/models/repository-overview';
import { authorTableColumnIds } from '@/models/repository-insights';
import {
  contributionDetailColumnIds,
  contributionTableColumnIds,
  insightCreditColumnIds,
  mergedPrColumnIds,
  overviewActivityColumnIds,
  overviewBacklogColumnIds,
  overviewDefaultActivityColumnIds,
  overviewDefaultBacklogColumnIds,
  recordIssueColumnIds,
  recordPrColumnIds,
} from '@/models/table-columns';
import type { LegacyContext } from '@/lib/presentation/url/legacy/state';

let cached: LegacyContext | undefined;
/** The prepared samples, catalog and column lists the legacy readers resolve old links against. */
export function legacyContext(): LegacyContext {
  if (cached) return cached;
  const overview = repositoryOverviewSamples();
  cached = {
    asOf: contributionSampleAsOf,
    enabledRepositoryIds: repositoryCatalog.filter((row) => row.enabled).map((row) => row.id),
    catalogIdentity(slug) {
      const repo = repositoryCatalog.find((row) => row.slug === slug && row.enabled);
      return repo
        ? {
            id: repo.id,
            slug: repo.slug,
            name: repo.displayName,
            primaryBranch: reportingBranchSchema.parse(repo.primaryBranch),
          }
        : null;
    },
    overviewDefinition: {
      backlogColumns: overviewBacklogColumnIds,
      activityColumns: overviewActivityColumnIds,
      defaultBacklogColumns: overviewDefaultBacklogColumnIds,
      defaultActivityColumns: overviewDefaultActivityColumnIds,
      repositoryIds: overview.repositories.map((row) => row.repository.id),
    },
    columnIds: {
      prs: recordPrColumnIds,
      issues: recordIssueColumnIds,
      authors: authorTableColumnIds,
      mergedPrs: mergedPrColumnIds,
      credits: insightCreditColumnIds,
      ...contributionTableColumnIds,
      details: contributionDetailColumnIds,
    },
    contributionDirectory: (scenario, period) => contributionSample({ scenario, period }),
    contributionTimelineDirectory: (sample, gap) =>
      contributionTimelineSample(sample, gap).contributions,
  };
  return cached;
}
