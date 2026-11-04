// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { companyMappingSchema, type CompanyMapping } from '@/models/company-mapping';

vi.mock('server-only', () => ({}));
const { companyMapping, companyMappingFromSheet, companyMappingJson, csvRecords } =
  await import('@/server/company-mapping');
const committed = (await import('@/server/company-mapping.json')).default;

afterEach(() => {
  vi.doUnmock('@/server/company-mapping.json');
  vi.resetModules();
});

const exportedOn = '2025-09-12';
const csv = (...lines: string[]) => lines.join('\r\n') + '\r\n';
const header = 'Username,Name,Company,Notes,Member,PMC Reviewer,PMC Reviewer Notes';
/** Invented logins and companies. Every Name, Notes, Member and PMC value contains "Fixture". */
const sheet = csv(
  header,
  'Alpha-One,Fixture Name One,Acme Widgets,"Fixture note, with a comma",Fixture Member,Fixture PMC,"Fixture PMC note',
  'over two lines"',
  'beta,"Fixture ""Quoted"" Name",acme  widgets,,Fixture Member,,',
  'gamma,Fixture Name Three,ACME-Widgets (Holding Co),,,,',
  'delta,,Acme Widgets,,,,',
  'epsilon,,"Initech\r",,,,',
  'zeta,, Initech ,,,,',
  'eta,,Initrode,,,,',
  'theta,,Globex Corporation,,,,',
  'iota,,Globex,,,,',
  'kappa,,,Fixture note,,,',
  'lambda,,None,,,,',
  'mu,,NONE,,,,',
  'nu,,independent developer,,,,',
  'xi,,Small Pub,,,,',
  'omicron[bot],,bot,,,,',
  'pi,,GitHub Bot,,,,',
  'rho,,src/fixture/util.js,,,,',
  'sigma,,Foo / Bar Media,,,,',
  'tau,,Café Müller!,,,,',
  ',,,,,,',
  'Delta,,acme widgets,,,,',
  'Upsilon,,Tie Beta,,,,',
  'phi,,tie-beta,,,,',
);

describe('CSV records', () => {
  it('reads quoted fields, doubled quotes, line breaks inside quotes and CRLF or LF line ends', () => {
    expect(csvRecords('a,b\r\n"c,d","e""f"\r\n"g\r\nh\ni",j\n,\nk,"",l')).toEqual([
      { line: 1, fields: ['a', 'b'] },
      { line: 2, fields: ['c,d', 'e"f'] },
      { line: 3, fields: ['g\r\nh\ni', 'j'] },
      { line: 6, fields: ['', ''] },
      { line: 7, fields: ['k', '', 'l'] },
    ]);
  });

  it('keeps empty lines and empty quoted fields, and ignores a byte order mark', () => {
    expect(csvRecords(String.fromCharCode(0xfeff) + 'a\n\n""')).toEqual([
      { line: 1, fields: ['a'] },
      { line: 2, fields: [''] },
      { line: 3, fields: [''] },
    ]);
    expect(csvRecords('a\rb,c')).toEqual([{ line: 1, fields: ['a\rb', 'c'] }]);
    expect(csvRecords('')).toEqual([]);
  });

  it('refuses malformed quoting instead of guessing', () => {
    expect(() => csvRecords('a\n"b\nc')).toThrow('CSV line 2: a quoted field is not closed.');
    expect(() => csvRecords('a\nb"c"')).toThrow('CSV line 2: a quote inside an unquoted field.');
    expect(() => csvRecords('"a"b')).toThrow('CSV line 1: unexpected text after a closing quote.');
    expect(() => csvRecords('"a"\r')).toThrow('CSV line 1: unexpected text after a closing quote.');
  });
});

