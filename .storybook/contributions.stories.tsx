import { useState } from 'react';
import Link from 'next/link';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AccountTypeFilter } from '../src/features/contributions/account-type-filter';
import { ContributionView } from '../src/features/contributions/contribution-view';
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
import {
  contributionDefaultSort,
  contributionActorTypes,
  type ContributionAccount,
} from '../src/models/contributions';
import type { ContributionSampleScenario, CompanyBreakdown } from '../src/models/contribution-page';
import styles from '../src/features/contributions/contributions.module.css';
function Preview({
  sample = 'reference',
  view = 'contributors',
}: {
  sample?: ContributionSampleScenario;
  view?: 'contributors' | 'companies' | 'person' | 'company' | 'unmapped' | 'error';
}) {
  const [actorTypes, setActorTypes] = useState<ContributionAccount['actorType'][]>([
    ...contributionActorTypes,
  ]);
  const [breakdown, setBreakdown] = useState<CompanyBreakdown>('members');
  const controller = useLocalTableController({ search: '', page: 1, ...contributionDefaultSort });
  const source = contributionSample({ scenario: sample });
  const focus =
    view === 'person'
      ? {
          kind: 'contributor' as const,
          accountId:
            sample === 'large' || sample === 'coverage-gap'
              ? 'account-heavy-agent'
              : 'account-alice',
        }
      : view === 'company' || view === 'unmapped'
        ? { kind: 'company' as const, companyId: view === 'unmapped' ? null : 'company-acme' }
        : { kind: 'overview' as const };
  return (
    <DashboardFrame navigation={<span>Prebid · Contributions</span>}>
      {view === 'error' ? (
        <PageError reset={() => {}} />
      ) : (
        <ContributionView
          page={{
            area:
              view === 'companies' || view === 'company' || view === 'unmapped'
                ? 'companies'
                : 'contributors',
            report: selectContributions(
              source,
              { ...defaultContributionSelection(source), actorTypes },
              focus,
              { area: view === 'companies' ? 'companies' : 'contributors', breakdown },
            ),
            sample,
            breakdown,
            returnTo: '/contributors',
          }}
          controller={controller}
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
            currentHref: '/contributors',
            settings: {
              period: source.period,
              selection: { ...defaultContributionSelection(source), actorTypes },
            },
          }}
          breakdownControls={
            // Links, as the company screen renders them; a click switches the breakdown in place.
            <nav aria-label="Company breakdown" className={styles.breakdowns}>
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
            </nav>
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
