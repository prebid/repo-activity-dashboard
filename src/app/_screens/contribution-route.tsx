import Link from 'next/link';
import { contributions } from '@/server/reporting';
import { readPreferences } from '@/server/preferences';
import type { CanonicalPage } from '@/server/canonical-page';
import {
  contributionEntry,
  contributionReportPreferences,
  savedContributionTables,
} from '@/server/contribution-preferences';
import {
  contributionLensValues,
  contributionReportRoute,
} from '@/lib/presentation/contribution-url';
import { contributionQueryLens, contributionSubjectTitle } from '@/lib/presentation/page-title';
import type { PageSearchParams } from '@/lib/presentation/search-params';
import { legacySearchParams, urlHref } from '@/lib/presentation/url/codec';
import type { ContributionArea } from '@/models/contribution-page';
import type { ContributionLens } from '@/models/contribution-lens';
import type { ContributionFocus } from '@/models/contributions';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/navigation/page-header';
import { ContributionsScreen } from './contributions-screen';
import { TimelineRoute } from './timeline-route';

function InvalidContributionView({
  area,
  lens,
}: {
  area: ContributionArea;
  lens: ContributionLens;
}) {
  const title = contributionSubjectTitle(area, 'overview', lens);
  const { route } = contributionReportRoute(area, undefined, lens);
  return (
    <>
      {/* No report loaded, so the header states no snapshot time. */}
      <PageHeader title={title} asOf="" />
      <EmptyState kind="error" title="Invalid contribution view">
        This link contains an unsupported view, date range or filter identity.{' '}
        <Link href={urlHref(route, {}, contributionLensValues(route, lens))}>
          Open {title.toLowerCase()}
        </Link>
      </EmptyState>
    </>
  );
}

/**
 * A contribution report page after the URL helper: a report or an Over time view renders from its
 * registry values, in a lens. `lens` names the Reviewers lens of /reviewers, whose route is the
 * lens; elsewhere the values' `lens` decides, and for an address the helper rejects, the raw
 * `query`'s, as the document title and the masthead read it.
 */
export async function ContributionRoute({
  area,
  page,
  query,
  focus,
  lens: routeLens,
}: {
  area: ContributionArea;
  page: CanonicalPage;
  query: PageSearchParams;
  focus?: ContributionFocus;
  lens?: ContributionLens;
}) {
  const lens: ContributionLens =
    routeLens ??
    (page.status === 'canonical'
      ? page.values.lens === 'reviewers'
        ? 'reviewers'
        : 'contributors'
      : contributionQueryLens(legacySearchParams(query)));
  if (page.status === 'invalid') return <InvalidContributionView area={area} lens={lens} />;
  const { route, segments } = contributionReportRoute(area, focus, lens);
  if (page.values.timeline === true)
    return <TimelineRoute view={{ route, segments, values: page.values }} entry={page.entry} />;
  const result = await contributions(area, page.values, focus, lens);
  if (result.status === 'invalid') return <InvalidContributionView area={area} lens={lens} />;
  const snapshot = await readPreferences('contributions');
  const entry = contributionEntry(snapshot, route, segments, page.values, page.entry);
  return (
    <ContributionsScreen
      page={result.page}
      viewerId={result.viewer.id}
      directory={result.directory}
      preferences={contributionReportPreferences(snapshot, result.page, entry)}
      view={{ route, segments, values: page.values }}
      saved={savedContributionTables(snapshot, lens)}
    />
  );
}
