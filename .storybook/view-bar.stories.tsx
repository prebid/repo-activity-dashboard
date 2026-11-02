import { useState } from 'react';
import Link from 'next/link';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ChartPanel } from '../src/components/charts/chart-panel';
import { LinkPending } from '../src/components/navigation/link-pending';
import { PageHeader } from '../src/components/navigation/page-header';
import { ViewBar } from '../src/components/navigation/view-bar';
import { DisabledTab, TabCount, ViewTabs } from '../src/components/navigation/view-tabs';
import type { DataColumn } from '../src/components/tables/data-table';
import { LocalDataTable } from '../src/components/tables/local-data-table';
import {
  CompaniesIcon,
  ContributorsIcon,
  IssuesIcon,
  PullRequestsIcon,
  ReportIcon,
  TimelineIcon,
} from '../src/components/ui/icons';

const asOf = '2026-10-31T16:00:00.000Z';

function RecordTabs() {
  return (
    <ViewTabs label="Repository lists">
      <Link href="/repos/prebidjs?scope=current&metric=totalOpenPrs" aria-current="page">
        <PullRequestsIcon size={16} />
        Pull requests
        <TabCount unit="open" title="Current open count">
          137
        </TabCount>
        <LinkPending />
      </Link>
      <Link href="/repos/prebidjs?scope=current&metric=openIssues">
        <IssuesIcon size={16} />
        Issues
        <TabCount unit="open" title="Current open count">
          834
        </TabCount>
        <LinkPending />
      </Link>
      <Link href="/repos/prebidjs?timeline=1">
        <TimelineIcon size={16} />
        Timeline
        <LinkPending />
      </Link>
    </ViewTabs>
  );
}

/** Underline tabs for a set of subjects, with their counts; the current tab sits on the line. */
function TabsSpecimen() {
  return (
    <main className="max-w-6xl space-y-4">
      <h1 className="sr-only">View bar with record tabs</h1>
      <ViewBar>
        <RecordTabs />
      </ViewBar>
    </main>
  );
}

/** Subject tabs and a segmented view-mode switch share one 44px bar. */
function ViewModesSpecimen() {
  return (
    <main className="max-w-6xl space-y-6">
      <h1 className="sr-only">View bar with view modes</h1>
      <ViewBar>
        <ViewTabs label="Repository overview views" variant="segmented">
          <Link href="/repos" aria-current="page">
            <ReportIcon size={16} />
            Summary
            <LinkPending />
          </Link>
          <Link href="/repos?timeline=1">
            <TimelineIcon size={16} />
            Timeline
            <LinkPending />
          </Link>
        </ViewTabs>
      </ViewBar>
      <ViewBar>
        <ViewTabs label="Contribution reports">
          <Link href="/contributors" aria-current="page">
            <ContributorsIcon size={16} />
            Contributors
            <LinkPending />
          </Link>
          <Link href="/companies">
            <CompaniesIcon size={16} />
            Companies
            <LinkPending />
          </Link>
        </ViewTabs>
        <ViewTabs label="Report view" variant="segmented">
          <Link href="/contributors" aria-current="page">
            <ReportIcon size={16} />
            Report
            <LinkPending />
          </Link>
          <DisabledTab reason="This selection is too large for an Over time link. Narrow the filters or search and try again.">
            <TimelineIcon size={16} />
            Over time
          </DisabledTab>
        </ViewTabs>
      </ViewBar>
    </main>
  );
}

interface Row {
  id: string;
  repository: string;
  prs: number;
  issues: number;
}
const rows: Row[] = Array.from({ length: 40 }, (_, index) => ({
  id: 'repository-' + index,
  repository: 'Repository ' + (index + 1),
  prs: (index * 7) % 23,
  issues: (index * 11) % 31,
}));
const columns: DataColumn<Row>[] = [
  {
    id: 'repository',
    label: 'Repository',
    pinned: true,
    hideable: false,
    value: (row) => row.repository,
  },
  { id: 'prs', label: 'Open PRs', align: 'right', value: (row) => row.prs },
  { id: 'issues', label: 'Open issues', align: 'right', value: (row) => row.issues },
];
const sections = [
  { id: 'current-backlog', label: 'Current backlog' },
  { id: 'at-a-glance', label: 'At a glance' },
  { id: 'period-activity', label: 'Period activity' },
];

/**
 * A whole page: a stand-in masthead, the page header, and the view bar with record tabs and the
 * section chips, over three anchored panels. Scrolling keeps the masthead and the bar stuck, the
 * current chip follows the scroll, and at 600px and below a Sections menu replaces the chips.
 */
function SectionsSpecimen() {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <header className="sticky top-0 z-(--prebid-layer-masthead) flex h-(--shell-height) items-center bg-masthead px-8 text-masthead-foreground">
        <span className="font-display text-heading font-semibold">Repository activity</span>
      </header>
      <main className="px-8 pt-6 pb-24">
        <div className="grid grid-cols-1 gap-5">
          <PageHeader
            title="Prebid.js"
            asOf={asOf}
            breadcrumbs={[{ label: 'All repositories', href: '/repos' }]}
          />
          <ViewBar sections={sections}>
            <RecordTabs />
          </ViewBar>
          <LocalDataTable
            title="Current backlog"
            anchor="current-backlog"
            search="none"
            rows={rows}
            columns={columns}
            showColumnMenu={false}
          />
          <ChartPanel
            label="Repository charts"
            title="At a glance"
            anchor="at-a-glance"
            description="All matching PRs, across every page."
            content="bars"
            showLabel="Show charts"
            hideLabel="Hide charts"
            expanded={expanded}
            onExpandedChange={setExpanded}
          >
            <p className="text-body">Charts</p>
          </ChartPanel>
          <LocalDataTable
            title="Period activity"
            anchor="period-activity"
            search="none"
            rows={rows}
            columns={columns}
            showColumnMenu={false}
          />
        </div>
      </main>
    </>
  );
}

const meta = {
  title: 'Navigation/View bar',
  component: TabsSpecimen,
} satisfies Meta<typeof TabsSpecimen>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Tabs: Story = {};
export const ViewModes: Story = { render: () => <ViewModesSpecimen /> };
export const Sections: Story = {
  render: () => <SectionsSpecimen />,
  parameters: { layout: 'fullscreen' },
};
