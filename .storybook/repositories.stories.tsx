import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AllRepositoriesView } from '../src/features/repositories/all-repositories-view';
import { useLocalTableController } from '../src/components/tables/local-data-table';
import { DashboardFrame } from '../src/components/layout/dashboard-frame';
import { DashboardHeader } from '../src/components/layout/dashboard-header';
import { ThemeMenu } from '../src/components/layout/theme-menu';
import { LayoutWidthToggle } from '../src/components/layout/layout-width';
import { PageState } from '../src/components/feedback/page-state';
import { repositoryOverviewSamples } from '../src/mocks/repository-overview';
import type { OverviewSettings } from '../src/models/overview-settings';
import { defaultOverviewSettings } from '../src/lib/presentation/overview-settings';
import { selectOverviewSample } from '../src/lib/presentation/overview-samples';
import { overviewSettingsColumns } from '../src/features/repositories/overview-columns';
import { initialTableQuery } from '../src/lib/presentation/table-controller';
import { withOverviewSort } from '../src/lib/presentation/overview-sort';
import { repositoryCatalog } from '../src/config/repositories';

const samples = repositoryOverviewSamples();
const repositories = samples.repositories.map((row) => row.repository);
const definition = {
  ...overviewSettingsColumns,
  repositoryIds: repositories.map((repo) => repo.id),
};
const defaultsForPreview = defaultOverviewSettings(definition);
function OverviewPreview({
  twoPeriods = false,
  state = 'normal',
  administration = false,
}: {
  twoPeriods?: boolean;
  state?: 'normal' | 'empty' | 'loading' | 'error';
  administration?: boolean;
}) {
  const backlog = useLocalTableController();
  const activity = useLocalTableController();
  const [settings, setSettings] = useState<OverviewSettings>(() => ({
    ...defaultOverviewSettings(definition),
    periods: twoPeriods
      ? [defaultsForPreview.periods[0], { kind: 'preset', preset: 'last-month' }]
      : defaultsForPreview.periods,
    repositoryIds: state === 'empty' ? [] : definition.repositoryIds,
  }));
  const data = selectOverviewSample(samples, settings.periods[0], settings.repositoryIds);
  return (
    <DashboardFrame
      navigation={
        <DashboardHeader
          repositories={repositoryCatalog}
          activePath="/repos"
          administration={administration}
          accountControls={
            <>
              <LayoutWidthToggle />
              <ThemeMenu />
            </>
          }
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
          secondaryData={
            settings.periods.length === 2
              ? selectOverviewSample(samples, settings.periods[1], settings.repositoryIds)
              : undefined
          }
          backlogController={withOverviewSort(backlog, 'backlog', settings)}
          activityController={withOverviewSort(activity, 'activity', settings)}
          repositories={repositories}
          settings={{
            value: settings,
            update: (patch) => setSettings((previous) => ({ ...previous, ...patch })),
            storageAvailable: false,
            reset: () => {
              setSettings(defaultOverviewSettings(definition));
              backlog.update(initialTableQuery);
              activity.update(initialTableQuery);
            },
          }}
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
export const TwoPeriods: Story = { args: { twoPeriods: true } };
export const Administration: Story = { args: { administration: true } };
export const Empty: Story = { args: { state: 'empty' } };
export const Loading: Story = { args: { state: 'loading' } };
export const Error: Story = { args: { state: 'error' } };
