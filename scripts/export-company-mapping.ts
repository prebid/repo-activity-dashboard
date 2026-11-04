import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { decodeActivitySnapshot } from '../src/server/activity-database';
import activitySnapshot from '../src/server/activity-snapshot.json';
import { companyMappingFromSheet, companyMappingJson } from '../src/server/company-mapping';

// Writes the company mapping database sources read, from a "Github Mapping – User List" CSV export:
// npm run data:companies -- /absolute/path/export.csv --exported YYYY-MM-DD
const usage = 'Usage: npm run data:companies -- <sheet export .csv> --exported YYYY-MM-DD';
const { positionals, values } = parseArgs({
  options: { exported: { type: 'string' } },
  allowPositionals: true,
});
const [path, ...extra] = positionals;
if (!path || extra.length || !values.exported) throw new Error(usage);
const result = companyMappingFromSheet(readFileSync(path, 'utf8'), values.exported);
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
    `Companies named differently from a sheet value (${result.spellings.length}):`,
    ...result.spellings.map(
      ({ name, values: written }) =>
        `  ${name} <- ${written.map((value) => JSON.stringify(value)).join(', ')}`,
    ),
  ].join('\n'),
);
