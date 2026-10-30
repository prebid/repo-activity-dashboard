import type { ContributionCredit, ContributionMetric } from '@/models/contributions';
import type { AdditionalMetric } from '@/models/contribution-activity';
export const contributionCellKey = (
  accountId: string,
  repositoryId: string,
  metric: ContributionMetric | AdditionalMetric,
) => JSON.stringify([accountId, repositoryId, metric]);
/** Record IDs are globally unique in a source; dates, company and login are not credit identity. */
export const contributionRecordKey = (
  accountId: string,
  recordId: string,
  metric: ContributionMetric | AdditionalMetric,
) => JSON.stringify([recordId, accountId, metric]);
export const contributionCreditKey = (credit: ContributionCredit) =>
  contributionRecordKey(credit.accountId, credit.recordId, credit.metric);
