import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ChartCell, ChartCells, ChartPanel } from '../src/components/charts/chart-panel';
import { SelectableBars, type SelectableBar } from '../src/components/charts/selectable-bars';
import { DataLegend } from '../src/components/feedback/data-legend';

function bars(prefix: string, values: readonly number[], labels: readonly string[]) {
  return values.map((value, index): SelectableBar => ({
    id: prefix + index,
    label: labels[index],
    detail: labels[index],
    count:
      index === 2
        ? { status: 'partial', value, reason: 'Partial history' }
        : { status: 'complete', value },
    selected: false,
  }));
}
const charts = [
  {
    title: 'Age distribution',
    total: 48,
    context: 'Age since creation · Current open',
    points: bars('age', [21, 14, 8, 5], ['<7 d', '7–30 d', '30–90 d', '>90 d']),
  },
  {
    title: 'Human reviewers',
    total: 48,
    context: 'Non-draft PRs · 3 drafts excluded',
    points: bars('reviewers', [12, 25, 11], ['0 reviewers', '1 reviewer', '2+ reviewers']),
  },
  {
    title: 'Current human approvals',
    total: 48,
    context: 'Non-draft PRs · 3 drafts excluded',
    points: bars('approvals', [30, 12, 6], ['0 approvals', '1 approval', '2+ approvals']),
  },
] as const;

function Specimen({ expanded: initial }: { expanded: boolean }) {
  const [expanded, setExpanded] = useState(initial);
  return (
    <div className="max-w-5xl">
      <ChartPanel
        label="Repository charts"
        title="At a glance"
        description="All matching PRs, across every page. Select a bar to filter; select it again to clear."
        content="bars"
        showLabel="Show charts"
        hideLabel="Hide charts"
        expanded={expanded}
        onExpandedChange={setExpanded}
      >
        <ChartCells>
          {charts.map((chart) => (
            <ChartCell
              key={chart.title}
              title={chart.title}
              total={chart.total}
              unit="PRs"
              context={chart.context}
              footer={<DataLegend marks={['partial']} />}
            >
              <SelectableBars
                label={chart.title + ' values'}
                points={[...chart.points]}
                onSelect={() => {}}
              />
            </ChartCell>
          ))}
        </ChartCells>
      </ChartPanel>
    </div>
  );
}

const meta = { title: 'Charts/Chart panel', component: Specimen } satisfies Meta<typeof Specimen>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Collapsed: Story = { args: { expanded: false } };
export const Expanded: Story = { args: { expanded: true } };
