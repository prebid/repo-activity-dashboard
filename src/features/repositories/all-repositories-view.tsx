'use client';
import { formatAsOf } from '@/lib/presentation/format';
import Link from 'next/link';
import { DataTable, type DataColumn } from '@/components/tables/data-table';
import { MetricValue } from '@/components/metrics/metric-value';
import type { RepositorySummary } from '@/models/reporting';
export interface SummaryRow extends RepositorySummary {
  id: string;
  name: string;
  slug: string;
}
const columns: DataColumn<SummaryRow>[] = [
  {
    id: 'name',
    label: 'Repository',
    value: (r) => r.name,
    cell: (r) => (
      <Link
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
      <Link className="underline underline-offset-4" href={'/repos/' + r.slug + '?view=prs'}>
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
      <Link className="underline underline-offset-4" href={'/repos/' + r.slug + '?view=issues'}>
        <MetricValue value={r.openIssues} />
      </Link>
    ),
  },
  {
    id: 'agedPrs',
    label: 'PRs older than 60 days',
    value: (r) => r.agedPrs,
    cell: (r) => (
      <Link className="underline underline-offset-4" href={'/repos/' + r.slug + '?view=prs&age=60'}>
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
  initialSearch,
  viewerId,
  asOf,
}: {
  rows: SummaryRow[];
  initialSearch: string;
  viewerId?: string;
  asOf: string;
}) {
  return (
    <>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">All repositories</h1>
        <p className="mt-2 text-muted-foreground">
          Current backlog · Prepared sample as of {formatAsOf(asOf)}
        </p>
      </div>
      <DataTable
        title="Current backlog"
        rows={rows}
        columns={columns}
        queryKey="repos"
        viewerId={viewerId}
        initialSearch={initialSearch}
      />
    </>
  );
}
