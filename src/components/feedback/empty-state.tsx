import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  EmptyIcon,
  ErrorIcon,
  LoadingIcon,
  MissingIcon,
  NoMatchIcon,
  RetryIcon,
} from '@/components/ui/icons';
import styles from './empty-state.module.css';

/**
 * empty: a known result with nothing in it. no-match: rows exist but the query hides them all.
 * missing: the data is not available, which is never shown as an empty result.
 */
export const emptyStateKinds = ['empty', 'no-match', 'missing', 'error', 'loading'] as const;
export type EmptyStateKind = (typeof emptyStateKinds)[number];

const kindIcons = {
  empty: EmptyIcon,
  'no-match': NoMatchIcon,
  missing: MissingIcon,
  error: ErrorIcon,
  loading: LoadingIcon,
} as const;

export interface EmptyStateProps {
  kind: EmptyStateKind;
  title: string;
  /** The description under the title. */
  children?: ReactNode;
  /** Shows "Try again" and makes the state an alert. */
  onRetry?: () => void;
  /** An existing next step, such as a Clear filters button or a Return to report link. */
  action?: ReactNode;
  /** page: a framed card that replaces content; embedded: unframed, inside a panel or table. */
  variant?: 'page' | 'embedded';
}

export function EmptyState({
  kind,
  title,
  children,
  onRetry,
  action,
  variant = 'page',
}: EmptyStateProps) {
  const Icon = kindIcons[kind];
  return (
    <section
      className={styles.state}
      data-kind={kind}
      data-variant={variant}
      role={onRetry ? 'alert' : 'status'}
    >
      <span className={styles.tile}>
        <Icon size={16} />
      </span>
      <h2 className={styles.title}>{title}</h2>
      {children && <div className={styles.description}>{children}</div>}
      {(action || onRetry) && (
        <div className={styles.actions}>
          {action}
          {onRetry && (
            <Button type="button" variant="primary" onClick={onRetry}>
              <RetryIcon size={14} />
              Try again
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
