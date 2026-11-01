import { DisabledTab, ViewTabs } from '@/components/navigation/view-tabs';
import { LinkPending } from '@/components/navigation/link-pending';
import Link from 'next/link';
import { ArrowUpRight, CalendarDays, Table2 } from 'lucide-react';
import { formatAsOf } from '@/lib/presentation/format';
import styles from './overview.module.css';
import heading from './repository-heading.module.css';

export function AllRepositoriesHeading({ asOf }: { asOf: string }) {
  return (
    <div className={`${heading.layout} ${styles.pageHeader}`}>
      <div className={heading.identity}>
        <h1 className={styles.title}>All repositories</h1>
        <a
          href="https://github.com/prebid"
          target="_blank"
          rel="noopener noreferrer"
          className={`${styles.organizationLink} focus-ring`}
        >
          Prebid on GitHub
          <ArrowUpRight size={13} aria-hidden="true" />
        </a>
      </div>
      <p className={`${heading.aside} ${styles.asOf}`}>
        <strong>Reporting snapshot</strong>
        {formatAsOf(asOf)}
      </p>
    </div>
  );
}
export function AllRepositoriesTabs({
  active,
  summaryHref,
  timelineHref,
}: {
  active: 'summary' | 'timeline';
  summaryHref: string;
  timelineHref: string | null;
}) {
  return (
    <ViewTabs label="Repository overview views">
      <Link
        prefetch={false}
        href={summaryHref}
        aria-current={active === 'summary' ? 'page' : undefined}
      >
        <Table2 size={16} aria-hidden="true" />
        Summary
        <LinkPending />
      </Link>
      {timelineHref ? (
        <Link
          prefetch={false}
          href={timelineHref}
          aria-current={active === 'timeline' ? 'page' : undefined}
        >
          <CalendarDays size={16} aria-hidden="true" />
          Timeline
          <LinkPending />
        </Link>
      ) : (
        <DisabledTab reason="This view is too large for a timeline link. Reduce the selection and try again.">
          Timeline
        </DisabledTab>
      )}
    </ViewTabs>
  );
}
