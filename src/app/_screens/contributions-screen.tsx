'use client';
import { followCaptured } from '@/lib/navigation/follow-captured';
import Link from 'next/link';
import { useMemo, type MouseEvent, type ComponentProps } from 'react';
import { contributionOptionsClient } from '@/features/contributions/contribution-options-client';
import { contributionToolbar } from '@/features/contributions/contribution-controls';
import { useContributionControls } from '@/lib/navigation/use-contribution-controls';
import { areaEntryParent, useAreaEntryHref } from '@/lib/navigation/use-contribution-entry';
import type { ContributionControlDirectory } from '@/models/contribution-settings';
import type { ContributionReportPreferences } from '@/models/contribution-preferences';
import { contributionTableScope } from '@/lib/presentation/contribution-settings';
import { contributionTimelineHref } from '@/lib/presentation/contribution-timeline';
import {
  contributionViewOf,
  type SavedContributionTables,
} from '@/lib/presentation/contribution-url';
import type { UrlView } from '@/lib/presentation/url/back';
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
import { usePendingNavigation } from '@/lib/navigation/use-pending-navigation';
import { LinkPending } from '@/components/navigation/link-pending';
import { ViewTabs } from '@/components/navigation/view-tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { contributionDefaultSort } from '@/models/contributions';
import type { ContributionPage } from '@/models/contribution-page';
import type { TableFields } from '@/lib/presentation/url/table-binding';
import {
  contributionHref,
  companyBreakdownHref,
  companyBreakdownLabels,
  contributionMetricHref,
  contributionTargetOf,
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
const here = () => window.location.pathname + window.location.search;

/**
 * "Back to report": the parent frame or derived parent. Without a `back` frame, a parent that is an
 * area entry opens it as the masthead does, in the viewer's saved explicit form.
 */
function useReturnTo(page: ContributionPage, current: UrlView, viewerId: string) {
  return useAreaEntryHref(areaEntryParent(current), viewerId) ?? page.returnTo;
}

export function ContributionsScreen({
  page,
  viewerId,
  directory,
  preferences,
  view,
  saved: savedTables,
}: {
  page: ContributionPage;
  viewerId: string;
  directory: ContributionControlDirectory;
  /** Server-validated saved values; without them the page saves nothing. */
  preferences?: ContributionReportPreferences;
  /** The canonical view the server rendered: route, segments and registry values. */
  view: UrlView;
  /** Every table's saved presentation, which links that open a table carry (decision C3). */
  saved?: SavedContributionTables;
}) {
  const options = useMemo(() => contributionOptionsClient(page.sample), [page.sample]);
  const pendingNavigation = usePendingNavigation();
  const table = page.details ? 'details' : page.report.table!.kind;
  const columnIds =
    page.details && page.details.basis !== 'comments' ? creditDetailColumnIds : ids[table];
  const fields: TableFields = useMemo(
    () => ({ route: view.route, search: 'q', sort: 'sort', page: 'page' }),
    [view.route],
  );
  const controller = useTableController({
    queryKey: page.details ? 'details' : page.report.kind === 'overview' ? 'report' : table,
    scopeKey: contributionTableScope(page.sample, table),
    legacyScopeKey:
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
    savedSort: preferences?.sort,
    fields,
  });
  const controls = useContributionControls(
    viewerId,
    page,
    directory,
    controller,
    table,
    columnIds,
    preferences,
    view,
  );
  const returnTo = useReturnTo(page, controls.current, viewerId);
  // A presentation saved in this session replaces the server's copy for links to this table.
  const saved: SavedContributionTables | undefined = controls.changed
    ? {
        ...savedTables,
        [table]: {
          ...savedTables?.[table],
          columns: controls.changed.value.columns,
          hideZeroMembers: controls.changed.value.hideZeroMembers,
        },
      }
    : savedTables;
  /** The report at the address now, after a pending search was committed to it. */
  const atAddress = () => contributionViewOf(here()) ?? controls.current;
  /** `pendingKey` names the tab or breakdown link that shows the pending navigation. */
  function navigate(
    event: MouseEvent<HTMLAnchorElement>,
    destination: () => string | null,
    pendingKey?: string,
  ) {
    followCaptured(
      event,
      () => {
        controls.freezeReturn();
        return { href: destination() };
      },
      (href) => pendingNavigation.push(href, pendingKey),
    );
  }
  const current = controls.current;
  return (
    <ContributionContent
      page={{ ...page, returnTo, hideZeroMembers: controls.hideZeroMembers }}
      controller={controller}
      visibility={controls.visibility}
      toolbar={contributionToolbar({
        directory,
        options,
        value: controls.value,
        asOf: page.report.context.asOf,
        pending: controls.pending,
        notice: controls.notice,
        storageAvailable: controls.storageAvailable,
        onChange: (value, field) => controls.update(value, field),
        onReset: controls.reset,
      })}
      links={{
        sample: page.sample,
        settings: controls.value,
        context: page.report.context,
        saved,
        onMetric: (event, focus, metric, repositoryId) =>
          navigate(event, () =>
            contributionMetricHref(
              contributionTargetOf(page.area, focus),
              page.sample,
              page.report.context,
              metric,
              here(),
              repositoryId,
              saved,
            ),
          ),
        currentHref: controls.returnHref,
        timelineHref: contributionTimelineHref(current, controls.value),
        pendingTarget: pendingNavigation.pendingKey,
        onTimeline: (event) =>
          navigate(event, () => contributionTimelineHref(atAddress(), controls.value), 'timeline'),
        onAreaFollow: (event, area) =>
          navigate(
            event,
            () => contributionHref(area, page.sample, undefined, controls.value, saved),
            area,
          ),
        onFollow: (event, focus) =>
          navigate(event, () =>
            contributionHref(focus, page.sample, here(), controls.value, saved),
          ),
      }}
      breakdownControls={
        page.report.kind === 'company' ? (
          <div className={styles.memberControls}>
            <ViewTabs label="Company breakdown" variant="segmented">
              {(['members', 'repositories'] as const).map((breakdown) => (
                <Link
                  prefetch={false}
                  key={breakdown}
                  href={companyBreakdownHref(
                    controls.returnHref.split('?')[0],
                    controls.returnHref.split('?')[1] ?? '',
                    breakdown,
                    saved,
                  )}
                  aria-current={page.breakdown === breakdown ? 'page' : undefined}
                  onClick={(event) =>
                    navigate(
                      event,
                      () =>
                        companyBreakdownHref(
                          window.location.pathname,
                          window.location.search,
                          breakdown,
                          saved,
                        ),
                      breakdown,
                    )
                  }
                >
                  {companyBreakdownLabels[breakdown]}
                  <LinkPending pending={pendingNavigation.pendingKey === breakdown || undefined} />
                </Link>
              ))}
            </ViewTabs>
            {page.breakdown === 'members' && !page.details && (
              <label className={styles.zeroToggle}>
                <Checkbox
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
