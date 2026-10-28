import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { RepositoryRecordsView } from '../src/features/repositories/repository-records-view';
import { useLocalTableController } from '../src/components/tables/local-data-table';
import { DashboardFrame } from '../src/components/layout/dashboard-frame';
import { repositoryRecordSample } from '../src/mocks/repository-records';
import { repositoryOverviewSamples } from '../src/mocks/repository-overview';
import type { RecordSelection } from '../src/models/repository-records';
const samples = repositoryOverviewSamples();
function Preview({
  scenario = 'prs',
}: {
  scenario?: 'prs' | 'merged' | 'issues' | 'empty' | 'partial' | 'missing';
}) {
  const slug =
    scenario === 'partial'
      ? 'prebid-cache-java'
      : scenario === 'missing'
        ? 'prebid-agent-skills'
        : 'prebidjs';
  const repo = samples.repositories.find((row) => row.repository.slug === slug)!.repository;
  const selection: RecordSelection =
    scenario === 'merged'
      ? {
          scope: 'period',
          metric: 'prsMerged',
          branch: repo.primaryBranch,
          range: samples.periods[2].period.range,
        }
      : scenario === 'empty'
        ? { scope: 'current', metric: 'agedPrs', ageDays: 180 }
        : {
            scope: 'current',
            metric:
              scenario === 'issues'
                ? 'openIssues'
                : scenario === 'partial'
                  ? 'agentFeedbackPrs'
                  : scenario === 'missing'
                    ? 'humanApprovals0'
                    : 'totalOpenPrs',
          };
  const controller = useLocalTableController({
    search: '',
    sort: 'createdAt',
    descending: true,
    page: 1,
  });
  return (
    <DashboardFrame navigation={<span>Prebid · Sample repository detail</span>}>
      <RepositoryRecordsView
        list={repositoryRecordSample(repo, { selection, returnTo: '/repos' })}
        controller={controller}
      />
    </DashboardFrame>
  );
}
const meta = {
  title: 'Repositories/Record lists',
  component: Preview,
  parameters: { layout: 'fullscreen', nextjs: { appDirectory: true } },
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const OpenPRs: Story = {};
export const Merged: Story = { args: { scenario: 'merged' } };
export const Issues: Story = { args: { scenario: 'issues' } };
export const Empty: Story = { args: { scenario: 'empty' } };
export const Partial: Story = { args: { scenario: 'partial' } };
export const Missing: Story = { args: { scenario: 'missing' } };
