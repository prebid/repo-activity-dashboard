import Link from 'next/link';
import type { MouseEventHandler, ReactNode } from 'react';
import { BackIcon, DataAsOfIcon, NextIcon, SampleDataIcon } from '@/components/ui/icons';
import { reportingDataIsSample } from '@/config/reporting';
import { formatAsOf } from '@/lib/presentation/format';
import { LinkPending } from './link-pending';
import styles from './page-header.module.css';

/** A link to a view above this one. */
export interface PageHeaderCrumb {
  label: string;
  href: string;
  /** For a link whose navigation a feature's handler starts; `pending` then reports it. */
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  pending?: boolean;
}

export interface PageHeaderProps {
  /** The page's one h1. */
  title: string;
  /** The reporting snapshot the "Data as of" chip states. */
  asOf: string;
  /** Links to the views above this one, outermost first; the back icon leads the first. */
  breadcrumbs?: readonly PageHeaderCrumb[];
  /** The current view's name, unlinked after the links, where it is not the title. */
  current?: string;
  /** The breadcrumb navigation's name. */
  breadcrumbLabel?: string;
  /** The subject's avatar beside the title, inside the same header. */
  identity?: ReactNode;
  /** The one meta line under the title: plain facts and links at one size. */
  meta?: ReactNode;
  /** Labels the report as prepared sample data; the reporting configuration decides by default. */
  sampleData?: boolean;
}

/**
 * The page header: an optional breadcrumb row, the title flush left with an optional identity
 * and one meta line, and the "Sample data" and "Data as of" chips on the right. The breadcrumb and meta rows have
 * fixed heights, so sibling views with the same header keep everything below it in place.
 */
export function PageHeader({
  title,
  asOf,
  breadcrumbs = [],
  current,
  breadcrumbLabel = 'Breadcrumb',
  identity,
  meta,
  sampleData = reportingDataIsSample,
}: PageHeaderProps) {
  return (
    <header className={styles.header}>
      {breadcrumbs.length > 0 && (
        <nav className={styles.crumbs} aria-label={breadcrumbLabel}>
          <ol>
            {breadcrumbs.map((crumb, index) => (
              <li key={crumb.href + ' ' + crumb.label}>
                {index > 0 && <NextIcon size={14} />}
                <Link prefetch={false} href={crumb.href} onClick={crumb.onClick}>
                  {index === 0 && <BackIcon size={14} />}
                  {crumb.label}
                  <LinkPending pending={crumb.pending || undefined} />
                </Link>
              </li>
            ))}
            {current && (
              <li>
                <NextIcon size={14} />
                <span aria-current="page">{current}</span>
              </li>
            )}
          </ol>
        </nav>
      )}
      <div className={styles.subject}>
        {identity}
        <div className={styles.text}>
          <h1 className={styles.title}>{title}</h1>
          {meta && <div className={styles.meta}>{meta}</div>}
        </div>
      </div>
      <aside className={styles.source} aria-label="Data source">
        {sampleData && (
          <p className={styles.sample}>
            <SampleDataIcon size={14} />
            Sample data
          </p>
        )}
        <p className={styles.chip}>
          <DataAsOfIcon size={14} />
          <span className={styles.chipLabel}>Data as of</span>{' '}
          <time dateTime={asOf}>{formatAsOf(asOf)}</time>
        </p>
      </aside>
    </header>
  );
}
