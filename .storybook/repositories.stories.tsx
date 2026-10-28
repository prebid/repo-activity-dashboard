import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AllRepositoriesView } from '../src/features/repositories/all-repositories-view';
import { useLocalTableController } from '../src/components/tables/local-data-table';
import { DashboardFrame } from '../src/components/layout/dashboard-frame';
import { DashboardHeader } from '../src/components/layout/dashboard-header';
import { ThemeMenu } from '../src/components/layout/theme-menu';
import { PageState } from '../src/components/feedback/page-state';
import { repositoryOverviewSample } from '../src/mocks/repository-overview';
import { repositoryCatalog } from '../src/config/repositories';

function OverviewPreview({
  showChange = false,
  state = 'normal',
}: {
  showChange?: boolean;
  state?: 'normal' | 'empty' | 'loading' | 'error';
}) {
  const backlog = useLocalTableController();
  const activity = useLocalTableController();
  const data = repositoryOverviewSample(undefined, state === 'empty' ? [] : undefined);
  return (
    <DashboardFrame
      navigation={
        <DashboardHeader
          repositories={repositoryCatalog}
          activePath="/repos"
          accountControls={<ThemeMenu />}
        />
      }
    >
      {state === 'loading' ? (
        <PageState title="Loading repository overview…" />
      ) : state === 'error' ? (
        <PageState title="Could not load repository overview">Please try again.</PageState>
      ) : (
        <AllRepositoriesView
          data={data}
          backlogController={backlog}
          activityController={activity}
          showChange={showChange}
        />
      )}
    </DashboardFrame>
  );
}
const meta = {
  title: 'Repositories/All repositories',
  component: OverviewPreview,
  parameters: { layout: 'fullscreen', nextjs: { appDirectory: true } },
} satisfies Meta<typeof OverviewPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Overview: Story = {};
export const WithChanges: Story = { args: { showChange: true } };
export const Empty: Story = { args: { state: 'empty' } };
export const Loading: Story = { args: { state: 'loading' } };
export const Error: Story = { args: { state: 'error' } };
