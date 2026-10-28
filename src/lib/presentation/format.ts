export function formatCount(value: number | null): string {
  return value === null ? '—' : new Intl.NumberFormat('en-US').format(value);
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
