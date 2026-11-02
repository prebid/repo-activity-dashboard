import {
  IssueClosedIcon,
  IssueOpenIcon,
  PrClosedIcon,
  PrDraftIcon,
  PrMergedIcon,
  PrOpenIcon,
  type IconComponent,
} from '@/components/ui/icons';
import styles from './record-status.module.css';

export type PullRequestStatus = 'open' | 'draft' | 'merged' | 'closed';
export type IssueStatus = 'open' | 'closed';
export type RecordStatusProps =
  { kind: 'pr'; status: PullRequestStatus } | { kind: 'issue'; status: IssueStatus };

/** The glyph colour role; record-status.module.css maps each to a token. */
export type RecordStatusTone = 'success' | 'muted' | 'link' | 'error';
interface Presentation {
  label: 'Open' | 'Draft' | 'Merged' | 'Closed';
  Icon: IconComponent;
  tone: RecordStatusTone;
}

export const recordStatusPresentation = {
  pr: {
    open: { label: 'Open', Icon: PrOpenIcon, tone: 'success' },
    draft: { label: 'Draft', Icon: PrDraftIcon, tone: 'muted' },
    merged: { label: 'Merged', Icon: PrMergedIcon, tone: 'link' },
    closed: { label: 'Closed', Icon: PrClosedIcon, tone: 'error' },
  },
  issue: {
    open: { label: 'Open', Icon: IssueOpenIcon, tone: 'success' },
    closed: { label: 'Closed', Icon: IssueClosedIcon, tone: 'muted' },
  },
} as const satisfies {
  pr: Record<PullRequestStatus, Presentation>;
  issue: Record<IssueStatus, Presentation>;
};

/**
 * A coloured glyph beside the visible label. data-state and the text content are the label, which
 * record filters and searches read; the glyph is decorative, so colour never carries the state.
 */
export function RecordStatus(props: RecordStatusProps) {
  const { label, Icon, tone } =
    props.kind === 'pr'
      ? recordStatusPresentation.pr[props.status]
      : recordStatusPresentation.issue[props.status];
  return (
    <span className={styles.status} data-state={label} data-tone={tone}>
      <Icon size={14} />
      {label}
    </span>
  );
}
