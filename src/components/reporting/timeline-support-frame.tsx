import { viewTabsClassName } from '@/components/navigation/view-tabs';
import { LinkPending } from '@/components/navigation/link-pending';
import Link from 'next/link';
import type { TimelineSupportContext } from '@/models/timeline-support';
import { timelineMetricLabel, timelineMetricUnit } from '@/lib/presentation/timeline-metric-label';
import { zonedRangeLabel } from '@/lib/presentation/overview-periods';
import { MeasurementValue } from '@/components/metrics/measurement-value';
import { BackIcon } from '@/components/ui/icons';
import { Callout } from '@/components/feedback/callout';
import { formatAsOf } from '@/lib/presentation/format';
import { PartialPeriodMarker } from './timeline-value';
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
          <BackIcon size={14} />
          Back to timeline
          <LinkPending />
        </Link>
        {authorBack && (
          <Link prefetch={false} href={authorBack}>
            <BackIcon size={14} />
            Back to authors
            <LinkPending />
          </Link>
        )}
      </nav>
      <header>
        <h1 className="text-2xl">{title}</h1>
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
        <p className={styles.dates}>{zonedRangeLabel(context.interval.covered)}</p>
        {context.interval.partial && <PartialPeriodMarker />}
      </section>
      {context.measurement.status !== 'complete' && (
        <Callout tone="warning" as="aside" aria-label="Supporting data coverage">
          {context.measurement.reason} Only known matching records are shown.
        </Callout>
      )}
      {children}
    </>
  );
}
