export type PageSearchParams = Record<string, string | string[] | undefined>;
export function firstSearchParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
export function encodeSearchParams(params: PageSearchParams): string {
  const result = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') result.set(key, value);
    else if (Array.isArray(value)) for (const item of value) result.append(key, item);
  }
  return '?' + result.toString();
}
