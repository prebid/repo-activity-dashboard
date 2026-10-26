'use client';
import Link from 'next/link';
import type { TableController } from '@/lib/presentation/table-controller';
import { DataTable, type DataColumn } from '@/components/tables/data-table';
import { MetricValue } from '@/components/metrics/metric-value';
import type { PullRequestRow, IssueRow } from '@/models/reporting';
export const prColumns: DataColumn<PullRequestRow>[] = [
  { id: 'number', label: 'PR', value: (r) => r.number },
  {
    id: 'title',
    label: 'Title',
    value: (r) => r.title,
    cell: (r) => (
      <Link
        prefetch={false}
        className="underline underline-offset-4"
        href={r.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {r.title}
        {r.draft ? ' (Draft)' : ''}
      </Link>
    ),
  },
  { id: 'author', label: 'Author', value: (r) => r.author },
  { id: 'humanReviewers', label: 'Human reviewers', value: (r) => r.humanReviewers },
  {
    id: 'approvals',
    label: 'Current human approvals',
    value: (r) => r.approvals,
    cell: (r) => <MetricValue value={r.approvals} />,
  },
  { id: 'ageDays', label: 'Age in days', value: (r) => r.ageDays },
];
export const issueColumns: DataColumn<IssueRow>[] = [
  { id: 'number', label: 'Issue', value: (r) => r.number },
  {
    id: 'title',
    label: 'Title',
    value: (r) => r.title,
    cell: (r) => (
      <Link
        prefetch={false}
        className="underline underline-offset-4"
        href={r.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {r.title}
      </Link>
    ),
  },
  { id: 'author', label: 'Author', value: (r) => r.author },
  { id: 'ageDays', label: 'Age in days', value: (r) => r.ageDays },
];
export function RepositoryView({
  name,
  slug,
  prs,
  issues,
  view,
  controller,
  age,
}: {
  name: string;
  slug: string;
  prs: PullRequestRow[];
  issues: IssueRow[];
  view: 'prs' | 'issues';
  controller: TableController;
  age: number | null;
}) {
  const visiblePrs = age === null ? prs : prs.filter((r) => !r.draft && r.ageDays > age);
  return (
    <>
      <Link prefetch={false} href="/repos" className="text-sm underline underline-offset-4">
        All repositories
      </Link>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{name}</h1>
        <p className="mt-2 text-muted-foreground">
          Current open items · Sample records link to fictional GitHub fixtures
        </p>
      </div>
      <nav aria-label="Repository lists" className="flex gap-4">
        <Link
          prefetch={false}
          aria-current={view === 'prs' ? 'page' : undefined}
          className="underline underline-offset-4"
          href={'/repos/' + slug + '?view=prs'}
        >
          Pull requests ({prs.length})
        </Link>
        <Link
          prefetch={false}
          aria-current={view === 'issues' ? 'page' : undefined}
          className="underline underline-offset-4"
          href={'/repos/' + slug + '?view=issues'}
        >
          Issues ({issues.length})
        </Link>
      </nav>
      {age !== null && view === 'prs' && (
        <p>
          Non-draft PRs older than {age} days ·{' '}
          <Link prefetch={false} className="underline" href={'/repos/' + slug + '?view=prs'}>
            Clear age filter
          </Link>
        </p>
      )}
      {view === 'issues' ? (
        <DataTable
          title="Open issues"
          rows={issues}
          columns={issueColumns}
          controller={controller}
        />
      ) : (
        <DataTable
          title="Open pull requests"
          rows={visiblePrs}
          columns={prColumns}
          controller={controller}
        />
      )}
    </>
  );
}
