'use client';
import Link from 'next/link';
import type { DataColumn } from '@/components/tables/data-table';
import { MetricValue } from '@/components/metrics/metric-value';
import type { PullRequestRow, IssueRow } from '@/models/reporting';
export const prColumns: DataColumn<PullRequestRow>[] = [
  { id: 'number', label: 'PR', value: (r) => r.number },
  {
    id: 'title',
    label: 'Title',
    value: (r) => r.title + (r.draft ? ' (Draft)' : ''),
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
