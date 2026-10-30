import { z } from 'zod';
export const githubProfileUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        url.protocol === 'https:' &&
        ['github.com', 'github.example'].includes(url.hostname) &&
        !url.username &&
        !url.password &&
        !url.port &&
        url.pathname !== '/'
      );
    } catch {
      return false;
    }
  }, 'Expected a GitHub profile URL or an explicit sample profile URL');
