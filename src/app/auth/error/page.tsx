import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthFrame } from '@/features/authentication/auth-frame';
import styles from '@/features/authentication/authentication.module.css';
export const metadata: Metadata = { title: 'Unable to sign in' };
export default function AuthErrorPage() {
  return (
    <AuthFrame>
      <h1 className={styles.title}>Unable to sign in</h1>
      <p className={styles.subtitle}>Please try again or contact your administrator.</p>
      <Link prefetch={false} href="/auth/login" className={styles.backLink}>
        Return to sign in
      </Link>
    </AuthFrame>
  );
}
