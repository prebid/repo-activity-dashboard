import { SecureIcon } from '@/components/ui/icons';
import type { ReactNode } from 'react';
import { BrandLogo } from '@/components/layout/brand-logo';
import styles from './authentication.module.css';

export function AuthFrame({
  children,
  settingPassword = false,
}: {
  children: ReactNode;
  settingPassword?: boolean;
}) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <BrandLogo size="signIn" />
      </header>
      <section
        className={styles.card}
        aria-label={settingPassword ? 'Password settings' : 'Account sign-in'}
      >
        {children}
      </section>
      <footer className={styles.pageFooter}>
        <SecureIcon size={14} />
        <span>Private workspace. Access by invitation.</span>
      </footer>
    </div>
  );
}
