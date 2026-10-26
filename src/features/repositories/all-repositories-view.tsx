'use client';
import Link from 'next/link';
import { DataTable, type DataColumn } from '@/components/tables/data-table';
import { MetricValue } from '@/components/metrics/metric-value';
import type { RepositorySummaryRow as SummaryRow } from '@/models/reporting';
import type { TableController } from '@/lib/presentation/table-controller';
export const repositorySummaryColumns: DataColumn<SummaryRow>[] = [
  {
    id: 'name',
    label: 'Repository',
    value: (r) => r.name,
    cell: (r) => (
      <Link
        prefetch={false}
        className="font-medium text-primary underline underline-offset-4"
        href={'/repos/' + r.slug}
      >
        {r.name}
      </Link>
    ),
  },
  {
    id: 'openPrs',
    label: 'Total open PRs',
    value: (r) => r.openPrs,
    cell: (r) => (
      <Link
        prefetch={false}
        className="underline underline-offset-4"
        href={'/repos/' + r.slug + '?view=prs'}
      >
        <MetricValue value={r.openPrs} />
      </Link>
    ),
  },
  { id: 'draftPrs', label: 'Draft PRs', value: (r) => r.draftPrs },
  { id: 'ready', label: 'Non-draft PRs', value: (r) => r.openPrs - r.draftPrs },
  {
    id: 'openIssues',
    label: 'Open issues',
    value: (r) => r.openIssues,
    cell: (r) => (
      <Link
        prefetch={false}
        className="underline underline-offset-4"
        href={'/repos/' + r.slug + '?view=issues'}
      >
        <MetricValue value={r.openIssues} />
      </Link>
    ),
  },
  {
    id: 'agedPrs',
    label: 'PRs older than 60 days',
    value: (r) => r.agedPrs,
    cell: (r) => (
      <Link
        prefetch={false}
        className="underline underline-offset-4"
        href={'/repos/' + r.slug + '?view=prs&age=60'}
      >
        {r.agedPrs}
      </Link>
    ),
  },
  {
    id: 'approvals',
    label: 'PRs with human approval',
    value: (r) => r.approvals,
    cell: (r) => <MetricValue value={r.approvals} />,
  },
];
export function AllRepositoriesView({
  rows,
  controller,
  asOfLabel,
}: {
  rows: SummaryRow[];
  controller: TableController;
  asOfLabel: string;
}) {
  return (
    <>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">All repositories</h1>
        <p className="mt-2 text-muted-foreground">
          Current backlog · Prepared sample as of {asOfLabel}
        </p>
      </div>
      <DataTable
        title="Current backlog"
        rows={rows}
        columns={repositorySummaryColumns}
        controller={controller}
      />
    </>
  );
}
