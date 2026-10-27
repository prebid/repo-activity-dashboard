export interface TimelineData {
  data: Record<string, unknown>;
}
export interface MappingData {
  mapping: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}
export interface ReportData {
  timeline: TimelineData;
  mapping: MappingData;
}

// Keep each authenticated response comfortably below the hosting response-size limit.
export function splitTimeline(
  data: Record<string, unknown>,
  maxBytes = 512 * 1024,
): Record<string, unknown>[] {
  const parts: Record<string, unknown>[] = [];
  let part: Record<string, unknown> = {},
    bytes = 2;
  for (const [key, value] of Object.entries(data)) {
    const size = new TextEncoder().encode(
      JSON.stringify({ [key]: value }),
    ).length;
    if (size > maxBytes)
      throw new Error("Timeline record exceeds response limit");
    if (bytes + size > maxBytes && Object.keys(part).length) {
      parts.push(part);
      part = {};
      bytes = 2;
    }
    Object.defineProperty(part, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
    bytes += size;
  }
  if (Object.keys(part).length || !parts.length) parts.push(part);
  return parts;
}
