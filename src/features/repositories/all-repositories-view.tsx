'use client';
import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { DataTable } from '@/components/tables/data-table';
import type { TableController } from '@/lib/presentation/table-controller';
import type { AgingThreshold, RepositoryOverview } from '@/models/repository-overview';
import { formatAsOf, formatUtcDate } from '@/lib/presentation/format';
import {
  backlogColumns,
  activityColumns,
  defaultBacklogColumns,
  defaultActivityColumns,
  initialColumnVisibility,
} from './overview-columns';
import styles from './overview.module.css';

const periodLabels = {
  'this-week': 'This week',
  'last-week': 'Last week',
  'this-month': 'This month',
  'last-month': 'Last month',
  'this-year': 'This year to date',
  'last-year-to-date': 'Last year to the same date',
  'last-full-year': 'Last full year',
};

export function AllRepositoriesView({
  data,
  backlogController,
  activityController,
  ageDays = 30,
  showChange = false,
}: {
  data: RepositoryOverview;
  backlogController: TableController;
  activityController: TableController;
  ageDays?: AgingThreshold;
  showChange?: boolean;
}) {
  const backlog = useMemo(() => backlogColumns(ageDays), [ageDays]);
  const activity = useMemo(() => activityColumns(showChange), [showChange]);
  const [backlogVisibility, setBacklogVisibility] = useState(() =>
    initialColumnVisibility(backlog, defaultBacklogColumns),
  );
  const [activityVisibility, setActivityVisibility] = useState(() =>
    initialColumnVisibility(activity, defaultActivityColumns),
  );
  const rows = useMemo(
    () =>
      data.rows
        .map((row) => ({ ...row, id: row.repository.id }))
        .sort((a, b) => a.repository.name.localeCompare(b.repository.name, 'en')),
    [data.rows],
  );
  const range = data.period.range;
  const periodLabel =
    data.period.selection.kind === 'preset'
      ? periodLabels[data.period.selection.preset]
      : 'Custom range';
  const periodDates =
    formatUtcDate(range.start) +
    ' – ' +
    formatUtcDate(
      new Date(new Date(range.end).getTime() - (range.endInclusive ? 0 : 1)).toISOString(),
    );
  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Repository overview</p>
          <h1 className={styles.title}>All repositories</h1>
          <p className={styles.subtitle}>
            Current work and recent activity, across {data.rows.length} repositories.
          </p>
        </div>
        <p className={styles.asOf}>
          <strong>Reporting snapshot</strong>
          {formatAsOf(data.asOf)}
        </p>
      </div>
      <DataTable
        title="Current backlog"
        rows={rows}
        columns={backlog}
        controller={backlogController}
        itemLabel="repositories"
        showSinglePageControls={false}
        description={
          <span className={styles.scope}>
            <span className={styles.scopeLabel}>Open now</span>
            <span>· Aging over {ageDays} days · Reviews and approvals exclude drafts</span>
          </span>
        }
        visibility={{ value: backlogVisibility, onChange: setBacklogVisibility }}
        footerNote="0 / 1 / 2 are exact approval counts. Additional detail is available in Columns."
      />
      <DataTable
        title="Period activity"
        rows={rows}
        columns={activity}
        controller={activityController}
        itemLabel="repositories"
        showSinglePageControls={false}
        description={
          <span className={styles.scope}>
            <span className={styles.scopeLabel}>{periodLabel}</span>
            <span>
              · {periodDates} · UTC{showChange ? ' · Change shown below each value' : ''}
            </span>
          </span>
        }
        visibility={{ value: activityVisibility, onChange: setActivityVisibility }}
        footerNote="Merges and merge time use each repository’s primary branch."
      />
      <p className={styles.legend}>
        <Info size={14} aria-hidden="true" />
        <span>
          — Not available or not applicable. * Partial data. Human feedback, current approvals, and
          agent/bot activity are measured separately.
        </span>
      </p>
    </>
  );
}
