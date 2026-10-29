import {
  reviewBuckets,
  type RepositoryChart,
  type RepositoryPageSource,
  type ActivityChart,
} from '@/models/repository-page';
import { utcInstantSchema, type DateRange } from '@/models/reporting-period';
import {
  ageBandFor,
  ageBands,
  reviewBucket,
  subsetCount,
  activityDateBasis,
  recordEventDate,
  inDateRange,
} from './repository-page-values';

function activityChart(source: RepositoryPageSource, range: DateRange): ActivityChart {
  const start = Date.parse(range.start),
    end = Date.parse(range.end);
  const granularity = end - start <= 31 * 86_400_000 ? 'day' : 'month';
  const chart: ActivityChart = {
    kind: 'activity',
    dateBasis: activityDateBasis(source),
    granularity,
    range,
    measurement: { ...source.measurement },
    points: [],
  };
  if (source.measurement.value === null) return chart;
  const cursor = new Date(start);
  cursor.setUTCHours(0, 0, 0, 0);
  if (granularity === 'month') cursor.setUTCDate(1);
  while (cursor.getTime() < end || (cursor.getTime() === end && range.endInclusive)) {
    const lower = Math.max(start, cursor.getTime());
    if (granularity === 'day') cursor.setUTCDate(cursor.getUTCDate() + 1);
    else cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    const upper = Math.min(end, cursor.getTime());
    chart.points.push({
      range: {
        start: new Date(lower).toISOString(),
        end: new Date(upper).toISOString(),
        endInclusive: range.endInclusive && upper < cursor.getTime(),
      },
      count: subsetCount(source.measurement, 0),
    });
  }
  for (const row of source.rows) {
    const at = utcInstantSchema.parse(recordEventDate(row, source));
    const point = chart.points.find((point) => inDateRange(at, point.range));
    if (!point) throw new Error('Record event is outside the selected period');
    if (point.count.value !== null) point.count.value += 1;
  }
  return chart;
}

/** Chart values are full filtered-cohort counts; table page/sort never enter this function. */
export function repositoryPageCharts(source: RepositoryPageSource): RepositoryChart[] {
  const selection = source.drilldown.selection;
  if (selection.scope === 'period') return [activityChart(source, selection.range)];
  const charts: RepositoryChart[] = [
    {
      kind: 'age',
      measurement: { ...source.measurement },
      excludedDrafts: 0,
      points: ageBands.map((band) => ({
        ...band,
        count: subsetCount(
          source.measurement,
          source.rows.filter((row) => ageBandFor(row.ageDays) === band.key).length,
        ),
      })),
    },
  ];
  if (source.kind === 'prs') {
    const eligible = source.rows.filter((row) => !row.draft);
    for (const [kind, field] of [
      ['reviewers', 'humanReviewers'],
      ['approvals', 'approvals'],
    ] as const) {
      const unknown = eligible.filter((row) => row[field] === null).length;
      charts.push({
        kind,
        measurement: subsetCount(source.measurement, eligible.length),
        excludedDrafts: source.rows.length - eligible.length,
        points: reviewBuckets.map((key) => ({
          key,
          label:
            key === 'more'
              ? 'More than two'
              : key === 'unknown'
                ? 'Unknown'
                : key === '0'
                  ? 'Zero'
                  : key === '1'
                    ? 'One'
                    : 'Two',
          count: subsetCount(
            source.measurement,
            eligible.filter((row) => reviewBucket(row[field]) === key).length,
            key === 'unknown' ? 0 : unknown,
          ),
        })),
      });
    }
  }
  return charts;
}
