import { useId, type ReactNode } from 'react';
import styles from './view-tabs.module.css';

export const viewTabsClassName = styles.tabs;
export function ViewTabs({ label, children }: { label: string; children: ReactNode }) {
  return (
    <nav className={styles.tabs} aria-label={label}>
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
