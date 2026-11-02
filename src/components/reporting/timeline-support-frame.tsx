import { Fragment } from 'react';
import { PageHeader, type PageHeaderCrumb } from '@/components/navigation/page-header';
import type { TimelineSupportContext } from '@/models/timeline-support';
import { timelineMetricLabel, timelineMetricUnit } from '@/lib/presentation/timeline-metric-label';
import { zonedRangeLabel } from '@/lib/presentation/overview-periods';
import { MeasurementValue } from '@/components/metrics/measurement-value';
import { Callout } from '@/components/feedback/callout';
import { noReportControls, ReportToolbar } from './report-toolbar';
import { partialPeriodCaption } from './timeline-value';

/** A Timeline value's supporting records: the way back, the subject and the interval's scope. */
export function TimelineSupportFrame({
  context,
  title,
  contribution = false,
  children,
  authorBack,
}: {
  context: TimelineSupportContext;
  title: string;
  contribution?: boolean;
  children: React.ReactNode;
  authorBack?: string | null;
}) {
  const breadcrumbs: PageHeaderCrumb[] = [{ label: 'Back to timeline', href: context.parentHref }];
  if (authorBack) breadcrumbs.push({ label: 'Back to authors', href: authorBack });
  return (
    <>
      <PageHeader
        title={title}
        asOf={context.source.asOf}
        breadcrumbs={breadcrumbs}
        breadcrumbLabel="Supporting view navigation"
      />
      <ReportToolbar
        label="Supporting interval scope"
        {...noReportControls}
        summary={{
          lead: timelineMetricLabel(context.metric, contribution),
          facts: [
            <Fragment key="value">
              Timeline value:{' '}
              <MeasurementValue
                measurement={context.measurement}
                unit={timelineMetricUnit(context.metric, contribution)}
              />
            </Fragment>,
            zonedRangeLabel(context.interval.covered),
            // The marker's caption, inline: a summary fact runs in the summary's line.
            ...(context.interval.partial ? [partialPeriodCaption] : []),
          ],
        }}
      />
      {context.measurement.status !== 'complete' && (
        <Callout tone="warning" as="aside" aria-label="Supporting data coverage">
          {context.measurement.reason} Only known matching records are shown.
        </Callout>
      )}
      {children}
    </>
  );
}
