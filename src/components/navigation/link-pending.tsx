'use client';
import { useLinkStatus } from 'next/link';
import styles from './link-pending.module.css';

/**
 * A bar along the bottom of the enclosing `next/link` while its navigation is pending. Render it
 * as the link's last child: `useLinkStatus` reads the link it sits in. `pending` replaces that
 * status for a link whose click handler navigates through the router instead.
 */
export function LinkPending({ pending }: { pending?: boolean }) {
  const status = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className={styles.indicator}
      data-link-pending=""
      data-pending={String(pending ?? status.pending)}
    />
  );
}
