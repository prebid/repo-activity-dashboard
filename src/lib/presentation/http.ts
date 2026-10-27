import type { z } from "zod";
import { errorResponseSchema } from "@/models/account-messages";
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
    throw new Error(error.success ? error.data.error : fallback);
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    throw new Error("The server returned an unexpected response.");
  return parsed.data;
}
