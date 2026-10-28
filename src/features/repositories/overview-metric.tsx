import Link from 'next/link';
import { MeasurementValue } from '@/components/metrics/measurement-value';
import type { Count, OverviewRepository } from '@/models/repository-overview';
import type { DrilldownSelection } from '@/models/repository-drilldown';
import { isRecordSelection } from '@/lib/presentation/repository-records';
import { repositoryDrilldownHref } from '@/lib/presentation/repository-drilldown';
import { formatCount } from '@/lib/presentation/format';
import styles from './overview.module.css';

export function OverviewMetric({
  repository,
  measurement,
  selection,
  label,
  returnTo,
}: {
  repository: OverviewRepository;
  measurement: Count;
  selection: DrilldownSelection;
  label: string;
  returnTo: string;
}) {
  const value = <MeasurementValue measurement={measurement} />;
  if (measurement.value === null || !isRecordSelection(selection)) return value;
  return (
    <Link
      prefetch={false}
      className={styles.metricLink}
      href={repositoryDrilldownHref(repository, { selection, returnTo })}
      aria-label={
        repository.name +
        ': ' +
        label +
        ', ' +
        formatCount(measurement.value) +
        (measurement.status === 'partial' ? ' (partial)' : '')
      }
    >
      {value}
    </Link>
  );
}
