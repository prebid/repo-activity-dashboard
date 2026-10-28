import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { RepositoryRecordsView } from '../src/features/repositories/repository-records-view';
import { useLocalTableController } from '../src/components/tables/local-data-table';
import { DashboardFrame } from '../src/components/layout/dashboard-frame';
import { repositoryAuthorRecordSample } from '../src/mocks/repository-insights';
import { repositoryOverviewSamples } from '../src/mocks/repository-overview';
import { repositoryAuthorsHref } from '../src/lib/presentation/repository-author-records';
const samples = repositoryOverviewSamples();
const repo = samples.repositories.find((row) => row.repository.slug === 'prebidjs')!.repository;
const range = samples.periods.find(
  ({ period }) => period.selection.kind === 'preset' && period.selection.preset === 'this-year',
)!.period.range;
function Preview({ kind = 'prs' }: { kind?: 'prs' | 'issues' }) {
  const drilldown = {
    selection: {
      scope: 'period' as const,
      metric: kind === 'prs' ? ('prAuthors' as const) : ('issueAuthors' as const),
      range,
    },
    returnTo: '/repos?period=this-year',
  };
  const controller = useLocalTableController({
    search: '',
    sort: 'createdAt',
    descending: true,
    page: 1,
  });
  const back = repositoryAuthorsHref(repo, drilldown, {
    search: 'sample-author-2',
    sort: 'recordCount',
    descending: true,
    page: 1,
  });
  return (
    <DashboardFrame navigation={<span>Prebid · High-volume author sample</span>}>
      <RepositoryRecordsView
        list={repositoryAuthorRecordSample(repo, drilldown, 'sample-author-2', back)}
        controller={controller}
      />
    </DashboardFrame>
  );
}
const meta = {
  title: 'Repositories/Author records',
  component: Preview,
  parameters: { layout: 'fullscreen', nextjs: { appDirectory: true } },
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const PullRequests: Story = {};
export const Issues: Story = { args: { kind: 'issues' } };
