import Link from 'next/link';
import { MeasurementValue } from '@/components/metrics/measurement-value';
import type { OverviewRepository } from '@/models/repository-overview';
import type { Measurement } from '@/models/reporting-measurement';
import type { DrilldownSelection } from '@/models/repository-drilldown';
import { repositoryDrilldownHref } from '@/lib/presentation/repository-drilldown';
import { formatMeasure } from '@/lib/presentation/format';
import styles from './overview.module.css';

export function OverviewMetric({
  repository,
  measurement,
  selection,
  label,
  returnTo,
  unit = 'count',
  detail,
}: {
  repository: OverviewRepository;
  measurement: Measurement;
  selection: DrilldownSelection;
  label: string;
  returnTo: string;
  unit?: 'count' | 'days';
  detail?: string;
}) {
  const value = <MeasurementValue measurement={measurement} unit={unit} detail={detail} />;
  if (measurement.value === null) return value;
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
        formatMeasure(measurement.value, unit) +
        (measurement.status === 'partial' ? ' (partial)' : '')
      }
    >
      {value}
    </Link>
  );
}
