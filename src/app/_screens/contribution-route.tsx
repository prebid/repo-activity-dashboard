import Link from 'next/link';
import { contributions } from '@/server/reporting';
import { readPreferences } from '@/server/preferences';
import type { CanonicalPage } from '@/server/canonical-page';
import {
  contributionEntry,
  contributionReportPreferences,
  savedContributionTables,
} from '@/server/contribution-preferences';
import { contributionReportRoute } from '@/lib/presentation/contribution-url';
import { legacySearchParams, queryPairs } from '@/lib/presentation/url/codec';
import { contributionSubjectTitle } from '@/lib/presentation/page-title';
import type { ContributionArea } from '@/models/contribution-page';
import type { ContributionFocus } from '@/models/contributions';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/navigation/page-header';
import { ContributionsScreen } from './contributions-screen';
import { ContributionTimelineRoute } from './timeline-route';

function InvalidContributionView({ area }: { area: ContributionArea }) {
  return (
    <>
      {/* No report loaded, so the header states no snapshot time. */}
      <PageHeader title={contributionSubjectTitle(area, 'overview')} asOf="" />
      <EmptyState kind="error" title="Invalid contribution view">
        This link contains an unsupported view, date range or filter identity.{' '}
        <Link href={'/' + area}>Open {area}</Link>
      </EmptyState>
    </>
  );
}

/**
 * A contribution report page after the URL helper: a canonical view renders from its registry
 * values; an Over time view, whose screens still read legacy keys, renders from the legacy query.
 */
export async function ContributionRoute({
  area,
  page,
  focus,
}: {
  area: ContributionArea;
  page: CanonicalPage;
  focus?: ContributionFocus;
}) {
  if (page.status === 'legacy') {
    // The bare `?timeline` flag is the legacy `timeline=1` the Over time screens read.
    const params = legacySearchParams(
      queryPairs(page.params).map(([key, value]) =>
        key === 'timeline' && value === '' ? ([key, '1'] as const) : ([key, value] as const),
      ),
    );
    return <ContributionTimelineRoute area={area} params={params} focus={focus} />;
  }
  if (page.status === 'invalid') return <InvalidContributionView area={area} />;
  const result = await contributions(area, page.values, focus);
  if (result.status === 'invalid') return <InvalidContributionView area={area} />;
  const { route, segments } = contributionReportRoute(area, focus);
  const snapshot = await readPreferences('contributions');
  const entry = contributionEntry(snapshot, route, segments, page.values, page.entry);
  return (
    <ContributionsScreen
      page={result.page}
      viewerId={result.viewer.id}
      directory={result.directory}
      preferences={contributionReportPreferences(snapshot, result.page, entry)}
      view={{ route, segments, values: page.values }}
      saved={savedContributionTables(snapshot)}
    />
  );
}
