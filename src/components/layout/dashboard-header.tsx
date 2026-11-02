'use client';
import { useState, type MouseEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
import { contributionLensForLocation } from '@/lib/presentation/contribution-lens';
import { useContributionEntry } from '@/lib/navigation/use-contribution-entry';
import {
  useRepositoriesEntryHref,
  useRepositoryListEntryQuery,
} from '@/lib/navigation/use-repositories-entry';
import { usePendingNavigation } from '@/lib/navigation/use-pending-navigation';

export function DashboardHeader({
  repositories,
  activePath,
  administration = false,
  accountControls,
  viewerId,
  asOf,
}: {
  repositories: readonly RepositoryDefinition[];
  activePath: string;
  administration?: boolean;
  accountControls: ReactNode;
  viewerId?: string;
  /** The reporting snapshot saved All repositories periods are checked against. */
  asOf?: string;
}) {
  const enabled = repositories.filter((repo) => repo.enabled);
  // Entry links carry the viewer's saved explicit form after hydration, so a click needs no
  // redirect; they are bare on the server. Each lens link opens its own lens's saved table.
  const contributorsEntry = useContributionEntry(viewerId, enabled, '/contributors');
  const reviewersEntry = useContributionEntry(viewerId, enabled, '/reviewers');
  // The lens is in the query, which this layout-level header reads from the router: the server
  // render sees the request's query, and a query-only navigation re-renders the header.
  const lens = contributionLensForLocation(activePath, useSearchParams());
  const inContributions =
    activePath.startsWith('/contributors') || activePath.startsWith('/companies');
  const overviewEntry = useRepositoriesEntryHref(asOf, viewerId);
  const listQuery = useRepositoryListEntryQuery(viewerId);
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
          href={overviewEntry}
          aria-label="Repository activity"
          className={styles.brand}
        >
          <BrandLogo size="header" />
          <LinkPending />
        </Link>
        <nav aria-label="Main navigation" className={styles.navigation}>
          <Link
            prefetch={false}
            href={overviewEntry}
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
                      href={'/repos/' + repo.slug + listQuery}
                      aria-current={activePath === '/repos/' + repo.slug ? 'page' : undefined}
                      onClick={(event) =>
                        followRepository(event, '/repos/' + repo.slug + listQuery)
                      }
                    >
                      {repo.displayName}
                    </Link>
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Link
            prefetch={false}
            href={contributorsEntry}
            className={styles.navItem}
            data-active={inContributions && lens === 'contributors'}
            aria-current={
              activePath === '/contributors' && lens === 'contributors' ? 'page' : undefined
            }
          >
            Contributors
            <LinkPending />
          </Link>
          <Link
            prefetch={false}
            href={reviewersEntry}
            className={styles.navItem}
            data-active={lens === 'reviewers'}
            aria-current={activePath === '/reviewers' ? 'page' : undefined}
          >
            Reviewers
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
