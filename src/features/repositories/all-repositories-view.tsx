'use client';
import { useMemo } from 'react';
import { Info, RotateCcw } from 'lucide-react';
import { DataTable } from '@/components/tables/data-table';
import { ColumnMenu } from '@/components/tables/column-menu';
import { agingColumnId, agingThresholdForColumn } from '@/lib/presentation/overview-aging';
import { PageState } from '@/components/feedback/page-state';
import { Button } from '@/components/ui/button';
import type { TableController } from '@/lib/presentation/table-controller';
import {
  agingThresholds,
  type OverviewRepository,
  type RepositoryOverview,
} from '@/models/repository-overview';
import type { OverviewSettings, OverviewSettingsControl } from '@/models/overview-settings';
import { formatAsOf } from '@/lib/presentation/format';
import { backlogColumns, activityColumns, columnVisibilityFromIds } from './overview-columns';
import { RepositorySelector } from './repository-selector';
import { ActivityPeriodControls } from './activity-period-controls';
import { activityTableRows } from '@/lib/presentation/overview-periods';
import styles from './overview.module.css';
import controls from './overview-controls.module.css';

export function AllRepositoriesView({
  data,
  secondaryData,
  repositories,
  settings,
  backlogController,
  activityController,
}: {
  data: RepositoryOverview;
  secondaryData?: RepositoryOverview;
  repositories: readonly OverviewRepository[];
  settings: OverviewSettingsControl;
  backlogController: TableController;
  activityController: TableController;
}) {
  const { ageThresholds } = settings.value;
  const backlog = useMemo(() => backlogColumns(), []);
  const activity = useMemo(() => activityColumns(), []);
  const backlogVisibility = useMemo(
    () =>
      columnVisibilityFromIds(backlog, [
        ...settings.value.backlogColumns,
        ...ageThresholds.map(agingColumnId),
      ]),
    [backlog, settings.value.backlogColumns, ageThresholds],
  );
  const activityVisibility = useMemo(
    () => columnVisibilityFromIds(activity, settings.value.activityColumns),
    [activity, settings.value.activityColumns],
  );
  const ageColumns = useMemo(
    () => backlog.filter((column) => agingThresholdForColumn(column.id) !== undefined),
    [backlog],
  );
  function changeBacklogVisibility(value: Record<string, boolean>) {
    const selected = agingThresholds.filter((days) => value[agingColumnId(days)] !== false);
    const patch: Partial<OverviewSettings> = {
      backlogColumns: backlog
        .filter(
          (column) =>
            agingThresholdForColumn(column.id) === undefined && value[column.id] !== false,
        )
        .map((column) => column.id),
    };
    if (selected.join(',') !== ageThresholds.join(',')) patch.ageThresholds = selected;
    settings.update(patch);
  }
  const rows = useMemo(
    () =>
      data.rows
        .map((row) => ({ ...row, id: row.repository.id }))
        .sort((a, b) => a.repository.name.localeCompare(b.repository.name, 'en')),
    [data.rows],
  );
  const activityRows = useMemo(() => activityTableRows(data, secondaryData), [data, secondaryData]);
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
      <div className={controls.bar} aria-label="Repository view settings" role="region">
        <RepositorySelector
          repositories={repositories}
          selected={settings.value.repositoryIds}
          onApply={(repositoryIds) => settings.update({ repositoryIds })}
        />
        <Button variant="ghost" className={controls.control} onClick={settings.reset}>
          <RotateCcw size={14} aria-hidden="true" />
          Reset view
        </Button>
        <p className={controls.preferenceNote} role="status">
          {settings.storageAvailable
            ? 'Settings are saved per account in this browser.'
            : 'Settings apply for this visit only.'}
        </p>
      </div>
      {settings.notice && (
        <p role="status" className={controls.notice}>
          {settings.notice}
        </p>
      )}
      {!rows.length ? (
        <PageState title="No repositories selected">
          Choose repositories above to show their backlog and activity.
        </PageState>
      ) : (
        <>
          <DataTable
            title="Current backlog"
            searchable={false}
            rows={rows}
            columns={backlog}
            controller={backlogController}
            itemLabel="repositories"
            showSinglePageControls={false}
            controls={
              <ColumnMenu
                columns={ageColumns}
                visibility={{ value: backlogVisibility, onChange: changeBacklogVisibility }}
                label="PR age"
                title="PR age thresholds"
                allowEmpty
              />
            }
            description={
              <span className={styles.scope}>
                <span className={styles.scopeLabel}>Open now</span>
                <span>· Age, reviews and approvals exclude drafts</span>
              </span>
            }
            visibility={{ value: backlogVisibility, onChange: changeBacklogVisibility }}
            footerNote="0 / 1 / 2 are exact approval counts. Additional detail is available in Columns."
          />
          <DataTable
            title="Period activity"
            searchable={false}
            rows={activityRows}
            columns={activity}
            controller={activityController}
            itemLabel={secondaryData ? 'period rows' : 'repositories'}
            showSinglePageControls={false}
            rowClassName={(row) => (row.periodIndex === 1 ? styles.secondaryPeriod : undefined)}
            description={
              data.rows.length + ' repositories · ' + (secondaryData ? '2 periods' : '1 period')
            }
            headerContent={
              <ActivityPeriodControls
                primary={data}
                secondary={secondaryData}
                onChange={(periods) => settings.update({ periods })}
              />
            }
            visibility={{
              value: activityVisibility,
              onChange: (value) =>
                settings.update({
                  activityColumns: activity
                    .filter((column) => value[column.id] !== false)
                    .map((column) => column.id),
                }),
            }}
            footerNote={
              secondaryData
                ? 'Numeric columns sort by Period 1. Swap periods to rank by Period 2. Merges use each repository’s primary branch.'
                : 'Merges and merge time use each repository’s primary branch.'
            }
          />
          <p className={styles.legend}>
            <Info size={14} aria-hidden="true" />
            <span>
              — Not available or not applicable. * Partial data. Human feedback, current approvals,
              and agent/bot activity are measured separately.
            </span>
          </p>
        </>
      )}
    </>
  );
}