describe('company mapping from the sheet', () => {
  it('maps lowercased logins to merged companies with slug ids, sorted', () => {
    const result = companyMappingFromSheet(sheet, exportedOn);
    expect(result.mapping).toEqual({
      format: 1,
      exportedOn,
      companies: [
        { id: 'acme-widgets', name: 'Acme Widgets' },
        { id: 'cafe-muller', name: 'Café Müller!' },
        { id: 'foo-bar-media', name: 'Foo / Bar Media' },
        { id: 'globex', name: 'Globex' },
        { id: 'globex-corporation', name: 'Globex Corporation' },
        { id: 'initech', name: 'Initech' },
        { id: 'initrode', name: 'Initrode' },
        { id: 'tie-beta', name: 'Tie Beta' },
      ],
      accounts: {
        'alpha-one': 'acme-widgets',
        beta: 'acme-widgets',
        delta: 'acme-widgets',
        epsilon: 'initech',
        eta: 'initrode',
        gamma: 'acme-widgets',
        iota: 'globex',
        phi: 'tie-beta',
        sigma: 'foo-bar-media',
        tau: 'cafe-muller',
        theta: 'globex-corporation',
        upsilon: 'tie-beta',
        zeta: 'initech',
      },
    });
    expect(Object.keys(result.mapping.accounts)).toEqual(
      Object.keys(result.mapping.accounts).sort(),
    );
  });

  it('counts rows, repeated logins and Unmapped logins by placeholder', () => {
    const result = companyMappingFromSheet(sheet, exportedOn);
    expect(result.rows).toBe(22);
    expect(result.repeated).toBe(1);
    expect(result.unmapped).toEqual({
      blank: 1,
      none: 2,
      'independent developer': 1,
      'small pub': 1,
      bot: 1,
      'github bot': 1,
      'file path': 1,
    });
  });

  it('names each company by its most frequent spelling and lists the values it merged', () => {
    expect(companyMappingFromSheet(sheet, exportedOn).spellings).toEqual([
      {
        id: 'acme-widgets',
        name: 'Acme Widgets',
        values: ['ACME-Widgets (Holding Co)', 'Acme Widgets', 'acme  widgets'],
      },
      { id: 'initech', name: 'Initech', values: [' Initech ', 'Initech\r'] },
      // A tie goes to code-unit order.
      { id: 'tie-beta', name: 'Tie Beta', values: ['Tie Beta', 'tie-beta'] },
    ]);
  });

  it('keeps names, notes, membership and PMC reviewer data out of the mapping', () => {
    const result = companyMappingFromSheet(sheet, exportedOn);
    expect(companyMappingJson(result.mapping)).not.toContain('Fixture');
    expect(JSON.stringify(result)).not.toContain('Fixture');
  });

  it('accepts a login listed twice with the same company once, whatever the spelling', () => {
    const result = companyMappingFromSheet(
      csv('Username,Company', 'alpha,Acme', 'ALPHA,ACME (Group)', 'beta,', 'beta,None'),
      exportedOn,
    );
    expect(result.repeated).toBe(2);
    expect(result.mapping.accounts).toEqual({ alpha: 'acme' });
    expect(result.unmapped.blank).toBe(1);
  });

  it('treats only the listed placeholders as Unmapped', () => {
    const result = companyMappingFromSheet(
      csv('Username,Company', 'a,Blank', 'b,File Path', 'c,Bots Inc', 'd,lib/util.js'),
      exportedOn,
    );
    expect(result.mapping.accounts).toEqual({ a: 'blank', b: 'file-path', c: 'bots-inc' });
    expect(result.unmapped['file path']).toBe(1);
  });

  it('reads only a path with a directory and a source-file extension as a stray file path', () => {
    const result = companyMappingFromSheet(
      csv(
        'Username,Company',
        'a,lib/util.js',
        'b,src/kit/Widget.TSX',
        'c, lib/util.js ',
        'd,Foo/Bar',
        'e,Example.js',
      ),
      exportedOn,
    );
    expect(result.unmapped['file path']).toBe(3);
    expect(result.filePaths).toEqual(['lib/util.js', 'src/kit/Widget.TSX']);
    expect(result.mapping.accounts).toEqual({ d: 'foo-bar', e: 'example-js' });
    expect(companyMappingFromSheet(sheet, exportedOn).filePaths).toEqual(['src/fixture/util.js']);
  });

  it('refuses a login listed with two different companies, naming both lines', () => {
    expect(() =>
      companyMappingFromSheet(
        csv(
          'Username,Company,Notes',
          'first,Acme,"two',
          'lines"',
          'dup,Acme,',
          'other,Globex,',
          'DUP,Globex,',
        ),
        exportedOn,
      ),
    ).toThrow('DUP is listed on CSV lines 4 and 6 with different companies.');
    expect(() =>
      companyMappingFromSheet(csv('Username,Company', 'dup,', 'dup,Acme'), exportedOn),
    ).toThrow('dup is listed on CSV lines 2 and 3 with different companies.');
  });

  it('refuses a sheet without the Username or Company column, or with either twice', () => {
    expect(() => companyMappingFromSheet(csv('User,Company', 'a,Acme'), exportedOn)).toThrow(
      'The sheet export has no Username column.',
    );
    expect(() => companyMappingFromSheet(csv('Username,Firm', 'a,Acme'), exportedOn)).toThrow(
      'The sheet export has no Company column.',
    );
    expect(() =>
      companyMappingFromSheet(csv('Username,Company,Company', 'a,Acme,Acme'), exportedOn),
    ).toThrow('The sheet export has more than one Company column.');
    expect(() => companyMappingFromSheet('', exportedOn)).toThrow('The sheet export is empty.');
  });

  it('refuses invalid logins, ragged rows and an invalid export date', () => {
    expect(() =>
      companyMappingFromSheet(csv('Username,Company', 'good,Acme', 'bad_login,Acme'), exportedOn),
    ).toThrow('CSV line 3: "bad_login" is not a GitHub login.');
    expect(() => companyMappingFromSheet(csv('Username,Company', ' ,Acme'), exportedOn)).toThrow(
      'CSV line 2: "" is not a GitHub login.',
    );
    expect(() =>
      companyMappingFromSheet(csv('Username,Company,Notes', 'a,Acme'), exportedOn),
    ).toThrow('CSV line 2: expected 3 fields, found 2.');
    for (const date of ['2025-02-30', '12/09/2025', ''])
      expect(() => companyMappingFromSheet(csv('Username,Company', 'a,Acme'), date)).toThrow(
        'Expected the export date as YYYY-MM-DD',
      );
  });

  it('refuses company names that give no id, the reserved id, or an id two names share', () => {
    expect(() => companyMappingFromSheet(csv('Username,Company', 'a,日本'), exportedOn)).toThrow(
      'CSV line 2: the company "日本" has no ASCII letter or digit for an id.',
    );
    expect(() =>
      companyMappingFromSheet(csv('Username,Company', 'a,(Pending)'), exportedOn),
    ).toThrow('CSV line 2: the company "(Pending)" has no ASCII letter or digit for an id.');
    expect(() =>
      companyMappingFromSheet(csv('Username,Company', 'a,Unmapped'), exportedOn),
    ).toThrow('CSV line 2: the company "Unmapped" would take the reserved id unmapped.');
    expect(() =>
      companyMappingFromSheet(csv('Username,Company', 'a,Foo日本', 'b,Foo中国'), exportedOn),
    ).toThrow(
      'The companies "Foo日本" (CSV line 2) and "Foo中国" (CSV line 3) would share the id foo.',
    );
  });

  it('refuses a sheet that maps no login to a company', () => {
    expect(() => companyMappingFromSheet(csv('Username,Company'), exportedOn)).toThrow(
      'The sheet export maps no login to a company.',
    );
    expect(() =>
      companyMappingFromSheet(csv('Username,Company', 'a,None', 'b,'), exportedOn),
    ).toThrow('The sheet export maps no login to a company.');
  });
});

