'use client';
import { useState } from 'react';
import { DataTable } from '@/components/tables/data-table';
import type { TableController } from '@/lib/presentation/table-controller';
import { recordListTitle } from '@/lib/presentation/repository-records';
import { repositoryRecordColumnDefaults } from '@/lib/presentation/repository-page-preferences';
import type { MergedPullRequestList } from '@/models/repository-insights';
import { repositoryMergedPrColumns, repositoryInlineColumnIds } from './repository-page-columns';
import pageStyles from './repository-page.module.css';
export { actorLabels, recordPrColumns, recordIssueColumns } from './record-base-columns';

const menuColumns = repositoryMergedPrColumns.filter(
  (column) => !repositoryInlineColumnIds.has(column.id),
);
/** The merge-duration insight's merged PRs, in the record pages' row. */
export function RepositoryRecordTable({
  list,
  controller,
  title: titleOverride,
  showMergeDuration = false,
}: {
  list: MergedPullRequestList;
  controller: TableController;
  title?: string;
  showMergeDuration?: boolean;
}) {
  const selection = list.drilldown.selection;
  const [visible, setVisible] = useState<Record<string, boolean>>(() => ({
    ...repositoryRecordColumnDefaults(selection),
    mergeDays: showMergeDuration,
  }));
  const visibility = { value: visible, onChange: setVisible };
  const title = titleOverride ?? recordListTitle(selection, list.author?.account);
  return (
    <div className={pageStyles.records}>
      <DataTable
        search="local"
        title={title}
        rows={list.rows}
        columns={repositoryMergedPrColumns}
        columnMenuColumns={menuColumns}
        controller={controller}
        visibility={visibility}
        itemLabel={{ singular: 'PR', plural: 'PRs' }}
        footerNote="Sample record links are placeholders. Reviewers and current approvals are separate measures."
      />
    </div>
  );
}
