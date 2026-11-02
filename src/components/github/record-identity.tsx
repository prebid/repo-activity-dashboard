import { ExternalLinkIcon } from '@/components/ui/icons';
import { RecordStatus, type RecordStatusProps } from './record-status';
import styles from './record-identity.module.css';

const prStatuses = { Open: 'open', Merged: 'merged', Closed: 'closed' } as const;
const issueStatuses = { Open: 'open', Closed: 'closed' } as const;

/**
 * A pull request's status: Draft while it is an open draft, otherwise its state. A PR merged or
 * closed while still marked draft reads Merged or Closed, as GitHub shows it.
 */
export function pullRequestStatus(
  state: keyof typeof prStatuses,
  draft = false,
): RecordStatusProps {
  return { kind: 'pr', status: draft && state === 'Open' ? 'draft' : prStatuses[state] };
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

export interface RecordTitleLinkProps {
  title: string;
  /** The record on GitHub, opened in a new tab. */
  url: string;
  /** Leads the title, muted, where one link carries "#n title". */
  number?: number;
  /** The link's hover text. */
  hint?: string;
  /** Draws the external-link glyph after the title's last character, as the account link does. */
  external?: boolean;
}

/** A record's title link in the record row's style: ink at weight 500, underlined on hover. */
export function RecordTitleLink({
  title,
  url,
  number,
  hint,
  external = false,
}: RecordTitleLinkProps) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={styles.title} title={hint}>
      {number !== undefined && <span className={styles.number}>#{number}</span>}
      {number !== undefined && ' '}
      {title}
      {external && <ExternalLinkIcon size={14} />}
    </a>
  );
}

/**
 * The record row's identity cell: the title link, with the record's status and label chips on the
 * line beneath it. Every PR and issue list renders its records this way, with the number in its
 * own column through RecordNumber.
 */
export function RecordIdentity({ title, url, status, labels = [] }: RecordIdentityProps) {
  return (
    <div className={styles.identity}>
      <RecordTitleLink title={title} url={url} />
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
