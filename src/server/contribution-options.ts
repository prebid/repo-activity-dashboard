import 'server-only';
import { requireViewer } from '@/lib/auth/viewer';
import { readBoundedBody, RequestBodyError } from '@/lib/auth/bounded-request';
import { contributionOptionsRequestSchema } from '@/models/contribution-options';
import { contributionDirectorySample, contributionSampleAsOf } from '@/mocks/contributions';
import { selectContributionChoices } from '@/lib/presentation/contribution-options';
import { validateContributionSettings } from '@/lib/presentation/contribution-settings';
const headers = { 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' };
/** Read-only prepared identities. No reporting facts, database, or external requests. */
export async function contributionOptionsResponse(request: Request): Promise<Response> {
  await requireViewer();
  if (
    request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
  )
    return Response.json({ error: 'Expected JSON.' }, { status: 415, headers });
  let input: unknown;
  try {
    input = JSON.parse(new TextDecoder().decode(await readBoundedBody(request, 64 * 1024)));
  } catch (error) {
    return Response.json(
      { error: 'Invalid options request.' },
      { status: error instanceof RequestBodyError ? error.status : 400, headers },
    );
  }
  const parsed = contributionOptionsRequestSchema.safeParse(input);
  if (!parsed.success)
    return Response.json({ error: 'Invalid options request.' }, { status: 400, headers });
  const command = parsed.data,
    directory = contributionDirectorySample(command.sample);
  return Response.json(
    command.action === 'choices'
      ? selectContributionChoices(directory, command.query)
      : {
          settings: validateContributionSettings(
            command.settings,
            directory,
            contributionSampleAsOf,
          ),
        },
    { headers },
  );
}
