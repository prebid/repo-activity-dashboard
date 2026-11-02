import { expect, it } from 'vitest';
import {
  companyColumns,
  contributorColumns,
  repositoryContributionColumns,
} from '@/features/contributions/contribution-columns';
import { overviewSettingsColumns } from '@/features/repositories/overview-columns';
import { contributionDetailColumns as insightCreditColumns } from '@/features/repositories/repository-insights-view';
import {
  repositoryMergedPrColumns,
  repositoryPageIssueColumns,
  repositoryPagePrColumns,
} from '@/features/repositories/repository-page-columns';
import {
  contributionTableColumnIds,
  insightCreditColumnIds,
  mergedPrColumnIds,
  overviewActivityColumnIds,
  overviewBacklogColumnIds,
  recordIssueColumnIds,
  recordPrColumnIds,
} from '@/models/table-columns';

// The URL codec and the server read the pure ID lists; the tables render the client definitions.
// A difference would make a column choice canonicalize differently on the server and the client.
const ids = (columns: readonly { id: string }[]) => columns.map((column) => column.id);
const links = { sample: 'reference' as const, currentHref: '/contributors' };

it('keeps every record and insight column list equal to its table definition', () => {
  expect(recordPrColumnIds).toEqual(ids(repositoryPagePrColumns));
  expect(recordIssueColumnIds).toEqual(ids(repositoryPageIssueColumns));
  expect(mergedPrColumnIds).toEqual(ids(repositoryMergedPrColumns));
  expect(insightCreditColumnIds).toEqual(ids(insightCreditColumns));
});

it('keeps every contribution table list equal to its table definition', () => {
  expect(contributionTableColumnIds).toEqual({
    contributors: ids(contributorColumns(links)),
    companies: ids(companyColumns(links)),
    members: ids(contributorColumns(links, false)),
    repositories: ids(repositoryContributionColumns()),
  });
});

it('keeps the All repositories lists equal to the settings definition', () => {
  expect(overviewBacklogColumnIds).toEqual(overviewSettingsColumns.backlogColumns);
  expect(overviewActivityColumnIds).toEqual(overviewSettingsColumns.activityColumns);
});
