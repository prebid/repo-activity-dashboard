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
import { contributionSubjectTitle } from '@/lib/presentation/page-title';
import type { ContributionArea } from '@/models/contribution-page';
import type { ContributionFocus } from '@/models/contributions';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/navigation/page-header';
import { ContributionsScreen } from './contributions-screen';
import { TimelineRoute } from './timeline-route';

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
 * A contribution report page after the URL helper: a report or an Over time view renders from its
 * registry values.
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
  if (page.status === 'invalid') return <InvalidContributionView area={area} />;
  const { route, segments } = contributionReportRoute(area, focus);
  if (page.values.timeline === true)
    return <TimelineRoute view={{ route, segments, values: page.values }} entry={page.entry} />;
  const result = await contributions(area, page.values, focus);
  if (result.status === 'invalid') return <InvalidContributionView area={area} />;
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
