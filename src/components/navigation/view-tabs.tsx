import { useId, type ReactNode } from 'react';
import styles from './view-tabs.module.css';

/**
 * underline: a set of subjects, such as Pull requests | Issues | Timeline or Contributors |
 * Companies. segmented: modes of one view, such as Summary | Timeline or Report | Over time.
 */
export type ViewTabsVariant = 'underline' | 'segmented';

export const viewTabsClassName = styles.tabs;
/** Tabs never wrap: a row wider than its space scrolls sideways. */
export function ViewTabs({
  label,
  variant = 'underline',
  children,
}: {
  label: string;
  variant?: ViewTabsVariant;
  children: ReactNode;
}) {
  return (
    <nav className={styles.tabs} data-variant={variant} aria-label={label}>
      {children}
    </nav>
  );
}
/** An unavailable tab stays focusable so keyboard and screen-reader users get its reason. */
export function DisabledTab({ children, reason }: { children: ReactNode; reason: string }) {
  const id = useId();
  return (
    <>
      <span
        role="link"
        aria-disabled="true"
        tabIndex={0}
        aria-describedby={id}
        title={reason}
        className={styles.disabled}
      >
        {children}
      </span>
      <span id={id} className="sr-only">
        {reason}
      </span>
    </>
  );
}
/**
 * A tab's count, after its label and before its LinkPending: muted on the header band, in the
 * selection tint on the current tab. `unit` follows the value, such as "open".
 */
export function TabCount({
  children,
  unit,
  title,
}: {
  children: ReactNode;
  unit?: string;
  title?: string;
}) {
  // The space before the pill keeps the count a separate word in the tab's name ("Pull requests
  // 137 open"); the tab's gap draws it.
  return (
    <>
      {' '}
      <span className={styles.count} title={title}>
        {children}
        {unit && ' ' + unit}
      </span>
    </>
  );
}
