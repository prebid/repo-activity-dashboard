'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTheme } from 'next-themes';
import { useSession, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import type { RepositoryDefinition } from '@/config/repositories';
export function Toolbar({ repositories }: { repositories: readonly RepositoryDefinition[] }) {
  const { resolvedTheme, setTheme } = useTheme();
  const { data: session } = useSession();
  const router = useRouter();
  const [signOutError, setSignOutError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  async function handleSignOut() {
    setSigningOut(true);
    setSignOutError('');
    try {
      const result = await signOut({ redirect: false });
      if (!result.url) throw new Error('Sign out failed');
      router.replace('/auth/login');
      router.refresh();
    } catch {
      setSignOutError('Unable to sign out. Please try again.');
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
        <Link href="/repos" className="font-semibold">
          Repository activity
        </Link>
        <details className="relative">
          <summary className="cursor-pointer rounded-md px-3 py-2 focus-visible:outline-2">
            Repos
          </summary>
          <div className="absolute left-0 z-20 mt-2 max-h-96 w-80 overflow-auto rounded-lg border bg-popover p-2 shadow-md">
            <Link className="block rounded px-3 py-2 hover:bg-accent" href="/repos">
              All repositories
            </Link>
            {repositories
              .filter((r) => r.enabled)
              .map((r) => (
                <Link
                  key={r.id}
                  className="block rounded px-3 py-2 hover:bg-accent"
                  href={'/repos/' + r.slug}
                >
                  {r.displayName}
                </Link>
              ))}
          </div>
        </details>
        <Link href="/contributors" className="hover:underline">
          Contributors
        </Link>
        <Link href="/companies" className="hover:underline">
          Companies
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          >
            Toggle theme
          </Button>
          {session ? (
            <>
              <span className="text-sm">{session.user.name}</span>
              <Button variant="ghost" disabled={signingOut} onClick={() => void handleSignOut()}>
                {signingOut ? 'Signing out…' : 'Sign out'}
              </Button>
              {signOutError && (
                <p role="alert" className="text-sm text-destructive">
                  {signOutError}
                </p>
              )}
            </>
          ) : (
            <Link href="/auth/login">Sign in</Link>
          )}
        </div>
      </nav>
    </header>
  );
}
