/** Test-only RFC-style reader; assertions inspect fields rather than matching substrings in metadata. */
export function readCsv(text: string): { headers: string[]; records: Record<string, string>[] } {
  const rows: string[][] = [];
  let row: string[] = [],
    field = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && char === ',') {
      row.push(field);
      field = '';
    } else if (!quoted && (char === '\r' || char === '\n')) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  if (quoted) throw Error('Unclosed CSV field');
  const headers = rows.shift() ?? [];
  return {
    headers,
    records: rows.map((values) => {
      if (values.length !== headers.length) throw Error('Mismatched CSV row width');
      return Object.fromEntries(headers.map((header, i) => [header, values[i]]));
    }),
  };
}
