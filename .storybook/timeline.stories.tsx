import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DashboardFrame } from '../src/components/layout/dashboard-frame';
import { EmptyState } from '../src/components/feedback/empty-state';
import { RepositoryTimelineView } from '../src/features/repositories/repository-timeline-view';
import { ContributionTimelineView } from '../src/features/contributions/contribution-timeline-view';
import { repositoryTimelineSample } from '../src/mocks/repository-timeline';
import { contributionTimelineSample } from '../src/mocks/contribution-timeline';
import { repositoryPageNavigationSample } from '../src/mocks/repository-page';
import { selectRepositoryTimeline } from '../src/lib/presentation/repository-timeline';
import { selectContributionTimeline } from '../src/lib/presentation/contribution-timeline';
import type { ContributionSampleScenario } from '../src/models/contribution-page';
import type { TimelineGrouping } from '../src/models/reporting-timeline';
function Preview({
  area = 'repository',
  sample = 'reference',
  kind = 'prs',
  family = 'activity',
  grouping = 'month',
  gap = false,
  dense = false,
  emptySelection = false,
  state = 'ready',
}: {
  area?: 'repository' | 'contributors' | 'companies' | 'person' | 'company';
  sample?: ContributionSampleScenario;
  kind?: 'prs' | 'issues';
  family?: 'activity' | 'snapshot';
  grouping?: TimelineGrouping;
  gap?: boolean;
  dense?: boolean;
  emptySelection?: boolean;
  state?: 'ready' | 'loading' | 'error';
}) {
  const [recovered, recover] = useState(false);
  const contributions = contributionTimelineSample(sample, gap);
  const request = {
    grouping: dense || family === 'snapshot' ? ('day' as const) : grouping,
    range:
      family === 'snapshot'
        ? {
            start: '2026-10-11T00:00:00.000Z',
            end: '2026-10-22T00:00:00.000Z',
            endInclusive: false,
          }
        : dense
          ? {
              start: new Date(
                Date.parse('2026-10-24T00:00:00.000Z') - 499 * 86400000,
              ).toISOString(),
              end: contributions.contributions.asOf,
              endInclusive: true,
            }
          : contributions.contributions.range,
  };
  const repository = repositoryTimelineSample(kind, 'repo-prebidjs', sample, gap);
  const report = selectContributionTimeline(
    contributions,
    request,
    emptySelection
      ? {
          repositoryIds: [],
          actorTypes: ['human'],
          population: { kind: 'all' },
          excludedAccountIds: [],
        }
      : undefined,
    area === 'person'
      ? {
          kind: 'contributor',
          accountId:
            sample === 'large' || sample === 'coverage-gap'
              ? 'account-heavy-agent'
              : 'account-alice',
        }
      : area === 'company'
        ? { kind: 'company', companyId: 'company-acme' }
        : undefined,
  );
  return (
    <DashboardFrame navigation={<span>Prebid · Timeline reporting</span>}>
      {state === 'loading' ? (
        <EmptyState kind="loading" title="Loading timeline">
          Preparing the selected intervals.
        </EmptyState>
      ) : state === 'error' && !recovered ? (
        <EmptyState kind="error" title="Timeline could not load" onRetry={() => recover(true)}>
          The requested range remains unchanged. Try again.
        </EmptyState>
      ) : area === 'repository' ? (
        <RepositoryTimelineView
          report={selectRepositoryTimeline(repository, request, family)}
          navigation={repositoryPageNavigationSample(repository.repository)}
          href="/repos/prebidjs?timeline=1"
        />
      ) : (
        <ContributionTimelineView
          report={report}
          area={area === 'companies' || area === 'company' ? 'companies' : 'contributors'}
          href="/contributors?timeline=1"
          reportHref="/contributors"
        />
      )}
    </DashboardFrame>
  );
}
const meta = {
  title: 'Timelines/Layouts',
  component: Preview,
  parameters: { layout: 'fullscreen', nextjs: { appDirectory: true } },
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Repository: Story = {};
export const Issues: Story = { args: { kind: 'issues' } };
export const WeeklyIssues: Story = { args: { kind: 'issues', grouping: 'week' } };
export const HistoricalSnapshots: Story = { args: { family: 'snapshot' } };
export const Contributors: Story = { args: { area: 'contributors' } };
export const Companies: Story = { args: { area: 'companies' } };
export const Person: Story = { args: { area: 'person' } };
export const Company: Story = { args: { area: 'company' } };
export const Partial: Story = { args: { gap: true, grouping: 'quarter' } };
export const Missing: Story = { args: { sample: 'missing' } };
export const ZeroActivity: Story = { args: { sample: 'empty' } };
export const EmptySelection: Story = { args: { area: 'contributors', emptySelection: true } };
export const DenseRepository: Story = { args: { dense: true } };
export const DenseContributions: Story = {
  args: { dense: true, area: 'contributors', sample: 'large' },
};
export const Loading: Story = { args: { state: 'loading' } };
export const Error: Story = { args: { state: 'error' } };
