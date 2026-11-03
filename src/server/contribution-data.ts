import 'server-only';
import { notFound } from 'next/navigation';
import { requireViewer } from '@/lib/auth/viewer';
import { contributionRecords } from './activity-contributions';
import {
  readContributionLayoutQuery,
  contributionPath,
} from '@/lib/presentation/contribution-navigation';
import { contributionUrlFits } from '@/lib/presentation/contribution-return';
import {
  readContributionPeriod,
  readContributionSettings,
  validateContributionSettings,
} from '@/lib/presentation/contribution-settings';
import { contributionScopeInput } from '@/lib/presentation/contribution-url';
import { resolveReportingPeriod } from '@/lib/presentation/reporting-period';
import { periodSelection } from '@/lib/presentation/url/period';
import type { UrlValues } from '@/lib/presentation/url/registry';
import type { ContributionFocus, ContributionSource } from '@/models/contributions';
import {
  contributionSampleScenarios,
  type CompanyBreakdown,
  type ContributionArea,
  type ContributionSampleScenario,
} from '@/models/contribution-page';

function focusExists(source: ContributionSource, focus: ContributionFocus): boolean {
  return !(
    (focus.kind === 'contributor' &&
      !source.accounts.some((account) => account.id === focus.accountId)) ||
    (focus.kind === 'company' &&
      focus.companyId !== null &&
      !source.companies.some((company) => company.id === focus.companyId))
  );
}
/** A legacy query's report data, for export links that predate the URL codec. */
export async function loadContributionData(
  area: ContributionArea,
  params: URLSearchParams,
  focus: ContributionFocus,
) {
  const viewer = await requireViewer();
  if (
    !contributionUrlFits(
      contributionPath(focus.kind === 'overview' ? area : focus) + '?' + params.toString(),
    )
  )
    return { status: 'invalid' as const, viewer, area };
  const options = readContributionLayoutQuery(params);
  if (!options) return { status: 'invalid' as const, viewer, area };
  const records = contributionRecords();
  const period = readContributionPeriod(params, records.asOf);
  if (!period) return { status: 'invalid' as const, viewer, area };
  const source = records.report(options.sample, period);
  const settings = readContributionSettings(params, source, source.asOf);
  if (!settings) return { status: 'invalid' as const, viewer, area };
  if (!focusExists(source, focus)) notFound();
  return { status: 'ready' as const, viewer, options, source, settings };
}
/**
 * The report data registry values name: their sample and scope, checked against that sample's
 * directory. An unknown repository, account, company or range is invalid; an unknown subject is
 * not found.
 */
export async function loadContributionValues(
  area: ContributionArea,
  values: UrlValues,
  focus: ContributionFocus,
) {
  const viewer = await requireViewer();
  const invalid = { status: 'invalid' as const, viewer, area };
  const sample = (
    typeof values.sample === 'string' ? values.sample : 'reference'
  ) as ContributionSampleScenario;
  const period = periodSelection(typeof values.period === 'string' ? values.period : 'this-year');
  if (!period || !contributionSampleScenarios.includes(sample)) return invalid;
  const records = contributionRecords();
  try {
    resolveReportingPeriod(period, records.asOf);
  } catch {
    return invalid;
  }
  const source = records.report(sample, period);
  const input = contributionScopeInput(values, source);
  const settings = input && validateContributionSettings(input, source, source.asOf);
  if (!settings) return invalid;
  if (!focusExists(source, focus)) notFound();
  const breakdown: CompanyBreakdown = values.view === 'repositories' ? 'repositories' : 'members';
  return { status: 'ready' as const, viewer, options: { sample, breakdown }, source, settings };
}
