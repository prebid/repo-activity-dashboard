'use client';
import { useTableController } from '@/lib/navigation/use-table-controller';
import type { RepositoryRecordList } from '@/models/repository-records';
import {
  RepositoryRecordsView,
  recordPrColumns,
  recordIssueColumns,
} from '@/features/repositories/repository-records-view';
const prIds = recordPrColumns.map((column) => column.id),
  issueIds = recordIssueColumns.map((column) => column.id);
const newest = { sort: 'createdAt', descending: true };
export function RepositoryRecordsScreen({
  viewerId,
  list,
}: {
  viewerId: string;
  list: RepositoryRecordList;
}) {
  const controller = useTableController({
    queryKey: list.kind,
    scopeKey: 'repository:' + list.repository.slug + ':' + list.kind,
    viewerId,
    columnIds: list.kind === 'prs' ? prIds : issueIds,
    defaultSort: newest,
  });
  return <RepositoryRecordsView list={list} controller={controller} />;
}