describe('company ids across refreshes', () => {
  const later = '2025-10-01';
  const header = 'Username,Company';

  it('keeps the id of a company whose most frequent spelling changes', () => {
    const first = companyMappingFromSheet(
      csv(header, 'a,Blue Kite Media', 'b,Blue Kite Media', 'c,BlueKite Media'),
      exportedOn,
    );
    expect(first.mapping.companies).toEqual([{ id: 'blue-kite-media', name: 'Blue Kite Media' }]);
    const refreshed = csv(
      header,
      'a,Blue Kite Media',
      'b,BlueKite Media',
      'c,BlueKite Media',
      'd,BlueKite Media',
    );
    // On its own the new majority spelling would give another id.
    expect(companyMappingFromSheet(refreshed, later).mapping.companies).toEqual([
      { id: 'bluekite-media', name: 'BlueKite Media' },
    ]);

    const next = companyMappingFromSheet(refreshed, later, first.mapping);
    expect(next.mapping.companies).toEqual([{ id: 'blue-kite-media', name: 'BlueKite Media' }]);
    expect(next.mapping.accounts).toEqual({
      a: 'blue-kite-media',
      b: 'blue-kite-media',
      c: 'blue-kite-media',
      d: 'blue-kite-media',
    });
    expect(next.keptIds).toEqual([
      { id: 'blue-kite-media', previousName: 'Blue Kite Media', name: 'BlueKite Media' },
    ]);
    expect(next.droppedIds).toEqual([]);
    // The id stays on the next refresh too, and an unchanged name is not listed.
    const again = companyMappingFromSheet(refreshed, later, next.mapping);
    expect(again.mapping).toEqual(next.mapping);
    expect(again.keptIds).toEqual([]);
  });

  it('gives a new company its slug and lists the previous companies an export drops', () => {
    const first = companyMappingFromSheet(
      csv(header, 'a,Acme Widgets', 'b,Globex', 'c,Initech'),
      exportedOn,
    );
    const next = companyMappingFromSheet(
      csv(header, 'a,ACME widgets', 'c,Initrode Labs', 'd,Initech Group'),
      later,
      first.mapping,
    );
    expect(next.mapping).toEqual({
      format: 1,
      exportedOn: later,
      companies: [
        { id: 'acme-widgets', name: 'ACME widgets' },
        { id: 'initech-group', name: 'Initech Group' },
        { id: 'initrode-labs', name: 'Initrode Labs' },
      ],
      accounts: { a: 'acme-widgets', c: 'initrode-labs', d: 'initech-group' },
    });
    expect(next.keptIds).toEqual([
      { id: 'acme-widgets', previousName: 'Acme Widgets', name: 'ACME widgets' },
    ]);
    expect(next.droppedIds).toEqual([
      { id: 'globex', name: 'Globex' },
      { id: 'initech', name: 'Initech' },
    ]);
    // Without a previous mapping nothing is kept or dropped.
    for (const previous of [undefined, null]) {
      const fresh = companyMappingFromSheet(csv(header, 'a,ACME widgets'), later, previous);
      expect(fresh.mapping.companies).toEqual([{ id: 'acme-widgets', name: 'ACME widgets' }]);
      expect([fresh.keptIds, fresh.droppedIds]).toEqual([[], []]);
    }
  });

  it('refuses a new id that a kept or a dropped company holds', () => {
    // Letters outside ASCII leave the slug, so these two spellings differ but share a slug.
    const first = companyMappingFromSheet(csv(header, 'a,Kite 日本'), exportedOn);
    expect(first.mapping.companies).toEqual([{ id: 'kite', name: 'Kite 日本' }]);
    expect(() =>
      companyMappingFromSheet(csv(header, 'b,Kite', 'a,Kite 日本'), later, first.mapping),
    ).toThrow(
      'The company "Kite" (CSV line 2) would take the id kite, which "Kite 日本" (CSV line 3) keeps from the previous mapping.',
    );
    expect(() => companyMappingFromSheet(csv(header, 'b,Kite'), later, first.mapping)).toThrow(
      'The company "Kite" (CSV line 2) would take the id kite, which the previous mapping gave "Kite 日本".',
    );
  });

  it('refuses a previous mapping that lists one company twice', () => {
    const previous: CompanyMapping = {
      format: 1,
      exportedOn,
      companies: [
        { id: 'acme', name: 'Acme' },
        { id: 'acme-co', name: 'ACME' },
      ],
      accounts: { a: 'acme', b: 'acme-co' },
    };
    expect(() => companyMappingFromSheet(csv(header, 'a,Acme'), later, previous)).toThrow(
      'The previous mapping lists "Acme" (acme) and "ACME" (acme-co) as one company.',
    );
  });
});

