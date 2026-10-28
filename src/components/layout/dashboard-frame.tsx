'use client';
import type { ReactNode } from 'react';
import styles from './dashboard.module.css';

// Resolve streamed slots in component fibers, not while a DOM element hydrates.
// Next 15's bundled renderer predates https://github.com/react/react/pull/35494.
// This preserves SSR and leaves hydration diagnostics enabled.
function StreamedSlot({ children }: { children: ReactNode }) {
  return children;
}

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
      <StreamedSlot>{navigation}</StreamedSlot>
      <aside aria-label="Data source" className={styles.source}>
        <span className={styles.sampleDot} aria-hidden="true" />
        Sample reporting data{' '}
        <span className={styles.sourceDetail}>· Prepared for design review</span>
      </aside>
      <main id="dashboard-content" className={styles.main}>
        <StreamedSlot>{children}</StreamedSlot>
      </main>
    </div>
  );
}
