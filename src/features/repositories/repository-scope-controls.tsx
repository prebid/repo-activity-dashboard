'use client';
import type { RepositoryPageSource } from '@/models/repository-page';
import type { DateRange } from '@/models/reporting-period';
import { resolveReportingPeriod } from '@/lib/presentation/reporting-period';
import {
  repositoryActivityMode,
  repositoryActivityPeriod,
  type RepositoryActivityMode,
} from '@/lib/presentation/repository-page-navigation';
import { TimeframeControl } from './timeframe-control';
import styles from './repository-controls.module.css';
export function RepositoryScopeControls({
  source,
  onChange,
}: {
  source: RepositoryPageSource;
  onChange: (mode: RepositoryActivityMode, range: DateRange) => void;
}) {
  const mode = repositoryActivityMode(source),
    period = repositoryActivityPeriod(source);
  return (
    <div className={styles.scopeControls}>
      <label className={styles.scopeSelect}>
        <span className="sr-only">Record scope</span>
        <select
          value={mode}
          onChange={(event) => onChange(event.target.value as RepositoryActivityMode, period.range)}
        >
          <option value="current">Current open</option>
          <option value="created">Created during period</option>
          <option value="completed">
            {source.kind === 'prs'
              ? 'Merged into ' + source.repository.primaryBranch
              : 'Closed during period'}
          </option>
        </select>
      </label>
      {mode !== 'current' && (
        <TimeframeControl
          label="Activity period"
          asOf={source.asOf}
          period={period}
          onChange={(selection) => {
            onChange(mode, resolveReportingPeriod(selection, source.asOf).range);
            return undefined;
          }}
        />
      )}
    </div>
  );
}
