import 'server-only';
import { NextRequest } from 'next/server';
import { accountJson, authFailureResponse } from './account-response';
import { rawHandlers } from './auth';
import { parseVerifiedSession } from './session-transport';
import { resolveViewer, failedViewer } from './viewer';
import { readBoundedBody, RequestBodyError } from './bounded-request';

async function handle(request: NextRequest) {
  try {
    let bounded = request;
    if (request.method === 'POST') {
      const body = await readBoundedBody(request);
      const headers = new Headers(request.headers);
      headers.delete('transfer-encoding');
      headers.set('content-length', String(body.byteLength));
      bounded = new NextRequest(request.url, {
        method: 'POST',
        headers,
        body,
        signal: request.signal,
      });
    }
    const response = await rawHandlers[request.method === 'POST' ? 'POST' : 'GET'](bounded);
    if (new URL(request.url).pathname !== '/api/auth/session' || !response.ok) return response;
    const session = await parseVerifiedSession(response);
    if (!session) return response; // Auth.js owns absent/malformed/expired-token cleanup.
    const viewer = await resolveViewer(session);
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    if (viewer.kind === 'authenticated')
      return accountJson(
        { ...session, user: { ...viewer.user, emailVerified: null } },
        { headers },
      );
    // Withhold the library's prepared renewal on denial/outage. The incoming cookie is unchanged.
    headers.delete('set-cookie');
    if (viewer.kind === 'anonymous') return accountJson(null, { headers });
    return authFailureResponse(viewer.kind, { headers });
  } catch (error) {
    if (error instanceof RequestBodyError)
      return accountJson({ error: error.message }, { status: error.status });
    const decision = failedViewer(error);
    if (request.method === 'GET' && new URL(request.url).pathname === '/api/auth/error')
      // A fixed relative destination also works when configuration cannot supply an origin.
      return new Response(null, {
        status: 303,
        headers: {
          location: '/auth/error?error=Configuration',
          'cache-control': 'private, no-store',
        },
      });
    return authFailureResponse(decision.kind);
  }
}
export const handlers = { GET: handle, POST: handle };
