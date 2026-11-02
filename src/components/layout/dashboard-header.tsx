'use client';
import { useState, type MouseEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { ExpandIcon } from '@/components/ui/icons';
import type { RepositoryDefinition } from '@/config/repositories';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import styles from './dashboard.module.css';
import { BrandLogo } from './brand-logo';
import { LinkPending } from '@/components/navigation/link-pending';
import { followCaptured } from '@/lib/navigation/follow-captured';
import { useContributionEntry } from '@/lib/navigation/use-contribution-entry';
import { usePendingNavigation } from '@/lib/navigation/use-pending-navigation';

export function DashboardHeader({
  repositories,
  activePath,
  administration = false,
  accountControls,
  viewerId,
}: {
  repositories: readonly RepositoryDefinition[];
  activePath: string;
  administration?: boolean;
  accountControls: ReactNode;
  viewerId?: string;
}) {
  const contributionEntry = useContributionEntry(
    viewerId,
    repositories.filter((repo) => repo.enabled),
  );
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [repositoriesOpen, setRepositoriesOpen] = useState(false);
  const navigation = usePendingNavigation();
  const inRepos = activePath.startsWith('/repos/');
  // A menu item closes with its menu, so the router follows it and the trigger shows it pending.
  // Modified clicks keep the browser's behaviour.
  function followRepository(event: MouseEvent<HTMLAnchorElement>, href: string) {
    followCaptured(
      event,
      () => ({ href }),
      (destination) => {
        setRepositoriesOpen(false);
        navigation.push(destination, 'repositories');
      },
    );
  }
  return (
    <header className={styles.header} ref={setContainer}>
      <div className={styles.headerInner}>
        <Link
          prefetch={false}
          href="/repos"
          aria-label="Repository activity"
          className={styles.brand}
        >
          <BrandLogo size="header" />
          <LinkPending />
        </Link>
        <nav aria-label="Main navigation" className={styles.navigation}>
          <Link
            prefetch={false}
            href="/repos"
            className={styles.navItem}
            aria-current={activePath === '/repos' ? 'page' : undefined}
          >
            Overview
            <LinkPending />
          </Link>
          <DropdownMenu open={repositoriesOpen} onOpenChange={setRepositoriesOpen}>
            <DropdownMenuTrigger asChild>
              <button type="button" className={styles.navItem} data-active={inRepos}>
                Repositories <ExpandIcon size={14} />
                <LinkPending pending={navigation.pendingKey === 'repositories' || undefined} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent container={container} align="start" size="md">
              {repositories
                .filter((repo) => repo.enabled)
                .map((repo) => (
                  <DropdownMenuItem asChild key={repo.id}>
                    <Link
                      prefetch={false}
                      href={'/repos/' + repo.slug}
                      aria-current={activePath === '/repos/' + repo.slug ? 'page' : undefined}
                      onClick={(event) => followRepository(event, '/repos/' + repo.slug)}
                    >
                      {repo.displayName}
                    </Link>
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Link
            prefetch={false}
            href={contributionEntry}
            className={styles.navItem}
            data-active={
              activePath.startsWith('/contributors') || activePath.startsWith('/companies')
            }
            aria-current={activePath === '/contributors' ? 'page' : undefined}
          >
            Contributions
            <LinkPending />
          </Link>
        </nav>
        <div className={styles.account}>
          {administration && (
            <nav aria-label="Administration" className={styles.administration}>
              <Link
                prefetch={false}
                href="/admin/users"
                className={styles.navItem}
                aria-current={activePath.startsWith('/admin') ? 'page' : undefined}
              >
                Accounts
                <LinkPending />
              </Link>
            </nav>
          )}
          {accountControls}
        </div>
      </div>
    </header>
  );
}
