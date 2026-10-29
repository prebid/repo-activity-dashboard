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
/** An explicit column list is authoritative; absent keys use the saved overrides and scope defaults. */
export function resolveTableColumns(
  search: string,
  kind: string,
  defaults: Record<string, boolean>,
  saved: Record<string, boolean>,
  allowed: readonly string[],
): Record<string, boolean> {
  const params = new URLSearchParams(search),
    key = kind + '.columns';
  return params.has(key)
    ? {
        ...defaults,
        ...Object.fromEntries(allowed.map((id) => [id, params.getAll(key).includes(id)])),
      }
    : { ...defaults, ...saved };
}
export function writeTableColumns(
  search: string,
  kind: string,
  columns: Record<string, boolean>,
  allowed: readonly string[],
): string {
  const params = new URLSearchParams(search),
    key = kind + '.columns';
  params.delete(key);
  for (const id of allowed) if (columns[id] !== false) params.append(key, id);
  if (!params.has(key)) params.set(key, '');
  return params.toString();
}
