import type { ReactNode } from 'react';
import { BrandLogo } from './brand-logo';
import { WorkspaceFooter } from './workspace-footer';
import styles from './edge-frame.module.css';

/**
 * A page shown outside the dashboard frame, such as a missing page or a failed application: the
 * logo and the page's message on the canvas, over the workspace footer.
 */
export function EdgeFrame({ children }: { children: ReactNode }) {
  return (
    <div className={styles.frame}>
      <main className={styles.main}>
        <BrandLogo size="signIn" />
        {children}
      </main>
      <WorkspaceFooter />
    </div>
  );
}

/** An edge page's message card: its h1, an optional sentence and its one way on. */
export function EdgeMessage({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action: ReactNode;
}) {
  return (
    <div className={styles.card}>
      <h1 className={styles.title}>{title}</h1>
      {children && <p className={styles.description}>{children}</p>}
      <div className={styles.action}>{action}</div>
    </div>
  );
}
