'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ThemeMenu } from './theme-menu';
import { LayoutWidthToggle } from './layout-width';
import { AccountMenu } from './account-menu';
import { signOut } from 'next-auth/react';
import { notifyAuthTransition } from '@/components/providers/auth-transitions';
import type { AuthenticatedUser } from '@/models/accounts';
import { isPreviewBuild } from '@/lib/presentation/preview';
import { Button } from '@/components/ui/button';
import { SignOutIcon } from '@/components/ui/icons';
import { DashboardHeader } from './dashboard-header';
import styles from './dashboard.module.css';
import type { RepositoryDefinition } from '@/config/repositories';
export function Toolbar({
  repositories,
  viewer,
  asOf,
}: {
  repositories: readonly RepositoryDefinition[];
  viewer: AuthenticatedUser;
  /** The reporting snapshot, which the masthead's saved entry links are checked against. */
  asOf?: string;
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
      viewerId={viewer.id}
      asOf={asOf}
      administration={viewer.role === 'admin'}
      accountControls={
        <>
          <LayoutWidthToggle />
          <ThemeMenu tone="masthead" />
          <AccountMenu viewer={viewer} passwordChange={!isPreviewBuild} />
          <Button variant="masthead" disabled={signingOut} onClick={() => void handleSignOut()}>
            <SignOutIcon size={16} />
            <span className={styles.signOutLabel}>{signingOut ? 'Signing out…' : 'Sign out'}</span>
          </Button>
          {signOutError && (
            <p role="alert" className={styles.signOutError}>
              {signOutError}
            </p>
          )}
        </>
      }
    />
  );
}
