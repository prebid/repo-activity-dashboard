import type { ReportingAccountType } from '@/models/repository-insights';

export const sampleBotAuthor = 'sample-author-3[bot]';
// Explicit assignments for invented accounts. This does not classify real GitHub accounts.
const authorTypes: Record<string, ReportingAccountType> = {
  'sample-author-2': 'agent',
  [sampleBotAuthor]: 'bot',
};
export function sampleAuthorType(account: string): ReportingAccountType {
  return authorTypes[account] ?? 'human';
}
