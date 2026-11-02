import { ExpandIcon } from './icons';
import styles from './disclosure-chevron.module.css';

/**
 * The trailing chevron of every disclosure. It turns while its trigger is open: a button with
 * `aria-expanded="true"`, or the summary of an open `<details>`. A summary that holds it loses
 * its native marker, so the chevron is the disclosure's only glyph.
 */
export function DisclosureChevron() {
  return (
    <span className={styles.chevron}>
      <ExpandIcon size={14} />
    </span>
  );
}
