/** The loaded report changed on the server; retrying the same request cannot succeed. */
export class StaleExportError extends Error {
  constructor() {
    super('The report data changed. Reload the page before exporting.');
  }
}
/** POST keeps large selections out of URLs; only an authenticated CSV response is accepted. */
export async function postCsv(url: string, body: unknown, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (response.status === 409) throw new StaleExportError();
  if (
    !response.ok ||
    response.redirected ||
    !response.headers.get('content-type')?.startsWith('text/csv')
  )
    throw Error('CSV export unavailable');
  return response.blob();
}
