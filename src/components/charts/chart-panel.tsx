'use client';
import { useId, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { DisclosureChevron } from '@/components/ui/disclosure-chevron';
import { AtAGlanceChartIcon, TrendChartIcon } from '@/components/ui/icons';
import styles from './chart-panel.module.css';

const contentIcons = { bars: AtAGlanceChartIcon, trend: TrendChartIcon } as const;

export interface ChartPanelProps {
  /** The region name, such as "Repository charts". */
  label: string;
  title: string;
  description: ReactNode;
  /** bars: a set of bar charts; trend: one chart over time. Picks the trigger's icon. */
  content: keyof typeof contentIcons;
  /** Trigger text in each state, such as "Show charts" and "Hide charts". */
  showLabel: string;
  hideLabel: string;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  disabled?: boolean;
  /** Rendered only while expanded, so collapsed charts measure and draw nothing. */
  children: ReactNode;
}

/** One disclosure panel for chart content: title and caption, a ghost trigger, then the body. */
export function ChartPanel({
  label,
  title,
  description,
  content,
  showLabel,
  hideLabel,
  expanded,
  onExpandedChange,
  disabled = false,
  children,
}: ChartPanelProps) {
  const id = useId();
  const Icon = contentIcons[content];
  return (
    <section className={styles.panel} aria-label={label} data-expanded={expanded}>
      <div className={styles.heading}>
        <div className={styles.text}>
          <h2 className={styles.title}>{title}</h2>
          <p className={styles.description}>{description}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          aria-expanded={expanded}
          aria-controls={id}
          disabled={disabled}
          onClick={() => onExpandedChange(!expanded)}
        >
          <Icon size={14} />
          {expanded ? hideLabel : showLabel}
          <DisclosureChevron />
        </Button>
      </div>
      <div id={id} className={styles.body} hidden={!expanded}>
        {expanded && children}
      </div>
    </section>
  );
}

/** Chart cells inside a panel, divided by subtle lines instead of nested cards. */
export function ChartCells({ children }: { children: ReactNode }) {
  return <div className={styles.cells}>{children}</div>;
}

export interface ChartCellProps {
  title: string;
  /** The cell's total, at number weight; omitted when the chart reports no total. */
  total?: ReactNode;
  /** The unit after the total, such as "PRs". */
  unit?: string;
  /** One caption line under the title: the range, basis or exclusions. */
  context?: ReactNode;
  children: ReactNode;
  /** A legend or note under the chart. */
  footer?: ReactNode;
}

export function ChartCell({ title, total, unit, context, children, footer }: ChartCellProps) {
  return (
    <figure className={styles.cell} aria-label={title}>
      <figcaption className={styles.caption}>
        <strong className={styles.cellTitle}>{title}</strong>
        {total !== undefined && total !== null && (
          <span className={styles.total}>
            {total}
            {unit && <span className={styles.unit}> {unit}</span>}
          </span>
        )}
      </figcaption>
      {context && <p className={styles.context}>{context}</p>}
      <div className={styles.chart}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </figure>
  );
}
