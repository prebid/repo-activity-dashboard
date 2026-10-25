export function encodeSearchParams(params: Record<string, string | string[] | undefined>): string {
  const result = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (typeof value === 'string') result.set(key, value);
  return '?' + result.toString();
}
