export function formatCount(value: number | null): string {
  return value === null ? '—' : new Intl.NumberFormat('en-US').format(value);
}
const dayFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
/** A known nonzero value that would round to zero reads as below the shown precision. */
export function formatDayNumber(value: number | null): string {
  if (value === null) return '—';
  if (value === 0) return '0';
  const size = Math.abs(value);
  return (value < 0 ? '-' : '') + (size < 0.05 ? '<0.1' : dayFormat.format(size));
}
export function formatDays(value: number | null): string {
  return value === null ? '—' : formatDayNumber(value) + ' d';
}
export function formatMeasure(value: number | null, unit: 'count' | 'days'): string {
  return unit === 'days' ? formatDays(value) : formatCount(value);
}
export function compareValues(
  a: string | number | null,
  b: string | number | null,
  direction: 'asc' | 'desc',
): number {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  const result =
    typeof a === 'number' && typeof b === 'number'
      ? a - b
      : String(a).localeCompare(String(b), 'en');
  return direction === 'asc' ? result : -result;
}
export function csvCell(value: string | number | null): string {
  if (value === null) return '';
  const text = String(value);
  // CSV quoting alone does not make spreadsheet formula prefixes inert.
  const formulaPrefix = /^[\s]*[=+@\-＝＋－＠]|^[\t\r\n]/u;
  const safe = typeof value === 'string' && formulaPrefix.test(text) ? "'" + text : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}

function utcDateLabel(date: Date): string {
  const month = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ][date.getUTCMonth()];
  return month + ' ' + date.getUTCDate() + ', ' + date.getUTCFullYear();
}

export function formatUtcDate(iso: string): string {
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? utcDateLabel(date) : '—';
}

export function formatAsOf(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '—';
  // ICU date/time connectors differ between Node and WebKit ("," versus "at").
  // Keep server and client text identical without suppressing hydration diagnostics.
  const hours = date.getUTCHours();
  return (
    utcDateLabel(date) +
    ', ' +
    (hours % 12 || 12) +
    ':' +
    String(date.getUTCMinutes()).padStart(2, '0') +
    (hours < 12 ? ' AM UTC' : ' PM UTC')
  );
}

export interface CountLabels {
  singular: string;
  plural: string;
}
export function countLabel(count: number, labels: CountLabels): string {
  return count === 1 ? labels.singular : labels.plural;
}
