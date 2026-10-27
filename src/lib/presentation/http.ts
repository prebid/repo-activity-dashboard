import type { z } from 'zod';
import { errorResponseSchema } from '@/models/accounts';
class RejectedRequest extends Error {}
export function mutationFailureMessage(error: unknown, unknownOutcome: string): string {
  return error instanceof RejectedRequest ? error.message : unknownOutcome;
}
export async function readJsonResponse<T>(
  response: Response,
  schema: z.ZodType<T>,
  fallback: string,
): Promise<T> {
  let input: unknown;
  try {
    input = await response.json();
  } catch {
    throw new Error(fallback);
  }
  if (!response.ok) {
    const error = errorResponseSchema.safeParse(input);
    if (response.status >= 400 && response.status < 500 && error.success)
      throw new RejectedRequest(error.data.error);
    throw new Error(fallback);
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new Error('The server returned an unexpected response.');
  return parsed.data;
}
