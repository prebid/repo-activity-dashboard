export { resolveTableColumns, writeTableColumns } from './url/legacy/table-columns';
export function readTableColumns(
  raw: string | null,
  allowed: readonly string[],
): Record<string, boolean> {
  try {
    const parsed: unknown = JSON.parse(raw ?? 'null');
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('version' in parsed) ||
      parsed.version !== 1 ||
      !('columns' in parsed) ||
      !parsed.columns ||
      typeof parsed.columns !== 'object' ||
      Array.isArray(parsed.columns)
    )
      return {};
    return Object.fromEntries(
      Object.entries(parsed.columns).filter(
        ([id, value]) => allowed.includes(id) && typeof value === 'boolean',
      ),
    );
  } catch {
    return {};
  }
}
