import type { ReactNode } from 'react';
import { timelineGroupingLabels, type TimelineRequest } from '@/models/reporting-timeline';
import { periodRangeLabel } from '@/lib/presentation/overview-periods';
import styles from './timeline-layout.module.css';
export function TimelineScope({
  request,
  count,
  children,
}: {
  request: TimelineRequest;
  count: number;
  children?: ReactNode;
}) {
  return (
    <section aria-label="Timeline scope" className={styles.scope}>
      <div className={styles.scopeMain}>
        <span className={styles.grouping}>{timelineGroupingLabels[request.grouping]}</span>
        <strong>{periodRangeLabel(request.range)}</strong>
        <span className={styles.dates}>
          UTC · {count} {count === 1 ? 'interval' : 'intervals'}
        </span>
      </div>
      <div className={styles.scopeMeta}>{children}</div>
    </section>
  );
}
