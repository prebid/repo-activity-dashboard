import 'server-only';
import { repositoryCatalog } from '@/config/repositories';
import type { ContributionRecordSource } from '@/mocks/contribution-records';
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
import { contributionRecords } from './activity-contributions';

const contexts = new WeakMap<ContributionRecordSource, LegacyContext>();
/** The report data, catalog and column lists the legacy readers resolve old links against. */
export function legacyContext(): LegacyContext {
  const records = contributionRecords();
  const cached = contexts.get(records);
  if (cached) return cached;
  const overview = repositoryOverviewSamples();
  const context: LegacyContext = {
    asOf: records.asOf,
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
    contributionDirectory: (scenario, period) => records.report(scenario, period),
    contributionTimelineDirectory: (sample, gap) => records.timeline(sample, gap).contributions,
  };
  contexts.set(records, context);
  return context;
}
