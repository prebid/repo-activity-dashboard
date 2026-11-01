'use client';
import type { ComponentProps } from 'react';
import { DialogContent } from './dialog';
import styles from './scrollable-dialog.module.css';

/** Header and actions stay visible while the labelled choices region scrolls. */
/** No className: like DialogContent under rule 3, its look comes from the primitive. */
export function ScrollableDialogContent(
  props: Omit<ComponentProps<typeof DialogContent>, 'size' | 'className'>,
) {
  return <DialogContent size="md" className={styles.frame} {...props} />;
}
export function ScrollableDialogBody({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.body} role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}
