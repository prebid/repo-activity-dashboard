import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { decodeActivitySnapshot } from '../src/server/activity-database';
import activitySnapshot from '../src/server/activity-snapshot.json';
import {
  companyMapping,
  companyMappingFromSheet,
  companyMappingJson,
} from '../src/server/company-mapping';

// Writes the company mapping database sources read, from a "Github Mapping – User List" CSV export:
// npm run data:companies -- /absolute/path/export.csv --exported YYYY-MM-DD
const usage = 'Usage: npm run data:companies -- <sheet export .csv> --exported YYYY-MM-DD';
const { positionals, values } = parseArgs({
  options: { exported: { type: 'string' } },
  allowPositionals: true,
});
const [path, ...extra] = positionals;
if (!path || extra.length || !values.exported) throw new Error(usage);
// The committed mapping, read through its contract, or null while it is the empty one; its
// companies keep their ids.
const previous = companyMapping();
const result = companyMappingFromSheet(readFileSync(path, 'utf8'), values.exported, previous);
const output = 'src/server/company-mapping.json';
writeFileSync(output, companyMappingJson(result.mapping));

const mapped = Object.keys(result.mapping.accounts);
const unmapped = Object.entries(result.unmapped).filter(([, count]) => count > 0);
const known = new Set(
  decodeActivitySnapshot(activitySnapshot.data).users.map((user) => user.login.toLowerCase()),
);
const absent = mapped.filter((login) => !known.has(login)).length;
console.log(
  [
    `Wrote ${output} from the ${values.exported} export: ${result.rows} rows read, ${result.repeated} repeating a login with the same company.`,
    `${mapped.length} logins mapped to ${result.mapping.companies.length} companies; ${unmapped.reduce((sum, [, count]) => sum + count, 0)} left Unmapped (${unmapped.map(([reason, count]) => `${reason} ${count}`).join(', ') || 'none'}).`,
    `${absent} mapped logins have no account in the committed activity snapshot.`,
    `Values read as a stray file path (${result.filePaths.length}):`,
    ...result.filePaths.map((value) => `  ${JSON.stringify(value)}`),
    `Companies named differently from a sheet value (${result.spellings.length}):`,
    ...result.spellings.map(
      ({ name, values: written }) =>
        `  ${name} <- ${written.map((value) => JSON.stringify(value)).join(', ')}`,
    ),
    ...(previous
      ? [
          `Ids kept from the ${previous.exportedOn} mapping under a new display name (${result.keptIds.length}):`,
          ...result.keptIds.map(
            ({ id, previousName, name }) => `  ${id}: ${previousName} -> ${name}`,
          ),
          `Ids of the ${previous.exportedOn} mapping this export drops (${result.droppedIds.length}):`,
          ...result.droppedIds.map(({ id, name }) => `  ${id}: ${name}`),
        ]
      : ['No previous mapping: every company id is the slug of its name.']),
  ].join('\n'),
);
