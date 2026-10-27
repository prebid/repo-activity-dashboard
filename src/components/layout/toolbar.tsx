'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTheme } from 'next-themes';
import { signOut } from 'next-auth/react';
import { notifyAuthTransition } from '@/components/providers/auth-transitions';
import type { AuthenticatedUser } from '@/models/accounts';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import type { RepositoryDefinition } from '@/config/repositories';
export function Toolbar({
  repositories,
  viewer,
}: {
  repositories: readonly RepositoryDefinition[];
  viewer: AuthenticatedUser;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
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
    <header className="border-b bg-card">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-4 p-4"
      >
        <Link prefetch={false} href="/repos" className="font-semibold">
          Repository activity
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost">Repos</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-80">
            <DropdownMenuItem asChild>
              <Link
                prefetch={false}
                className="block rounded px-3 py-2 hover:bg-accent"
                href="/repos"
              >
                All repositories
              </Link>
            </DropdownMenuItem>
            {repositories
              .filter((r) => r.enabled)
              .map((r) => (
                <DropdownMenuItem asChild key={r.id}>
                  <Link
                    prefetch={false}
                    className="block rounded px-3 py-2 hover:bg-accent"
                    href={'/repos/' + r.slug}
                  >
                    {r.displayName}
                  </Link>
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Link prefetch={false} href="/contributors" className="hover:underline">
          Contributors
        </Link>
        <Link prefetch={false} href="/companies" className="hover:underline">
          Companies
        </Link>
        {viewer.role === 'admin' && (
          <Link prefetch={false} href="/admin/users" className="hover:underline">
            Accounts
          </Link>
        )}
        <div className="ml-auto flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          >
            Toggle theme
          </Button>
          {
            <>
              <span className="text-sm">{viewer.name || viewer.email}</span>
              <Button variant="ghost" disabled={signingOut} onClick={() => void handleSignOut()}>
                {signingOut ? 'Signing out…' : 'Sign out'}
              </Button>
              {signOutError && (
                <p role="alert" className="text-sm text-destructive">
                  {signOutError}
                </p>
              )}
            </>
          }
        </div>
      </nav>
    </header>
  );
}
