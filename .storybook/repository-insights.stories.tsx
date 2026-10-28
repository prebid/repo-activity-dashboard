import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { RepositoryInsightsView } from '../src/features/repositories/repository-insights-view';
import { useLocalTableController } from '../src/components/tables/local-data-table';
import { DashboardFrame } from '../src/components/layout/dashboard-frame';
import { repositoryInsightSample } from '../src/mocks/repository-insights';
import { repositoryOverviewSamples } from '../src/mocks/repository-overview';
import type { InsightMetric } from '../src/models/repository-insights';
const samples = repositoryOverviewSamples();
function Preview({
  metric = 'prAuthors',
  state = 'normal',
}: {
  metric?: InsightMetric;
  state?: 'normal' | 'empty' | 'missing' | 'partial';
}) {
  const repo = samples.repositories.find(
    (row) => row.repository.slug === (state === 'empty' ? 'prebid-mobile-ios-sdk' : 'prebidjs'),
  )!.repository;
  const range =
    state === 'missing'
      ? { start: '2026-10-01T00:00:00.000Z', end: '2026-10-02T00:00:00.000Z', endInclusive: false }
      : samples.periods[2].period.range;
  const insight = repositoryInsightSample(repo, {
    selection: {
      scope: 'period',
      metric,
      range,
      ...(metric === 'medianMergeDays' ? { branch: repo.primaryBranch } : {}),
    },
    returnTo: '/repos',
  });
  if (state === 'partial' && insight.measurement.value !== null)
    insight.measurement = {
      status: 'partial',
      value: insight.measurement.value,
      reason: 'Only part of the prepared sample is available.',
    };
  const controller = useLocalTableController();
  return (
    <DashboardFrame navigation={<span>Prebid · Sample repository detail</span>}>
      <RepositoryInsightsView insight={insight} controller={controller} />
    </DashboardFrame>
  );
}
const meta = {
  title: 'Repositories/Supporting details',
  component: Preview,
  parameters: { layout: 'fullscreen', nextjs: { appDirectory: true } },
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const PrAuthors: Story = {};
export const IssueAuthors: Story = { args: { metric: 'issueAuthors' } };
export const AgentReviewers: Story = { args: { metric: 'agentFeedbackCredits' } };
export const AgentApprovals: Story = { args: { metric: 'agentApprovalCredits' } };
export const BotReviewers: Story = { args: { metric: 'botFeedbackCredits' } };
export const BotApprovals: Story = { args: { metric: 'botApprovalCredits' } };
export const MergeDuration: Story = { args: { metric: 'medianMergeDays' } };
export const EmptyAuthors: Story = { args: { state: 'empty' } };
export const NoMerges: Story = { args: { metric: 'medianMergeDays', state: 'empty' } };
export const Missing: Story = { args: { state: 'missing' } };
export const Partial: Story = { args: { state: 'partial' } };
