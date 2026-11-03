import 'server-only';
import { requireViewer } from '@/lib/auth/viewer';
import { readReportingJson, reportingHeaders as headers } from '@/lib/auth/reporting-request';
import { contributionOptionsRequestSchema } from '@/models/contribution-options';
import { contributionRecords } from './activity-contributions';
import { selectContributionChoices } from '@/lib/presentation/contribution-options';
import { validateContributionSettings } from '@/lib/presentation/contribution-settings';
/** Read-only prepared identities. No reporting facts, database, or external requests. */
export async function contributionOptionsResponse(request: Request): Promise<Response> {
  await requireViewer();
  const read = await readReportingJson(request, contributionOptionsRequestSchema, (status) =>
    Response.json(
      { error: status === 415 ? 'Expected JSON.' : 'Invalid options request.' },
      { status, headers },
    ),
  );
  if (!read.ok) return read.response;
  const records = contributionRecords();
  const command = read.data,
    directory = records.directory(command.sample);
  return Response.json(
    command.action === 'choices'
      ? selectContributionChoices(directory, command.query)
      : {
          settings: validateContributionSettings(command.settings, directory, records.asOf),
        },
    { headers },
  );
}
