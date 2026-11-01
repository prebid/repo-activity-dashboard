import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from '../src/components/ui/button';
import {
  AccountTypeIcon,
  PopulationIcon,
  RepositoriesIcon,
  TimelineIcon,
  type IconComponent,
} from '../src/components/ui/icons';
import {
  ReportToolbar,
  type ReportToolbarGroup,
  type ReportToolbarProps,
} from '../src/components/reporting/report-toolbar';

// The toolbar is layout only; these triggers stand in for each report's field components.
function Trigger({ icon: Icon, children }: { icon: IconComponent; children: ReactNode }) {
  return (
    <Button type="button" variant="secondary">
      <Icon size={14} />
      {children}
    </Button>
  );
}
const filters: ReportToolbarGroup = {
  label: 'Filters',
  controls: (
    <>
      <Trigger icon={RepositoriesIcon}>18 repositories</Trigger>
      <Trigger icon={AccountTypeIcon}>All account types</Trigger>
      <Trigger icon={PopulationIcon}>All accounts</Trigger>
    </>
  ),
  reset: { label: 'Reset filters', onReset: () => {} },
};
const display: ReportToolbarGroup = {
  label: 'Display',
  controls: (
    <>
      <Trigger icon={TimelineIcon}>This year</Trigger>
      <Trigger icon={TimelineIcon}>Monthly intervals</Trigger>
    </>
  ),
  reset: { label: 'Reset view', onReset: () => {} },
};
const summary = {
  lead: 'Jan 1, 2026 – Oct 31, 2026 · UTC',
  facts: ['10 intervals', '1,204 accounts with activity'],
};

// Each story names an example, so the args stay plain values while the controls are elements.
const examples = {
  oneGroup: {
    label: 'Contribution report scope',
    disabled: false,
    groups: [filters],
    status: { kind: 'saved' },
    summary,
  },
  twoGroups: {
    label: 'Timeline scope',
    disabled: false,
    groups: [filters, display],
    status: { kind: 'saved' },
    summary,
  },
  updating: {
    label: 'Contribution report scope',
    disabled: true,
    groups: [filters],
    status: { kind: 'updating', subject: 'report' },
    summary,
  },
  notSaved: {
    label: 'Contribution report scope',
    disabled: false,
    groups: [filters],
    status: { kind: 'not-saved' },
    summary,
  },
  withNotice: {
    label: 'Contribution report scope',
    disabled: false,
    groups: [filters],
    status: { kind: 'saved' },
    notice: {
      tone: 'info',
      text: 'Saved filters could not be restored, so the report shows its defaults.',
    },
    summary,
  },
  withError: {
    label: 'Timeline scope',
    disabled: false,
    groups: [filters, display],
    status: { kind: 'saved' },
    notice: {
      tone: 'error',
      text: 'The selected range is longer than 24 months. Choose a shorter range.',
    },
    footnote:
      'Changing Records or Measure clears record filters. Grouping and period changes retain them.',
    summary,
  },
} as const satisfies Record<string, ReportToolbarProps>;

function Specimen({ example }: { example: keyof typeof examples }) {
  return (
    <div className="max-w-5xl">
      <ReportToolbar {...examples[example]} />
    </div>
  );
}

const meta = { title: 'Reporting/Report toolbar', component: Specimen } satisfies Meta<
  typeof Specimen
>;
export default meta;
type Story = StoryObj<typeof meta>;
export const OneGroup: Story = { args: { example: 'oneGroup' } };
export const TwoGroups: Story = { args: { example: 'twoGroups' } };
export const Updating: Story = { args: { example: 'updating' } };
export const NotSaved: Story = { args: { example: 'notSaved' } };
export const WithNotice: Story = { args: { example: 'withNotice' } };
export const WithError: Story = { args: { example: 'withError' } };
