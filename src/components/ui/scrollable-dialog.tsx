'use client';
import type { ComponentProps } from 'react';
import { DialogContent } from './dialog';
import { cn } from '@/lib/utils';
import styles from './scrollable-dialog.module.css';

/** Header and actions stay visible while the labelled choices region scrolls. */
export function ScrollableDialogContent({
  className,
  ...props
}: ComponentProps<typeof DialogContent>) {
  return <DialogContent className={cn(styles.frame, className)} {...props} />;
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
