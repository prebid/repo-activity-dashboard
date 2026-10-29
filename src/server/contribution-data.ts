import 'server-only';
import { notFound } from 'next/navigation';
import { requireViewer } from '@/lib/auth/viewer';
import { contributionSample, contributionSampleAsOf } from '@/mocks/contributions';
import { readContributionLayoutQuery } from '@/lib/presentation/contribution-navigation';
import {
  readContributionPeriod,
  readContributionSettings,
} from '@/lib/presentation/contribution-settings';
import type { ContributionFocus } from '@/models/contributions';
import type { ContributionArea } from '@/models/contribution-page';
export async function loadContributionData(
  area: ContributionArea,
  params: URLSearchParams,
  focus: ContributionFocus,
) {
  const viewer = await requireViewer();
  const options = readContributionLayoutQuery(params);
  if (!options) return { status: 'invalid' as const, viewer, area };
  const period = readContributionPeriod(params, contributionSampleAsOf);
  if (!period) return { status: 'invalid' as const, viewer, area };
  const source = contributionSample({ scenario: options.sample, period });
  const settings = readContributionSettings(params, source, source.asOf);
  if (!settings) return { status: 'invalid' as const, viewer, area };
  if (
    (focus.kind === 'contributor' &&
      !source.accounts.some((account) => account.id === focus.accountId)) ||
    (focus.kind === 'company' &&
      focus.companyId !== null &&
      !source.companies.some((company) => company.id === focus.companyId))
  )
    notFound();
  return { status: 'ready' as const, viewer, options, source, settings };
}
