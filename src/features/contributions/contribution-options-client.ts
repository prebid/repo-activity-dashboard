import {
  choicePageSchema,
  preferenceCheckSchema,
  type ContributionOptions,
} from '@/models/contribution-options';
import type { ContributionSampleScenario } from '@/models/contribution-page';
export function contributionOptionsClient(sample: ContributionSampleScenario): ContributionOptions {
  async function request(body: object, signal: AbortSignal): Promise<unknown> {
    const response = await fetch('/api/reporting/contribution-options', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, sample }),
    });
    if (
      !response.ok ||
      response.redirected ||
      !response.headers.get('content-type')?.startsWith('application/json')
    )
      throw Error('Report choices unavailable');
    return response.json();
  }
  return {
    choices: async (query, signal) =>
      choicePageSchema.parse(await request({ action: 'choices', query }, signal)),
    validate: async (settings, signal) =>
      preferenceCheckSchema.parse(await request({ action: 'validate', settings }, signal)).settings,
  };
}
