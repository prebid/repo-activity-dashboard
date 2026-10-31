import { viewTabsClassName } from '@/components/navigation/view-tabs';
import Link from 'next/link';
import type { TimelineSupportContext } from '@/models/timeline-support';
import { timelineMetricLabel, timelineMetricUnit } from '@/lib/presentation/timeline-metric-label';
import { timelineIntervalDescription } from '@/lib/presentation/timeline-presentation';
import { MeasurementValue } from '@/components/metrics/measurement-value';
import { formatAsOf } from '@/lib/presentation/format';
import styles from './timeline-layout.module.css';
export function TimelineSupportFrame({
  context,
  title,
  contribution = false,
  children,
  authorBack,
}: {
  context: TimelineSupportContext;
  title: string;
  contribution?: boolean;
  children: React.ReactNode;
  authorBack?: string | null;
}) {
  return (
    <>
      <nav className={viewTabsClassName} aria-label="Supporting view navigation">
        <Link prefetch={false} href={context.parentHref}>
          ← Back to timeline
        </Link>
        {authorBack && (
          <Link prefetch={false} href={authorBack}>
            ← Back to authors
          </Link>
        )}
      </nav>
      <header>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className={styles.dates}>Reporting snapshot: {formatAsOf(context.source.asOf)}</p>
      </header>
      <section className={styles.scope} aria-label="Supporting interval scope">
        <div className={styles.scopeMain}>
          <strong>{timelineMetricLabel(context.metric, contribution)}</strong>
          <span>
            Timeline value:{' '}
            <MeasurementValue
              measurement={context.measurement}
              unit={timelineMetricUnit(context.metric, contribution)}
            />
          </span>
        </div>
        <p className={styles.dates}>{timelineIntervalDescription(context.interval)}</p>
        {context.interval.partial && (
          <span className={styles.partial}>Partial calendar period</span>
        )}
      </section>
      {context.measurement.status !== 'complete' && (
        <aside className={styles.notice} aria-label="Supporting data coverage">
          {context.measurement.reason} Only known matching records are shown.
        </aside>
      )}
      {children}
    </>
  );
}
