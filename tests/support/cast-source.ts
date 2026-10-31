import type { RepositoryTimelineScenario } from '@/mocks/repository-timeline';
import type { RepositoryTimelineSource } from '@/models/repository-timeline';
import type { DateRange } from '@/models/reporting-period';

/**
 * The reference cast's records from the repository sample, without its invented bulk history:
 * hand-checkable rows for projection tests. The cast's window is this year; the calendar scenario
 * moves the cast to 2024 to cover a leap year. Records, snapshots and review history are the
 * sample's own, so cutoff membership, dismissals and unknown approvals are its derivation.
 */
const cast = (row: { id: string }) => row.id.startsWith('["contribution-sample"');
function windowFor(calendar: boolean, gap: boolean): DateRange[] {
  const year = calendar ? '2024' : '2026';
  const start = year + '-01-01T00:00:00.000Z',
    end = calendar
      ? { end: '2025-01-01T00:00:00.000Z', endInclusive: false }
      : { end: '2026-10-24T12:00:00.000Z', endInclusive: true };
  return gap
    ? [
        { start, end: year + '-02-01T00:00:00.000Z', endInclusive: false },
        { start: year + '-03-01T00:00:00.000Z', ...end },
      ]
    : [{ start, ...end }];
}
function intersect(ranges: readonly DateRange[], window: readonly DateRange[]): DateRange[] {
  const ms = (at: string) => Date.parse(at);
  return ranges.flatMap((range) =>
    window.flatMap((part) => {
      const start = ms(range.start) > ms(part.start) ? range.start : part.start;
      const rangeEnd = ms(range.end) + Number(range.endInclusive),
        partEnd = ms(part.end) + Number(part.endInclusive);
      const [end, endInclusive] =
        rangeEnd < partEnd ? [range.end, range.endInclusive] : [part.end, part.endInclusive];
      return ms(start) < ms(end) + Number(endInclusive) ? [{ start, end, endInclusive }] : [];
    }),
  );
}
export function onlyCast(
  source: RepositoryTimelineSource,
  scenario: RepositoryTimelineScenario,
  gap: boolean,
): RepositoryTimelineSource {
  const calendar = scenario === 'calendar';
  const shift = <T>(value: T): T =>
    calendar ? (JSON.parse(JSON.stringify(value).replaceAll('"2026-', '"2024-')) as T) : value;
  const window = windowFor(calendar, gap);
  return {
    ...source,
    scenarioId: calendar ? 'repositories-calendar-v1' : source.scenarioId,
    // Every repository shares the cast's window; only the scenario's own coverage rules apply.
    availableRanges: !source.availableRanges.length
      ? []
      : scenario === 'mixed' && source.repository.id === 'repo-prebidserver'
        ? intersect(window, [
            {
              start: '2026-02-01T00:00:00.000Z',
              end: '2026-10-24T12:00:00.000Z',
              endInclusive: true,
            },
          ])
        : window,
    rows: shift(source.rows.filter(cast)),
    snapshots: shift(source.snapshots).map((snapshot) => ({
      ...snapshot,
      rows: snapshot.rows.filter(cast),
    })),
  } as RepositoryTimelineSource;
}
