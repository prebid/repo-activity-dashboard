import { Children, cloneElement, isValidElement, useId, type ReactNode } from 'react';
import styles from './view-tabs.module.css';

/**
 * Wraps each text label among a tab's children in a span that also lays out an invisible bold
 * copy, so the tab is as wide as its current (bold) state whether or not it is current. Icons,
 * counts and the pending bar are elements and stay as they are.
 */
function reserveBoldLabels(tabs: ReactNode): ReactNode {
  return Children.map(tabs, (tab) =>
    isValidElement<{ children?: ReactNode }>(tab)
      ? cloneElement(
          tab,
          undefined,
          Children.map(tab.props.children, (child) =>
            typeof child === 'string' && child.trim() ? (
              <span className={styles.label} data-label={child}>
                {child}
              </span>
            ) : (
              child
            ),
          ),
        )
      : tab,
  );
}

/**
 * underline: a set of subjects, such as Pull requests | Issues | Timeline or Contributors |
 * Companies. segmented: modes of one view, such as Summary | Timeline or Report | Over time.
 */
export type ViewTabsVariant = 'underline' | 'segmented';

/**
 * Tabs never wrap: a row wider than its space scrolls sideways. A tab's text labels are its
 * string children; each keeps its bold width, so marking another tab current moves no tab.
 */
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
      {reserveBoldLabels(children)}
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
