import { NextResponse } from 'next/server';
import { readBoundedBody, RequestBodyError } from './bounded-request';
import type { z } from 'zod';
export async function readRequestBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  let input: unknown;
  try {
    input = JSON.parse(new TextDecoder().decode(await readBoundedBody(request))) as unknown;
  } catch (error) {
    if (error instanceof RequestBodyError)
      return {
        ok: false,
        response: NextResponse.json({ error: error.message }, { status: error.status }),
      };
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }),
    };
  }
  const result = schema.safeParse(input);
  return result.success
    ? { ok: true, data: result.data }
    : {
        ok: false,
        response: NextResponse.json({ error: 'Invalid request fields' }, { status: 400 }),
      };
}
