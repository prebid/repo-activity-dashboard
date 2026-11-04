import 'server-only';
import { companyMappingSchema, type CompanyMapping } from '@/models/company-mapping';
import { githubLoginSchema, normalizeGithubLogin } from '@/models/github-account';
import { calendarDateSchema } from '@/models/reporting-period';
import bundledMapping from './company-mapping.json';

/**
 * The company mapping database sources attribute accounts with, and its import from the
 * "Github Mapping – User List" sheet export. The import reads only the Username and Company
 * columns; names, notes, membership and PMC reviewer data never enter the mapping.
 */

let bundled: { mapping: CompanyMapping | null } | undefined;
/** The bundled mapping, parsed once per server process; null while no mapping is connected. */
export function companyMapping(): CompanyMapping | null {
  if (!bundled) {
    const mapping = companyMappingSchema.parse(bundledMapping);
    bundled = { mapping: mapping.exportedOn === null ? null : mapping };
  }
  return bundled.mapping;
}

/** The mapping file as `npm run data:companies` writes it: one line per login. */
export function companyMappingJson(mapping: CompanyMapping): string {
  return JSON.stringify(companyMappingSchema.parse(mapping), null, 2) + '\n';
}

export interface CsvRecord {
  /** The line the record starts on; a quoted field can continue it over further lines. */
  line: number;
  fields: string[];
}

/**
 * RFC 4180 records: comma-separated fields, quoted fields with doubled quotes and line breaks
 * inside them, and CRLF or LF line ends. Malformed quoting is refused rather than guessed.
 */
export function csvRecords(text: string): CsvRecord[] {
  // A UTF-8 byte order mark is not part of the first field.
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const records: CsvRecord[] = [];
  let fields: string[] = [];
  let field = '';
  let quoted = false;
  let open = false;
  let line = 1;
  let start = 1;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    open = true;
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
        const next = source.slice(index + 1, index + 3);
        if (next && !/^(?:,|\n|\r\n)/.test(next))
          throw new Error(`CSV line ${line}: unexpected text after a closing quote.`);
      } else {
        if (char === '\n') line++;
        field += char;
      }
    } else if (char === '"') {
      if (field) throw new Error(`CSV line ${line}: a quote inside an unquoted field.`);
      quoted = true;
    } else if (char === ',') {
      fields.push(field);
      field = '';
    } else if (char === '\n' || (char === '\r' && source[index + 1] === '\n')) {
      if (char === '\r') index++;
      fields.push(field);
      records.push({ line: start, fields });
      fields = [];
      field = '';
      open = false;
      start = ++line;
    } else field += char;
  }
  if (quoted) throw new Error(`CSV line ${start}: a quoted field is not closed.`);
  if (open) {
    fields.push(field);
    records.push({ line: start, fields });
  }
  return records;
}

/** Company values that name no company, compared lowercased. */
const placeholderValues = [
  'none',
  'independent developer',
  'small pub',
  'bot',
  'github bot',
] as const;
/**
 * Why a login is Unmapped: a blank company, a placeholder, or a stray file path, a value with a
 * directory separator and a source-file extension.
 */
export const unmappedReasons = ['blank', ...placeholderValues, 'file path'] as const;
export type UnmappedReason = (typeof unmappedReasons)[number];
const placeholders = new Set<string>(placeholderValues);

type Attribution =
  | { kind: 'unmapped'; reason: UnmappedReason }
  | { kind: 'company'; value: string; spelling: string; key: string };

