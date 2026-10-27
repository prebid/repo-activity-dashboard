import { z } from "zod";
export const messageResponseSchema = z.object({ message: z.string() });
export const errorResponseSchema = z.object({ error: z.string() });
