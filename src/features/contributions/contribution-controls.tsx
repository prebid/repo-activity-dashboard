'use client';
import { Button } from '@/components/ui/button';
import { RepositorySelector } from '@/components/reporting/repository-selector';
import { TimeframeControl } from '@/components/reporting/timeframe-control';
import { resolveReportingPeriod } from '@/lib/presentation/reporting-period';
import type { ContributionDirectory, ContributionSettings } from '@/models/contribution-settings';
import { AccountTypeFilter } from './account-type-filter';
import { PopulationSelector } from './population-selector';
import styles from './contribution-controls.module.css';
export function ContributionControls({
  directory,
  value,
  asOf,
  pending,
  storageAvailable,
  notice,
  onChange,
  onReset,
}: {
  directory: ContributionDirectory;
  value: ContributionSettings;
  asOf: string;
  pending: boolean;
  storageAvailable: boolean;
  notice?: string;
  onChange: (value: ContributionSettings) => void;
  onReset: () => void;
}) {
  return (
    <div className={styles.controls}>
      <fieldset className={styles.bar} disabled={pending} aria-label="Report filters">
        <TimeframeControl
          label="Reporting period"
          period={resolveReportingPeriod(value.period, asOf)}
          asOf={asOf}
          onChange={(period) => {
            onChange({ ...value, period });
            return undefined;
          }}
        />
        <RepositorySelector
          repositories={directory.repositories}
          selected={value.selection.repositoryIds}
          description="This selection applies to this report and its company and contributor breakdowns."
          onApply={(repositoryIds) =>
            onChange({ ...value, selection: { ...value.selection, repositoryIds } })
          }
        />
        <AccountTypeFilter
          selected={value.selection.actorTypes}
          pending={pending}
          onApply={(actorTypes) =>
            onChange({ ...value, selection: { ...value.selection, actorTypes } })
          }
        />
        <PopulationSelector
          directory={directory}
          selected={value.selection}
          onApply={(population) =>
            onChange({ ...value, selection: { ...value.selection, ...population } })
          }
        />
        <Button variant="ghost" size="sm" onClick={onReset}>
          Reset filters
        </Button>
      </fieldset>
      <p className={styles.note} role="status">
        {notice && <span>{notice} </span>}
        {pending
          ? 'Updating report…'
          : storageAvailable
            ? 'Preferences saved for your account on this browser.'
            : 'Browser storage is unavailable. Your filters still work in this URL.'}
      </p>
    </div>
  );
}
