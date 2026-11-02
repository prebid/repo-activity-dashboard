import { RecordStatus, type RecordStatusProps } from './record-status';
import styles from './record-identity.module.css';

const prStatuses = { Open: 'open', Merged: 'merged', Closed: 'closed' } as const;
const issueStatuses = { Open: 'open', Closed: 'closed' } as const;

/** A pull request's status: Draft while it is a draft, otherwise its state. */
export function pullRequestStatus(
  state: keyof typeof prStatuses,
  draft = false,
): RecordStatusProps {
  return { kind: 'pr', status: draft ? 'draft' : prStatuses[state] };
}
export function issueStatus(state: keyof typeof issueStatuses): RecordStatusProps {
  return { kind: 'issue', status: issueStatuses[state] };
}

export interface RecordIdentityProps {
  title: string;
  /** The record on GitHub, opened in a new tab. */
  url: string;
  status: RecordStatusProps;
  labels?: readonly string[];
}

/**
 * The record row's identity cell: the title link, with the record's status and label chips on the
 * line beneath it. Every PR and issue list renders its records this way, with the number in its
 * own column through RecordNumber.
 */
export function RecordIdentity({ title, url, status, labels = [] }: RecordIdentityProps) {
  return (
    <div className={styles.identity}>
      <a href={url} target="_blank" rel="noopener noreferrer" className={styles.title}>
        {title}
      </a>
      <div className={styles.meta}>
        <RecordStatus {...status} />
        {labels.map((label) => (
          <span key={label} className={styles.label}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The record number beside its RecordIdentity, linking to the same record. */
export function RecordNumber({ number, url }: { number: number; url: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={styles.number}>
      {number}
    </a>
  );
}
