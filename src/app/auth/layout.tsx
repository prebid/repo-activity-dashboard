import { ThemeMenu } from '@/components/layout/theme-menu';
import styles from '@/features/authentication/authentication.module.css';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.surface}>
      <div className={styles.appearance}>
        <ThemeMenu className={styles.themeControl} />
      </div>
      {children}
    </main>
  );
}
