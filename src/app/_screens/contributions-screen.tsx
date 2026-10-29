'use client';
import Link from 'next/link';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import type { MouseEvent, ComponentProps } from 'react';
import { ContributionControls } from '@/features/contributions/contribution-controls';
import { PageState } from '@/components/feedback/page-state';
import { useContributionControls } from '@/lib/navigation/use-contribution-controls';
import type { ContributionDirectory } from '@/models/contribution-settings';
import { contributionTitle } from '@/features/contributions/contribution-header';
import {
  ContributionDetailsView,
  contributionDetailColumnIds,
} from '@/features/contributions/contribution-details-view';
import { ContributionView } from '@/features/contributions/contribution-view';
import {
  contributorColumns,
  companyColumns,
  repositoryContributionColumns,
} from '@/features/contributions/contribution-columns';
import styles from '@/features/contributions/contributions.module.css';
import { useTableController } from '@/lib/navigation/use-table-controller';
import { contributionDefaultSort } from '@/models/contributions';
import type { ContributionPage } from '@/models/contribution-page';
import {
  contributionHref,
  companyBreakdownHref,
  contributionMetricHref,
} from '@/lib/presentation/contribution-navigation';
const detailSort = { sort: 'creditedAt', descending: true } as const;
const creditDetailColumnIds = contributionDetailColumnIds.filter((id) => id !== 'lastAt');
const noLinks = { sample: 'reference' as const, currentHref: '/contributors' };
const ids = {
  details: contributionDetailColumnIds,
  contributors: contributorColumns(noLinks).map((column) => column.id),
  companies: companyColumns(noLinks).map((column) => column.id),
  members: contributorColumns(noLinks, false).map((column) => column.id),
  repositories: repositoryContributionColumns().map((column) => column.id),
};
export function ContributionsScreen({
  page,
  viewerId,
  directory,
}: {
  page: ContributionPage;
  viewerId: string;
  directory: ContributionDirectory;
}) {
  const pathname = usePathname(),
    search = useSearchParams().toString(),
    router = useRouter();
  const table = page.details
    ? 'details'
    : page.report.kind === 'overview'
      ? page.area
      : page.report.kind === 'company'
        ? page.breakdown
        : 'repositories';
  const columnIds =
    page.details && page.details.basis !== 'comments' ? creditDetailColumnIds : ids[table];
  const controller = useTableController({
    queryKey: page.details ? 'details' : page.report.kind === 'overview' ? 'report' : table,
    scopeKey:
      'contributions:' +
      page.area +
      ':' +
      JSON.stringify(page.report.context.focus) +
      ':' +
      table +
      (page.details ? ':' + page.details.metric : ''),
    viewerId,
    columnIds,
    defaultSort: page.details ? detailSort : contributionDefaultSort,
    historyMode: 'push',
  });
  const controls = useContributionControls(viewerId, page, directory, controller, table, columnIds);
  if (!controls.ready)
    return (
      <>
        <h1>{contributionTitle(page)}</h1>
        <PageState title="Loading report preferences">Restoring this report…</PageState>
      </>
    );
  function navigate(event: MouseEvent<HTMLAnchorElement>, destination: () => string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    controls.freezeReturn();
    router.push(destination());
  }
  return (
    <ContributionContent
      page={{ ...page, hideZeroMembers: controls.hideZeroMembers }}
      controller={controller}
      visibility={controls.visibility}
      controls={
        <ContributionControls
          directory={directory}
          value={controls.value}
          asOf={page.report.context.asOf}
          pending={controls.pending}
          notice={controls.notice}
          storageAvailable={controls.storageAvailable}
          onChange={controls.update}
          onReset={controls.reset}
        />
      }
      links={{
        sample: page.sample,
        settings: controls.value,
        context: page.report.context,
        onMetric: (event, focus, metric, repositoryId) =>
          navigate(event, () =>
            contributionMetricHref(
              focus.kind === 'overview' ? page.area : focus,
              page.sample,
              page.report.context,
              metric,
              window.location.pathname + window.location.search,
              repositoryId,
            ),
          ),
        actorTypes: page.report.context.selection.actorTypes,
        currentHref: controls.returnHref,
        onAreaFollow: (event, area) =>
          navigate(event, () =>
            contributionHref(
              area,
              page.sample,
              undefined,
              controls.value.selection.actorTypes,
              controls.value,
            ),
          ),
        onFollow: (event, focus) =>
          navigate(event, () =>
            contributionHref(
              focus,
              page.sample,
              window.location.pathname + window.location.search,
              page.report.context.selection.actorTypes,
              controls.value,
            ),
          ),
      }}
      breakdownControls={
        page.report.kind === 'company' ? (
          <div className={styles.memberControls}>
            <nav aria-label="Company breakdown" className={styles.breakdowns}>
              {(['members', 'repositories'] as const).map((view) => (
                <Link
                  prefetch={false}
                  key={view}
                  href={companyBreakdownHref(pathname, search, view)}
                  aria-current={page.breakdown === view ? 'page' : undefined}
                  onClick={(event) =>
                    navigate(event, () =>
                      companyBreakdownHref(pathname, window.location.search, view),
                    )
                  }
                >
                  {view === 'members' ? 'By contributor' : 'By repository'}
                </Link>
              ))}
            </nav>
            {page.breakdown === 'members' && !page.details && (
              <label className={styles.zeroToggle}>
                <input
                  type="checkbox"
                  checked={controls.hideZeroMembers}
                  onChange={(event) => controls.changeHideZeroMembers(event.target.checked)}
                />
                Hide zero totals
              </label>
            )}
          </div>
        ) : undefined
      }
    />
  );
}

function ContributionContent(props: ComponentProps<typeof ContributionView>) {
  return props.page.details ? (
    <ContributionDetailsView {...props} details={props.page.details} />
  ) : (
    <ContributionView {...props} />
  );
}