describe('company mapping contract', () => {
  const valid = {
    format: 1,
    exportedOn,
    companies: [
      { id: 'acme', name: 'Acme' },
      { id: 'globex', name: 'Globex' },
    ],
    accounts: { alice: 'acme', bob: 'globex', constructor: 'acme' },
  };
  const issue = (value: unknown) => companyMappingSchema.safeParse(value).error?.issues[0];

  it('accepts a complete mapping and the empty one', () => {
    expect(companyMappingSchema.parse(valid)).toEqual(valid);
    expect(
      companyMappingSchema.parse({ format: 1, exportedOn: null, companies: [], accounts: {} }),
    ).toEqual({ format: 1, exportedOn: null, companies: [], accounts: {} });
  });

  it.each([
    ['another format', { ...valid, format: 2 }],
    ['an invalid export date', { ...valid, exportedOn: '2025-02-30' }],
    ['an extra field', { ...valid, names: {} }],
    [
      'an extra company field',
      { ...valid, companies: [{ ...valid.companies[0], member: true }, valid.companies[1]] },
    ],
    ['an uppercase login', { ...valid, accounts: { ...valid.accounts, Carol: 'acme' } }],
    ['an invalid login', { ...valid, accounts: { ...valid.accounts, bad_login: 'acme' } }],
    [
      'a blank company name',
      { ...valid, companies: [{ id: 'acme', name: ' ' }, valid.companies[1]] },
    ],
  ])('refuses %s', (_label, value) => {
    expect(companyMappingSchema.safeParse(value).success).toBe(false);
  });

  it.each(['Acme', 'acme widgets', '-acme', 'acme-', 'acme--widgets', '', 'unmapped'])(
    'refuses the company id %j',
    (id) => {
      expect(
        companyMappingSchema.safeParse({
          ...valid,
          companies: [{ id, name: 'Acme' }, valid.companies[1]],
          accounts: { alice: id, bob: 'globex' },
        }).success,
      ).toBe(false);
    },
  );

  it('refuses duplicate, unknown and unreferenced companies', () => {
    expect(
      issue({ ...valid, companies: [...valid.companies, { id: 'acme', name: 'Acme Again' }] }),
    ).toMatchObject({ path: ['companies', 2, 'id'], message: 'Duplicate company id: acme' });
    expect(issue({ ...valid, accounts: { ...valid.accounts, carol: 'initech' } })).toMatchObject({
      path: ['accounts', 'carol'],
      message: 'Unknown company id: initech',
    });
    expect(issue({ ...valid, accounts: { alice: 'acme' } })).toMatchObject({
      path: ['companies', 1],
      message: 'No account belongs to company globex',
    });
  });

  it('has an export date exactly when it maps accounts', () => {
    const message = 'Only a mapping with no companies and no accounts has no export date';
    expect(issue({ ...valid, exportedOn: null })).toMatchObject({ path: ['exportedOn'], message });
    expect(issue({ format: 1, exportedOn, companies: [], accounts: {} })).toMatchObject({
      path: ['exportedOn'],
      message,
    });
  });

  it('writes the file it reads, one line per login', () => {
    const json = companyMappingJson(valid as CompanyMapping);
    expect(json.endsWith('}\n')).toBe(true);
    expect(json).toContain('\n    "alice": "acme",\n');
    expect(companyMappingSchema.parse(JSON.parse(json))).toEqual(valid);
    expect(() => companyMappingJson({ ...valid, accounts: {} } as CompanyMapping)).toThrow();
  });
});

describe('bundled company mapping', () => {
  it('commits the empty mapping, so database sources stay not connected', () => {
    expect(companyMappingSchema.parse(committed)).toEqual({
      format: 1,
      exportedOn: null,
      companies: [],
      accounts: {},
    });
    expect(companyMapping()).toBeNull();
  });

  it('reads a bundled mapping once and refuses one that breaks the contract', async () => {
    const mapping: CompanyMapping = {
      format: 1,
      exportedOn,
      companies: [{ id: 'acme', name: 'Acme' }],
      accounts: { alice: 'acme' },
    };
    vi.resetModules();
    vi.doMock('@/server/company-mapping.json', () => ({ default: mapping }));
    const loaded = await import('@/server/company-mapping');
    expect(loaded.companyMapping()).toEqual(mapping);
    expect(loaded.companyMapping()).toBe(loaded.companyMapping());

    vi.resetModules();
    vi.doMock('@/server/company-mapping.json', () => ({
      default: { ...mapping, accounts: { alice: 'globex' } },
    }));
    const broken = await import('@/server/company-mapping');
    expect(() => broken.companyMapping()).toThrow('Unknown company id: globex');
  });
});
