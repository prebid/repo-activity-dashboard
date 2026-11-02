import { SecureIcon } from '@/components/ui/icons';
import styles from './dashboard.module.css';

/** The footer under every dashboard and edge page, with the sign-in pages' wording. */
export function WorkspaceFooter() {
  return (
    <footer className={styles.footer}>
      <SecureIcon size={14} />
      <span>Private workspace. Access by invitation.</span>
    </footer>
  );
}