const folded = (value: string) => value.normalize('NFKD').toLowerCase().replace(/\p{M}/gu, '');
/** Case, spacing and punctuation variants share a key; different words never do. */
const spellingKey = (spelling: string) => folded(spelling).replace(/[^\p{L}\p{N}]/gu, '');
const slug = (name: string) =>
  folded(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function attribution(value: string): Attribution {
  const trimmed = value.trim();
  if (!trimmed) return { kind: 'unmapped', reason: 'blank' };
  if (/^[\w.-]+(?:\/[\w.-]+)+\.(?:[cm]?[jt]sx?)$/i.test(trimmed))
    return { kind: 'unmapped', reason: 'file path' };
  let spelling = trimmed;
  // A parenthetical qualifies a name, as in "Name (Parent)"; the name without it is the company.
  for (let previous = ''; previous !== spelling;) {
    previous = spelling;
    spelling = spelling.replace(/\([^()]*\)/g, ' ');
  }
  spelling = spelling.replace(/\s+/g, ' ').trim();
  const lower = spelling.toLowerCase();
  if (placeholders.has(lower)) return { kind: 'unmapped', reason: lower as UnmappedReason };
  return { kind: 'company', value, spelling, key: spellingKey(spelling) };
}

const byCodeUnits = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
/** What a row attributes its login to: a company's spelling key, or Unmapped. */
const outcome = (row: Attribution) => (row.kind === 'company' ? row.key : null);

export interface CompanySheetImport {
  mapping: CompanyMapping;
  /** Sheet rows read: the header and empty rows are not counted. */
  rows: number;
  /** Rows that repeat a login with the same company, read once. */
  repeated: number;
  /** Logins left Unmapped, by the placeholder that left them so. */
  unmapped: Record<UnmappedReason, number>;
  /** The values read as a stray file path, trimmed, without repeats and sorted. */
  filePaths: string[];
  /** Companies whose sheet values differ from their display name, with those values as written. */
  spellings: { id: string; name: string; values: string[] }[];
  /** Companies of the previous mapping that keep their id under a different display name. */
  keptIds: { id: string; previousName: string; name: string }[];
  /** Companies of the previous mapping that this export no longer lists, with their ids. */
  droppedIds: { id: string; name: string }[];
}

/**
 * The mapping from a "Github Mapping – User List" CSV export. Logins are matched lowercased.
 * Placeholder companies leave a login Unmapped. Spellings that differ only in case, spacing,
 * punctuation or a parenthetical merge under the most frequent spelling, ties going to code-unit
 * order. A company the previous mapping lists under the same spelling keeps its id, whatever its
 * display name now is; any other company's id is the ASCII slug of its name. A login listed with two
 * different companies, a missing column, an invalid login, and a new id that two names would share
 * or that the previous mapping gave another company are refused.
 */
export function companyMappingFromSheet(
  csvText: string,
  exportedOn: string,
  previous?: CompanyMapping | null,
): CompanySheetImport {
  if (!calendarDateSchema.safeParse(exportedOn).success)
    throw new Error('Expected the export date as YYYY-MM-DD, not ' + JSON.stringify(exportedOn));
  const [header, ...records] = csvRecords(csvText);
  if (!header) throw new Error('The sheet export is empty.');
  const names = header.fields.map((name) => name.trim());
  const column = (name: string) => {
    const index = names.indexOf(name);
    if (index < 0) throw new Error(`The sheet export has no ${name} column.`);
    if (names.indexOf(name, index + 1) >= 0)
      throw new Error(`The sheet export has more than one ${name} column.`);
    return index;
  };
  const loginColumn = column('Username');
  const companyColumn = column('Company');
  const logins = new Map<string, { line: number; attribution: Attribution }>();
  const filePaths = new Set<string>();
  let rows = 0;
  let repeated = 0;
  for (const { line, fields } of records) {
    if (fields.every((field) => !field.trim())) continue;
    if (fields.length !== names.length)
      throw new Error(`CSV line ${line}: expected ${names.length} fields, found ${fields.length}.`);
    rows++;
    const login = fields[loginColumn].trim();
    if (!githubLoginSchema.safeParse(login).success)
      throw new Error(`CSV line ${line}: ${JSON.stringify(login)} is not a GitHub login.`);
    const key = normalizeGithubLogin(login);
    const row = attribution(fields[companyColumn]);
    if (row.kind === 'unmapped' && row.reason === 'file path')
      filePaths.add(fields[companyColumn].trim());
    const listed = logins.get(key);
    if (!listed) {
      logins.set(key, { line, attribution: row });
      continue;
    }
    if (outcome(listed.attribution) !== outcome(row))
      throw new Error(
        `${login} is listed on CSV lines ${listed.line} and ${line} with different companies.`,
      );
    repeated++;
  }

  const unmapped = Object.fromEntries(unmappedReasons.map((reason) => [reason, 0])) as Record<
    UnmappedReason,
    number
  >;
  const groups = new Map<
    string,
    {
      line: number;
      written: string;
      logins: string[];
      counts: Map<string, number>;
      values: Set<string>;
    }
  >();
  for (const [login, { line, attribution: row }] of logins) {
    if (row.kind === 'unmapped') {
      unmapped[row.reason]++;
      continue;
    }
    let group = groups.get(row.key);
    if (!group)
      groups.set(
        row.key,
        (group = {
          line,
          written: row.value.trim(),
          logins: [],
          counts: new Map(),
          values: new Set(),
        }),
      );
    group.logins.push(login);
    group.counts.set(row.spelling, (group.counts.get(row.spelling) ?? 0) + 1);
    group.values.add(row.value);
  }

  // A company the previous mapping lists keeps its id; the spelling key decides which one it is.
  const previousByKey = new Map<string, { id: string; name: string }>();
  for (const company of previous?.companies ?? []) {
    const key = spellingKey(company.name);
    const listed = previousByKey.get(key);
    if (listed)
      throw new Error(
        `The previous mapping lists ${JSON.stringify(listed.name)} (${listed.id}) and ${JSON.stringify(company.name)} (${company.id}) as one company.`,
      );
    previousByKey.set(key, { id: company.id, name: company.name });
  }
  const named = [...groups].map(([key, group]) => {
    const [[name]] = [...group.counts].sort((a, b) => b[1] - a[1] || byCodeUnits(a[0], b[0]));
    return { group, name, kept: previousByKey.get(key) };
  });
  const droppedIds = [...previousByKey]
    .filter(([key]) => !groups.has(key))
    .map(([, company]) => company)
    .sort((a, b) => byCodeUnits(a.id, b.id));
  const dropped = new Map(droppedIds.map((company) => [company.id, company]));

  const companies = new Map<string, { name: string; line: number; kept: boolean }>();
  // Kept ids first, so a new company's slug cannot take one.
  for (const { group, name, kept } of named)
    if (kept) companies.set(kept.id, { name, line: group.line, kept: true });
  const ids = named.map(({ group, name, kept }) => {
    if (kept) return kept.id;
    const id = slug(name);
    if (!id)
      throw new Error(
        `CSV line ${group.line}: the company ${JSON.stringify(group.written)} has no ASCII letter or digit for an id.`,
      );
    if (id === 'unmapped')
      throw new Error(
        `CSV line ${group.line}: the company ${JSON.stringify(name)} would take the reserved id unmapped.`,
      );
    const taken = companies.get(id);
    if (taken?.kept)
      throw new Error(
        `The company ${JSON.stringify(name)} (CSV line ${group.line}) would take the id ${id}, which ${JSON.stringify(taken.name)} (CSV line ${taken.line}) keeps from the previous mapping.`,
      );
    if (taken)
      throw new Error(
        `The companies ${JSON.stringify(taken.name)} (CSV line ${taken.line}) and ${JSON.stringify(name)} (CSV line ${group.line}) would share the id ${id}.`,
      );
    const gone = dropped.get(id);
    if (gone)
      throw new Error(
        `The company ${JSON.stringify(name)} (CSV line ${group.line}) would take the id ${id}, which the previous mapping gave ${JSON.stringify(gone.name)}.`,
      );
    companies.set(id, { name, line: group.line, kept: false });
    return id;
  });

  const accounts: [string, string][] = [];
  const spellings: CompanySheetImport['spellings'] = [];
  const keptIds: CompanySheetImport['keptIds'] = [];
  named.forEach(({ group, name, kept }, index) => {
    const id = ids[index];
    for (const login of group.logins) accounts.push([login, id]);
    const values = [...group.values].sort(byCodeUnits);
    if (values.some((value) => value !== name)) spellings.push({ id, name, values });
    if (kept && kept.name !== name) keptIds.push({ id, previousName: kept.name, name });
  });
  if (!accounts.length) throw new Error('The sheet export maps no login to a company.');

  const mapping = companyMappingSchema.parse({
    format: 1,
    exportedOn,
    companies: [...companies]
      .sort(([a], [b]) => byCodeUnits(a, b))
      .map(([id, { name }]) => ({ id, name })),
    accounts: Object.fromEntries(accounts.sort(([a], [b]) => byCodeUnits(a, b))),
  });
  spellings.sort((a, b) => byCodeUnits(a.id, b.id));
  keptIds.sort((a, b) => byCodeUnits(a.id, b.id));
  return {
    mapping,
    rows,
    repeated,
    unmapped,
    filePaths: [...filePaths].sort(byCodeUnits),
    spellings,
    keptIds,
    droppedIds,
  };
}
