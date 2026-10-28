'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ThemeMenu } from './theme-menu';
import { signOut } from 'next-auth/react';
import { notifyAuthTransition } from '@/components/providers/auth-transitions';
import type { AuthenticatedUser } from '@/models/accounts';
import { Button } from '@/components/ui/button';
import { DashboardHeader } from './dashboard-header';
import styles from './dashboard.module.css';
import type { RepositoryDefinition } from '@/config/repositories';
export function Toolbar({
  repositories,
  viewer,
}: {
  repositories: readonly RepositoryDefinition[];
  viewer: AuthenticatedUser;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [signOutError, setSignOutError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  async function handleSignOut() {
    setSigningOut(true);
    setSignOutError('');
    try {
      const result = await signOut({ redirect: false, redirectTo: '/auth/login' });
      if (!result.url) throw new Error('Sign out failed');
      const destination = new URL(result.url, window.location.origin);
      if (destination.searchParams.has('error') || destination.pathname !== '/auth/login')
        throw new Error('Sign out could not be confirmed');
      notifyAuthTransition();
      router.replace('/auth/login');
      router.refresh();
    } catch {
      setSignOutError('Sign-out could not be confirmed. Please try again.');
    } finally {
      setSigningOut(false);
    }
  }
  return (
    <DashboardHeader
      repositories={repositories}
      activePath={pathname}
      administration={viewer.role === 'admin'}
      accountControls={
        <>
          <ThemeMenu />
          <span className={styles.accountName}>{viewer.name || viewer.email}</span>
          <Button
            variant="ghost"
            size="sm"
            disabled={signingOut}
            onClick={() => void handleSignOut()}
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </Button>
          {signOutError && (
            <p role="alert" className="text-sm text-destructive">
              {signOutError}
            </p>
          )}
        </>
      }
    />
  );
}
