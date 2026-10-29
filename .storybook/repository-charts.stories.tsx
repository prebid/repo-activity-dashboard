import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { RepositoryCharts } from '../src/features/repositories/repository-charts';
import { repositoryPageSample } from '../src/mocks/repository-page';
import { repositoryOverviewSamples } from '../src/mocks/repository-overview';
import { selectRepositoryPage } from '../src/lib/presentation/repository-page';
import { toggleChartSelection } from '../src/lib/presentation/repository-chart-selection';
import { defaultRepositoryFilters } from '../src/lib/presentation/repository-page-query';
import { DashboardFrame } from '../src/components/layout/dashboard-frame';
const samples = repositoryOverviewSamples(),
  repo = samples.repositories[0].repository;
function Preview({ activity = false }: { activity?: boolean }) {
  const [filters, setFilters] = useState(() => defaultRepositoryFilters('prs')),
    [visible, setVisible] = useState(true);
  const source = repositoryPageSample(repo, {
    selection: activity
      ? { scope: 'period', metric: 'prsOpened', range: samples.periods[2].period.range }
      : { scope: 'current', metric: 'totalOpenPrs' },
    returnTo: '/repos',
  });
  const page = selectRepositoryPage(source, filters);
  return (
    <DashboardFrame navigation={<span>Prebid · Sample repository charts</span>}>
      <RepositoryCharts
        page={page}
        visible={visible}
        onVisibilityChange={setVisible}
        onSelect={(selection) => setFilters(toggleChartSelection(filters, selection))}
      />
      <p role="status">{page.rows.length} matching records across all table pages</p>
    </DashboardFrame>
  );
}
const meta = {
  title: 'Reports/Repository charts',
  component: Preview,
  render: (args) => <Preview key={String(args.activity)} {...args} />,
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Current: Story = {};
export const Activity: Story = { args: { activity: true } };
