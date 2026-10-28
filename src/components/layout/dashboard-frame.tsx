import type { ReactNode } from 'react';
import styles from './dashboard.module.css';

export function DashboardFrame({
  navigation,
  children,
}: {
  navigation: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.surface}>
      <a className={styles.skipLink} href="#dashboard-content">
        Skip to content
      </a>
      {navigation}
      <aside aria-label="Data source" className={styles.source}>
        <span className={styles.sampleDot} aria-hidden="true" />
        Sample reporting data{' '}
        <span className={styles.sourceDetail}>· Prepared for design review</span>
      </aside>
      <main id="dashboard-content" className={styles.main}>
        {children}
      </main>
    </div>
  );
}
