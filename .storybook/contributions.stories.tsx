import { useState } from 'react';
import Link from 'next/link';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AccountTypeFilter } from '../src/features/contributions/account-type-filter';
import { ContributionView, ShowAllSwitch } from '../src/features/contributions/contribution-view';
import { DashboardFrame } from '../src/components/layout/dashboard-frame';
import { PageError } from '../src/components/feedback/page-error';
import { useLocalTableController } from '../src/components/tables/local-data-table';
import { contributionSample } from '../src/mocks/contributions';
import {
  selectContributions,
  defaultContributionSelection,
} from '../src/lib/presentation/contributions';
import {
  companyBreakdownHref,
  companyBreakdownLabels,
} from '../src/lib/presentation/contribution-navigation';
import { contributionActorTypes, type ContributionAccount } from '../src/models/contributions';
import { lensDefaultSort, type ContributionLens } from '../src/models/contribution-lens';
import type { ContributionSampleScenario, CompanyBreakdown } from '../src/models/contribution-page';
import { ViewTabs } from '../src/components/navigation/view-tabs';
function Preview({
  sample = 'reference',
  view = 'contributors',
  lens = 'contributors',
  accountId,
}: {
  sample?: ContributionSampleScenario;
  view?: 'contributors' | 'companies' | 'person' | 'company' | 'unmapped' | 'error';
  lens?: ContributionLens;
  /** The person report's account; by default Alice, or the heavy agent on large samples. */
  accountId?: string;
}) {
  const [actorTypes, setActorTypes] = useState<ContributionAccount['actorType'][]>([
    ...contributionActorTypes,
  ]);
  const [breakdown, setBreakdown] = useState<CompanyBreakdown>('members');
  const [allAccounts, setAllAccounts] = useState(false);
  const controller = useLocalTableController({ search: '', page: 1, ...lensDefaultSort[lens] });
  const source = contributionSample({ scenario: sample });
  const focus =
    view === 'person'
      ? {
          kind: 'contributor' as const,
          accountId:
            accountId ??
            (sample === 'large' || sample === 'coverage-gap'
              ? 'account-heavy-agent'
              : 'account-alice'),
        }
      : view === 'company' || view === 'unmapped'
        ? { kind: 'company' as const, companyId: view === 'unmapped' ? null : 'company-acme' }
        : { kind: 'overview' as const };
  const area =
    view === 'companies' || view === 'company' || view === 'unmapped'
      ? 'companies'
      : 'contributors';
  const report = selectContributions(
    source,
    { ...defaultContributionSelection(source), actorTypes },
    focus,
    { area: view === 'companies' ? 'companies' : 'contributors', breakdown, lens, allAccounts },
  );
  return (
    <DashboardFrame navigation={<span>Prebid · Contributions</span>}>
      {view === 'error' ? (
        <PageError reset={() => {}} />
      ) : (
        <ContributionView
          page={{
            area,
            report,
            sample,
            breakdown,
            lens,
            allAccounts,
            // A focused report opened from its lens's overview names that overview.
            returnTo:
              area === 'companies'
                ? '/companies' + (lens === 'reviewers' ? '?lens=reviewers' : '')
                : lens === 'reviewers'
                  ? '/reviewers'
                  : '/contributors',
            returnLabel:
              area === 'companies'
                ? 'Back to Companies'
                : lens === 'reviewers'
                  ? 'Back to Reviewers'
                  : 'Back to Contributors',
          }}
          controller={controller}
          populationControls={
            report.kind === 'overview' &&
            report.population && (
              <ShowAllSwitch
                population={report.population}
                area={area}
                onChange={(on) => {
                  setAllAccounts(on);
                  controller.update({ page: 1 });
                }}
              />
            )
          }
          toolbar={{
            disabled: false,
            groups: [
              {
                label: 'Report filters',
                controls: (
                  <AccountTypeFilter
                    selected={actorTypes}
                    onApply={(types) => {
                      setActorTypes(types);
                      controller.update({ page: 1 });
                    }}
                  />
                ),
                reset: {
                  label: 'Reset filters',
                  onReset: () => {
                    setActorTypes([...contributionActorTypes]);
                    controller.update({ page: 1 });
                  },
                },
              },
            ],
            status: { kind: 'saved' },
          }}
          links={{
            sample,
            lens,
            currentHref: lens === 'reviewers' ? '/reviewers' : '/contributors',
            settings: {
              period: source.period,
              selection: { ...defaultContributionSelection(source), actorTypes },
            },
          }}
          breakdownControls={
            // Links, as the company screen renders them; a click switches the breakdown in place.
            <ViewTabs label="Company breakdown" variant="segmented">
              {(['members', 'repositories'] as const).map((value) => (
                <Link
                  key={value}
                  href={companyBreakdownHref('/companies/id/company-acme', '', value)}
                  aria-current={breakdown === value ? 'page' : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    setBreakdown(value);
                    controller.update({ page: 1, search: '' });
                  }}
                >
                  {companyBreakdownLabels[value]}
                </Link>
              ))}
            </ViewTabs>
          }
        />
      )}
    </DashboardFrame>
  );
}
const meta = {
  title: 'Contributions/Pages',
  component: Preview,
  parameters: { layout: 'fullscreen', nextjs: { appDirectory: true } },
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Contributors: Story = {};
export const Companies: Story = { args: { view: 'companies' } };
export const Contributor: Story = { args: { view: 'person' } };
export const Company: Story = { args: { view: 'company' } };
export const Unmapped: Story = { args: { view: 'unmapped' } };
export const Large: Story = { args: { sample: 'large' } };
export const CoverageGap: Story = { args: { sample: 'coverage-gap' } };
export const CompanyCoverageGap: Story = { args: { sample: 'coverage-gap', view: 'companies' } };
export const BusyContributor: Story = { args: { sample: 'large', view: 'person' } };
export const Partial: Story = { args: { sample: 'partial' } };
export const Missing: Story = { args: { sample: 'missing' } };
export const Empty: Story = { args: { sample: 'empty' } };
export const Error: Story = { args: { view: 'error' } };
export const Reviewers: Story = { args: { lens: 'reviewers' } };
export const ReviewersLarge: Story = { args: { lens: 'reviewers', sample: 'large' } };
export const ReviewerContributor: Story = { args: { lens: 'reviewers', view: 'person' } };
export const NoReviewerActivity: Story = {
  args: { lens: 'reviewers', view: 'person', accountId: 'account-finn' },
};
export const CompanyReviewers: Story = { args: { lens: 'reviewers', view: 'company' } };
