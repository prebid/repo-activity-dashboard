'use client';
import { Fragment, type ReactNode } from 'react';
import { Callout } from '@/components/feedback/callout';
import { Button } from '@/components/ui/button';
import { ResetIcon } from '@/components/ui/icons';
import { useClientReady } from '@/lib/navigation/use-client-ready';
import styles from './report-toolbar.module.css';

/** "Reset view" restores what a view saves; "Reset filters" restores the shared report filters. */
export type ReportResetLabel = 'Reset view' | 'Reset filters';

export type ReportToolbarStatus =
  | { kind: 'saved' }
  | { kind: 'not-saved' }
  | { kind: 'updating'; subject: 'report' | 'timeline' }
  | { kind: 'hidden' };

export interface ReportToolbarGroup {
  /** Shown above the controls when there are two groups; read only by assistive technology otherwise. */
  label: string;
  controls: ReactNode;
  reset?: { label: ReportResetLabel; onReset: () => void };
}

export interface ReportToolbarProps {
  /** The region name tests and assistive technology use, such as "Timeline scope". */
  label: string;
  /** Pending work; the controls are also disabled until client handlers attach. */
  disabled: boolean;
  /** No groups leaves the summary alone, for a view rendered without its controls. */
  groups:
    readonly [] | readonly [ReportToolbarGroup] | readonly [ReportToolbarGroup, ReportToolbarGroup];
  /** Facts the controls do not already show, such as the resolved range. */
  summary?: { lead?: string; facts: readonly ReactNode[] };
  status: ReportToolbarStatus;
  /** An info notice joins the status line; an error notice is announced as an alert. */
  notice?: { tone: 'info' | 'error'; text: string };
  footnote?: string;
}

/** What a screen supplies; the view adds the region name and the summary of its report. */
export type ReportToolbarControls = Omit<ReportToolbarProps, 'label' | 'summary'>;

/** A view rendered without its controls, such as a static story, keeps only its summary. */
export const noReportControls: ReportToolbarControls = {
  disabled: false,
  groups: [],
  status: { kind: 'hidden' },
};

/** The status line for a report whose changes are saved to browser storage. */
export function reportToolbarStatus(
  pending: boolean,
  storageAvailable: boolean,
  subject: 'report' | 'timeline',
): ReportToolbarStatus {
  return pending
    ? { kind: 'updating', subject }
    : { kind: storageAvailable ? 'saved' : 'not-saved' };
}

export const reportToolbarSentences = {
  saved: 'Preferences saved for your account on this browser.',
  'not-saved': 'Browser storage is unavailable. Changes still work in this URL.',
  updating: { report: 'Updating report…', timeline: 'Updating timeline…' },
} as const;

function sentence(status: ReportToolbarStatus) {
  if (status.kind === 'hidden') return null;
  if (status.kind === 'updating') return reportToolbarSentences.updating[status.subject];
  return reportToolbarSentences[status.kind];
}

/**
 * The frame around a report's scope controls: one or two labelled groups, each with its own
 * reset, then the toolbar's only status line and a summary row. Layout only; the controls are
 * the feature's field components.
 */
export function ReportToolbar({
  label,
  disabled,
  groups,
  summary,
  status,
  notice,
  footnote,
}: ReportToolbarProps) {
  const ready = useClientReady();
  const labelled = groups.length > 1;
  const text = sentence(status);
  if (!groups.length)
    return (
      <section className={styles.toolbar} aria-label={label}>
        <Summary summary={summary} />
      </section>
    );
  return (
    <section className={styles.toolbar} aria-label={label}>
      <div className={styles.groups}>
        {groups.map((group) => (
          <fieldset key={group.label} className={styles.group} disabled={disabled || !ready}>
            <legend className={labelled ? styles.legend : 'sr-only'}>{group.label}</legend>
            <div className={styles.row}>
              <div className={styles.controls}>{group.controls}</div>
              {group.reset && (
                <span className={styles.reset}>
                  <Button type="button" variant="ghost" onClick={group.reset.onReset}>
                    <ResetIcon size={14} />
                    {group.reset.label}
                  </Button>
                </span>
              )}
            </div>
          </fieldset>
        ))}
      </div>
      <div className={styles.status} role="status">
        {notice?.tone === 'info' && <Callout tone="info">{notice.text}</Callout>}
        {text && <p className={styles.sentence}>{text}</p>}
      </div>
      {notice?.tone === 'error' && (
        <Callout tone="error" role="alert">
          {notice.text}
        </Callout>
      )}
      {footnote && <p className={styles.footnote}>{footnote}</p>}
      <Summary summary={summary} />
    </section>
  );
}

function Summary({ summary }: { summary: ReportToolbarProps['summary'] }) {
  if (!summary || (!summary.lead && !summary.facts.length)) return null;
  return (
    <p className={styles.summary}>
      {summary.lead && <span className={styles.lead}>{summary.lead}</span>}
      {summary.facts.map((fact, index) => (
        <Fragment key={index}>
          {(index > 0 || Boolean(summary.lead)) && (
            <>
              {' '}
              <span className={styles.separator} aria-hidden="true">
                ·
              </span>{' '}
            </>
          )}
          <span>{fact}</span>
        </Fragment>
      ))}
    </p>
  );
}
