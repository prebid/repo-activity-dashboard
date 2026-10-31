import type { z } from 'zod';
import { readBoundedBody, RequestBodyError } from './bounded-request';

export const reportingHeaders = {
  'cache-control': 'private, no-store',
  'x-content-type-options': 'nosniff',
} as const;
export const reportingBodyLimit = 64 * 1024;
/**
 * The JSON-POST boundary shared by reporting routes after authentication: JSON media type, a
 * bounded body and a strict schema. `respond` renders each route's rejection for a status.
 */
export async function readReportingJson<T>(
  request: Request,
  schema: z.ZodType<T>,
  respond: (status: number) => Response,
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  if (
    request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
  )
    return { ok: false, response: respond(415) };
  try {
    const body = new TextDecoder().decode(await readBoundedBody(request, reportingBodyLimit));
    return { ok: true, data: schema.parse(JSON.parse(body)) };
  } catch (error) {
    return { ok: false, response: respond(error instanceof RequestBodyError ? error.status : 400) };
  }
}
