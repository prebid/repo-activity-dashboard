import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DashboardFrame } from '../src/components/layout/dashboard-frame';
import { RepositoryTimelineMatrixView } from '../src/features/repositories/repository-timeline-matrix-view';
import {
  repositoryTimelineMatrixSample,
  type RepositoryTimelineScenario,
} from '../src/mocks/repository-timeline';
import { selectRepositoryTimelineMatrix } from '../src/lib/presentation/repository-timeline-matrix';
import {
  repositoryTimelineMetricScope,
  type RepositoryTimelineMetric,
} from '../src/models/repository-timeline';
import type { TimelineGrouping } from '../src/models/reporting-timeline';
function Preview({
  sample = 'reference',
  metric = 'prsOpened',
  grouping = 'month',
  dense = false,
  empty = false,
}: {
  sample?: RepositoryTimelineScenario;
  metric?: RepositoryTimelineMetric;
  grouping?: TimelineGrouping;
  dense?: boolean;
  empty?: boolean;
}) {
  const scope = repositoryTimelineMetricScope(metric),
    source = repositoryTimelineMatrixSample(scope.recordKind, sample);
  const matrix = selectRepositoryTimelineMatrix(
    source,
    {
      grouping: dense || scope.family === 'snapshot' ? 'day' : grouping,
      range:
        scope.family === 'snapshot'
          ? {
              start: '2026-10-11T00:00:00.000Z',
              end: '2026-10-22T00:00:00.000Z',
              endInclusive: false,
            }
          : {
              start: dense ? '2025-06-12T00:00:00.000Z' : '2026-01-01T00:00:00.000Z',
              end: source.asOf,
              endInclusive: true,
            },
    },
    { metric, repositoryIds: empty ? [] : source.repositories.map((row) => row.repository.id) },
  );
  return (
    <DashboardFrame navigation={<span>Prebid · Timeline reporting</span>}>
      <RepositoryTimelineMatrixView matrix={matrix} href="/repos?timeline=1" summaryHref="/repos" />
    </DashboardFrame>
  );
}
const meta = {
  title: 'Timelines/Repository matrix',
  component: Preview,
  parameters: { layout: 'fullscreen', nextjs: { appDirectory: true } },
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Monthly: Story = {};
export const Weekly: Story = { args: { grouping: 'week' } };
export const MixedCoverage: Story = { args: { sample: 'mixed', grouping: 'quarter' } };
export const MergeDuration: Story = { args: { metric: 'medianMergeDays' } };
export const IssueActivity: Story = { args: { metric: 'issuesClosed' } };
export const HistoricalBacklog: Story = { args: { sample: 'mixed', metric: 'totalOpenPrs' } };
export const Dense: Story = { args: { dense: true, sample: 'large' } };
export const NoRepositories: Story = { args: { empty: true } };
export const KnownZero: Story = { args: { sample: 'empty' } };
export const Unavailable: Story = { args: { sample: 'missing' } };
