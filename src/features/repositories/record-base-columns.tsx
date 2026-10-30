'use client';
import Link from 'next/link';
import { GitHubAccountLink } from '@/components/github/account-link';
import type { DataColumn } from '@/components/tables/data-table';
import { MetricValue } from '@/components/metrics/metric-value';
import type { PullRequestRow, IssueRow } from '@/models/reporting';
export const prColumns: DataColumn<PullRequestRow>[] = [
  { id: 'number', selectionGroup: 'Identity', label: 'PR', value: (r) => r.number },
  {
    id: 'title',
    selectionGroup: 'Identity',
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
  {
    id: 'author',
    selectionGroup: 'Identity',
    label: 'Author',
    description:
      'The record author. The account link opens its GitHub profile; sample identities use placeholder destinations.',
    value: (r) => r.author,
    cell: (r) => <GitHubAccountLink login={r.author} url={r.authorUrl} />,
  },
  {
    id: 'humanReviewers',
    selectionGroup: 'Human review',
    label: 'Human reviewers',
    description:
      'Distinct non-author humans who commented, inline-commented or requested changes. Repeated participation counts once; approvals remain separate.',
    value: (r) => r.humanReviewers,
  },
  {
    id: 'approvals',
    selectionGroup: 'Human review',
    label: 'Current human approvals',
    description:
      'Distinct human accounts with an effective approval at the reporting snapshot. Reapprovals do not multiply the current count.',
    value: (r) => r.approvals,
    cell: (r) => <MetricValue value={r.approvals} />,
  },
  {
    id: 'ageDays',
    selectionGroup: 'Dates and age',
    label: 'Age in days',
    description: 'Elapsed days since creation at the reporting snapshot.',
    value: (r) => r.ageDays,
  },
];
export const issueColumns: DataColumn<IssueRow>[] = [
  { id: 'number', selectionGroup: 'Identity', label: 'Issue', value: (r) => r.number },
  {
    id: 'title',
    selectionGroup: 'Identity',
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
  {
    id: 'author',
    selectionGroup: 'Identity',
    label: 'Author',
    description:
      'The record author. The account link opens its GitHub profile; sample identities use placeholder destinations.',
    value: (r) => r.author,
    cell: (r) => <GitHubAccountLink login={r.author} url={r.authorUrl} />,
  },
  {
    id: 'ageDays',
    selectionGroup: 'Dates and age',
    label: 'Age in days',
    description: 'Elapsed days since creation at the reporting snapshot.',
    value: (r) => r.ageDays,
  },
];
