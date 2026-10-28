'use client';
import { RepositoryView, prColumns, issueColumns } from '@/features/repositories/repository-view';
import { useTableController } from '@/lib/navigation/use-table-controller';
import type { PullRequestRow, IssueRow } from '@/models/reporting';
const prIds = prColumns.map((c) => c.id),
  issueIds = issueColumns.map((c) => c.id);
export function RepositoryScreen({
  viewerId,
  ...data
}: {
  viewerId: string;
  name: string;
  slug: string;
  prs: PullRequestRow[];
  issues: IssueRow[];
  view: 'prs' | 'issues';
  age: number | null;
  returnTo?: string;
}) {
  const controller = useTableController({
    queryKey: data.view,
    scopeKey: 'repository:' + data.slug + ':' + data.view,
    viewerId,
    columnIds: data.view === 'prs' ? prIds : issueIds,
  });
  return <RepositoryView key={controller.scopeKey} {...data} controller={controller} />;
}
