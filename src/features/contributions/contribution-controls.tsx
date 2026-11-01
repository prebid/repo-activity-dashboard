'use client';
import type { ContributionOptions } from '@/models/contribution-options';
import { RepositorySelector } from '@/components/reporting/repository-selector';
import { TimeframeControl } from '@/components/reporting/timeframe-control';
import {
  reportToolbarStatus,
  type ReportToolbarControls,
  type ReportToolbarGroup,
} from '@/components/reporting/report-toolbar';
import { resolveReportingPeriod } from '@/lib/presentation/reporting-period';
import type {
  ContributionControlDirectory,
  ContributionSettings,
} from '@/models/contribution-settings';
import type { ContributionSettingField } from '@/lib/presentation/contribution-settings';
import { AccountTypeFilter } from './account-type-filter';
import { PopulationSelector } from './population-selector';

export interface ContributionControlsProps {
  directory: ContributionControlDirectory;
  options: ContributionOptions;
  value: ContributionSettings;
  asOf: string;
  pending: boolean;
  onChange: (value: ContributionSettings, field: ContributionSettingField) => string | void;
}

/** The shared report filters as a toolbar group; its reset restores the default filters. */
export function contributionFilterGroup({
  onReset,
  ...props
}: ContributionControlsProps & { onReset: () => void }): ReportToolbarGroup {
  return {
    label: 'Report filters',
    controls: <ContributionControls {...props} />,
    reset: { label: 'Reset filters', onReset },
  };
}

/** A contribution report's toolbar: the filters, their status line and any restore notice. */
export function contributionToolbar({
  storageAvailable,
  notice,
  ...props
}: ContributionControlsProps & {
  onReset: () => void;
  storageAvailable: boolean;
  notice?: string;
}): ReportToolbarControls {
  return {
    disabled: props.pending,
    groups: [contributionFilterGroup(props)],
    status: reportToolbarStatus(props.pending, storageAvailable, 'report'),
    notice: notice ? { tone: 'info', text: notice } : undefined,
  };
}

/** The report filters' fields, laid out by the report toolbar that frames them. */
export function ContributionControls({
  directory,
  options,
  value,
  asOf,
  pending,
  onChange,
}: ContributionControlsProps) {
  return (
    <>
      <TimeframeControl
        label="Reporting period"
        period={resolveReportingPeriod(value.period, asOf)}
        asOf={asOf}
        onChange={(period) => onChange({ ...value, period }, 'period') || undefined}
      />
      <RepositorySelector
        repositories={directory.repositories}
        selected={value.selection.repositoryIds}
        description="This selection applies to this report and its company and contributor breakdowns."
        onApply={(repositoryIds) =>
          onChange({ ...value, selection: { ...value.selection, repositoryIds } }, 'repositoryIds')
        }
      />
      <AccountTypeFilter
        selected={value.selection.actorTypes}
        pending={pending}
        onApply={(actorTypes) =>
          onChange({ ...value, selection: { ...value.selection, actorTypes } }, 'actorTypes')
        }
      />
      <PopulationSelector
        options={options}
        selected={value.selection}
        onApply={(population) =>
          onChange({ ...value, selection: { ...value.selection, ...population } }, 'population')
        }
      />
    </>
  );
}
