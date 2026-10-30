'use client';
import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import type { RepositoryDefinition } from '@/config/repositories';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import styles from './dashboard.module.css';
import { useContributionEntry } from '@/lib/navigation/use-contribution-entry';

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
  const inRepos = activePath.startsWith('/repos');
  return (
    <header className={styles.header} ref={setContainer}>
      <div className={styles.headerInner}>
        <Link
          prefetch={false}
          href="/repos"
          aria-label="Repository activity"
          className={styles.brand}
        >
          <Image src="/prebid-logo.png" alt="Prebid" width={143} height={25} priority />
        </Link>
        <nav aria-label="Main navigation" className={styles.navigation}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className={styles.navItem} data-active={inRepos}>
                Repositories <ChevronDown size={14} aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent container={container} align="start" className={styles.repoMenu}>
              <DropdownMenuItem asChild>
                <Link
                  prefetch={false}
                  href="/repos"
                  aria-current={activePath === '/repos' ? 'page' : undefined}
                >
                  All repositories
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Repositories</DropdownMenuLabel>
              {repositories
                .filter((repo) => repo.enabled)
                .map((repo) => (
                  <DropdownMenuItem asChild key={repo.id}>
                    <Link
                      prefetch={false}
                      href={'/repos/' + repo.slug}
                      aria-current={activePath === '/repos/' + repo.slug ? 'page' : undefined}
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
          </Link>
          {administration && (
            <Link
              prefetch={false}
              href="/admin/users"
              className={styles.navItem}
              aria-current={activePath.startsWith('/admin') ? 'page' : undefined}
            >
              Accounts
            </Link>
          )}
        </nav>
        <div className={styles.account}>{accountControls}</div>
      </div>
    </header>
  );
}
