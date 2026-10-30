'use client';
import { useClientReady } from '@/lib/navigation/use-client-ready';
import { ChevronDown } from 'lucide-react';
import type { RepositoryPageSource } from '@/models/repository-page';
import type { DateRange } from '@/models/reporting-period';
import { resolveReportingPeriod } from '@/lib/presentation/reporting-period';
import {
  repositoryActivityMode,
  repositoryActivityPeriod,
  type RepositoryActivityMode,
} from '@/lib/presentation/repository-page-navigation';
import { TimeframeControl } from '@/components/reporting/timeframe-control';
import styles from './repository-controls.module.css';
export function RepositoryScopeControls({
  source,
  onChange,
}: {
  source: RepositoryPageSource;
  onChange: (mode: RepositoryActivityMode, range: DateRange) => void;
}) {
  const ready = useClientReady();
  const mode = repositoryActivityMode(source),
    period = repositoryActivityPeriod(source);
  return (
    <div className={styles.scopeControls}>
      <label className={styles.scopeSelect}>
        <span className="sr-only">Record scope</span>
        <select
          disabled={!ready}
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
        <ChevronDown size={14} className={styles.scopeChevron} aria-hidden="true" />
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
