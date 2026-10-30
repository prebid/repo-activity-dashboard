import { z } from 'zod';

/** Preserve GitHub display casing; normalize only for identity comparisons and route keys. */
export const githubLoginSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9-]+(?:\[bot\])?$/i);
export const normalizeGithubLogin = (login: string): string => login.toLowerCase();
export const accountTypeLabels = {
  human: 'Human',
  agent: 'Prebid agent',
  bot: 'Bot',
  unknown: 'Unknown',
} as const;
