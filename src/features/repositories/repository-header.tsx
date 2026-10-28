import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, GitBranch, GitPullRequest, CircleDot } from 'lucide-react';
import type { OverviewRepository } from '@/models/repository-overview';
import type { RepositoryPageNavigation } from '@/models/repository-page';
import { formatAsOf } from '@/lib/presentation/format';
import { repositoryDrilldownHref } from '@/lib/presentation/repository-drilldown';
import { MeasurementValue } from '@/components/metrics/measurement-value';
import styles from './repository-page.module.css';

export function RepositoryHeader({
  repository,
  asOf,
  returnTo,
  navigation,
  activeKind,
  parentLink,
}: {
  repository: OverviewRepository;
  asOf: string;
  returnTo: string;
  navigation?: RepositoryPageNavigation;
  activeKind?: 'prs' | 'issues';
  parentLink?: { href: string; label: string };
}) {
  return (
    <>
      <div className={styles.breadcrumbs}>
        <Link prefetch={false} href={returnTo} aria-label="← All repositories">
          <ArrowLeft size={14} aria-hidden="true" />
          All repositories
        </Link>
        {parentLink && (
          <>
            <span aria-hidden="true">/</span>
            <Link prefetch={false} href={parentLink.href}>
              ← {parentLink.label}
            </Link>
          </>
        )}
      </div>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Repository</p>
          <h1>{repository.name}</h1>
          <div className={styles.meta}>
            <span>
              <GitBranch size={13} aria-hidden="true" />
              {repository.primaryBranch}
              <span className={styles.muted}>primary branch</span>
            </span>
            {navigation && (
              <Link
                prefetch={false}
                href={navigation.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                View repository on GitHub
                <ArrowUpRight size={13} aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
        <p className={styles.snapshot}>
          Reporting snapshot
          <br />
          <time dateTime={asOf}>{formatAsOf(asOf)}</time>
        </p>
      </header>
      <nav aria-label="Repository lists" className={styles.tabs}>
        {(['prs', 'issues'] as const).map((kind) => (
          <Link
            key={kind}
            prefetch={false}
            href={repositoryDrilldownHref(repository, {
              selection: {
                scope: 'current',
                metric: kind === 'prs' ? 'totalOpenPrs' : 'openIssues',
              },
              returnTo,
            })}
            aria-current={activeKind === kind ? 'page' : undefined}
          >
            {kind === 'prs' ? (
              <GitPullRequest size={16} aria-hidden="true" />
            ) : (
              <CircleDot size={16} aria-hidden="true" />
            )}
            <span>{kind === 'prs' ? 'Pull requests' : 'Issues'}</span>
            {navigation && (
              <span className={styles.tabCount} title="Current open count">
                <MeasurementValue
                  measurement={kind === 'prs' ? navigation.openPrs : navigation.openIssues}
                />
                <span className={styles.countLabel}>open</span>
              </span>
            )}
          </Link>
        ))}
      </nav>
    </>
  );
}
