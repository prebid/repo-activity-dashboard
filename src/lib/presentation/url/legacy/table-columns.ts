// Frozen pre-codec URL readers, moved unchanged. They decode old links for the 307 to the
// canonical form and serve callers that have not moved to the codec yet.
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
