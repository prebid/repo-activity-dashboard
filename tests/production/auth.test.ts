// @vitest-environment node
import { it, expect, inject } from 'vitest';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import { verifyPassword } from '@/lib/auth/passwords';
import { startProductionApp } from '../support/production-app';

it('runs the packaged production artifact with current sessions and protected account APIs', async () => {
  const fixture = await startProductionApp(inject('accountEndpoint'));
  const { origin, client, users, whitelist, secret } = fixture;
  const password = 'StrongTestPassword1!';
  try {
    await fixture.seedUser({ id: 'admin', email: 'admin@example.test', password, role: 'admin' });
    // Match the DynamoDB Number timestamp prescribed by the original setup documentation.
    await client.send(
      new UpdateCommand({
        TableName: whitelist,
        Key: { email: 'admin@example.test' },
        UpdateExpression: 'SET addedAt = :at',
        ExpressionAttributeValues: { ':at': 1754006400000 },
      }),
    );
    expect((await fetch(origin + '/api/auth/setup', { method: 'POST', body: '{}' })).status).toBe(
      403,
    );
    const jar = new Map<string, string>();
    function accept(response: Response) {
      for (const raw of response.headers.getSetCookie()) {
        const value = raw.split(';')[0];
        const split = value.indexOf('=');
        jar.set(value.slice(0, split), value.slice(split + 1));
      }
    }
    const cookie = () => [...jar].map(([k, v]) => k + '=' + v).join('; ');
    const csrf = await fetch(origin + '/api/auth/csrf');
    expect(csrf.status).toBe(200);
    accept(csrf);
    const token = z.object({ csrfToken: z.string() }).parse(await csrf.json());
    const login = await fetch(origin + '/api/auth/callback/credentials', {
      method: 'POST',
      redirect: 'manual',
      headers: { cookie: cookie(), 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        email: 'admin@example.test',
        password,
        csrfToken: token.csrfToken,
        callbackUrl: 'https://dashboard.example.test/repos',
      }),
    });
    expect(login.headers.get('location')).toBe('https://dashboard.example.test/repos');
    accept(login);
    const session = await fetch(origin + '/api/auth/session', { headers: { cookie: cookie() } });
    const identity: unknown = await session.json();
    expect(identity).toMatchObject({ user: { id: 'admin', role: 'admin', authVersion: 1 } });
    expect(JSON.stringify(identity)).not.toContain(secret);
    expect(fixture.secretReads()).toBeGreaterThan(0);
    const listing = await fetch(origin + '/api/admin/users', { headers: { cookie: cookie() } });
    expect(listing.status).toBe(200);
    expect(listing.headers.get('cache-control')).toContain('no-store');
    fixture.setAccountUnavailable(true);
    const unavailable = await fetch(origin + '/api/auth/session', {
      headers: { cookie: cookie() },
    });
    expect(unavailable.status).toBe(503);
    expect(unavailable.headers.getSetCookie()).toEqual([]);
    expect(await unavailable.json()).toEqual({
      error: 'Authentication is temporarily unavailable. Please try again.',
    });
    expect(
      (await fetch(origin + '/api/admin/users', { headers: { cookie: cookie() } })).status,
    ).toBe(503);
    fixture.setAccountUnavailable(false);
    expect(
      await (await fetch(origin + '/api/auth/session', { headers: { cookie: cookie() } })).json(),
    ).toMatchObject({ user: { id: 'admin' } });
    for (const [route, canary] of [
      ['/repos', 'Prebid.js'],
      ['/contributors', 'Alice'],
      ['/companies', 'Example Company A'],
      ['/repos/prebidjs', 'Sample PR 137: Update integration behavior'],
      ['/repos/prebidjs?view=issues', 'Sample issue 834: Improve documentation'],
      [
        '/repos/prebidjs?scope=current&metric=totalOpenPrs',
        'Sample PR 137: Update integration behavior',
      ],
      [
        '/repos/prebidjs?scope=current&metric=openIssues',
        'Sample issue 834: Improve documentation',
      ],
      [
        '/repos/prebidjs/authors/sample-author-2?scope=period&metric=prAuthors&from=2026-01-01T00:00:00.000Z&to=2026-10-24T12:00:00.000Z&inclusive=1',
        'PRs by sample-author-2',
      ],
      [
        '/repos/prebidjs/authors/sample-author-2?scope=period&metric=issueAuthors&from=2026-01-01T00:00:00.000Z&to=2026-10-24T12:00:00.000Z&inclusive=1',
        'Issues by sample-author-2',
      ],
      [
        '/repos/prebidjs/authors/sample-author-3%5Bbot%5D?scope=period&metric=prAuthors&from=2026-01-01T00:00:00.000Z&to=2026-10-24T12:00:00.000Z&inclusive=1',
        'PRs by sample-author-3[bot]',
      ],
      [
        '/repos/prebidjs/authors/sample-author-3%5Bbot%5D?scope=period&metric=issueAuthors&from=2026-01-01T00:00:00.000Z&to=2026-10-24T12:00:00.000Z&inclusive=1',
        'Issues by sample-author-3[bot]',
      ],
      [
        '/repos/prebidjs?scope=period&metric=prAuthors&from=2026-10-01T00:00:00.000Z&to=2026-10-24T12:00:00.000Z&inclusive=1',
        'sample-author-24',
      ],
      [
        '/repos/prebidjs?scope=period&metric=agentFeedbackCredits&from=2026-10-01T00:00:00.000Z&to=2026-10-24T12:00:00.000Z&inclusive=1',
        'sample-prebid-agent-b',
      ],
      [
        '/repos/prebidjs?scope=period&metric=medianMergeDays&branch=master&from=2026-10-01T00:00:00.000Z&to=2026-10-24T12:00:00.000Z&inclusive=1',
        'Merged PRs and durations',
      ],
    ]) {
      const permitted = await fetch(origin + route, { headers: { cookie: cookie() } });
      expect(permitted.status).toBe(200);
      expect(await permitted.text()).toContain(canary);
      const anonymous = await fetch(origin + route, { redirect: 'manual' });
      expect(anonymous.status).toBe(307);
      expect(anonymous.headers.get('location')).toContain('/auth/login');
      expect(await anonymous.text()).not.toContain(canary);
      const flight = await fetch(origin + route, { headers: { RSC: '1' }, redirect: 'manual' });
      expect([200, 307]).toContain(flight.status);
      const payload = await flight.text();
      expect(payload).not.toContain(canary);
      expect(
        payload.includes('/auth/login') ||
          Boolean(flight.headers.get('location')?.includes('/auth/login')),
      ).toBe(true);
    }
    const created = await fetch(origin + '/api/admin/users', {
      method: 'POST',
      headers: {
        cookie: cookie(),
        'content-type': 'application/json',
        origin: 'https://dashboard.example.test',
      },
      body: JSON.stringify({ email: 'new@example.test', role: 'user' }),
    });
    expect(created.status, fixture.logs()).toBe(200);
    expect(created.headers.get('cache-control')).toContain('no-store');
    const result = z
      .object({ userId: z.string(), tempPassword: z.string() })
      .parse(await created.json());
    const stored = await client.send(
      new GetCommand({ TableName: users, Key: { id: result.userId } }),
    );
    const hash = z
      .object({
        password: z.string(),
        mustChangePassword: z.literal(true),
        authVersion: z.literal(1),
      })
      .parse(stored.Item);
    expect(await verifyPassword(result.tempPassword, hash.password)).toBe(true);
    const crossOrigin = await fetch(origin + '/api/admin/users/reset-password', {
      method: 'POST',
      headers: {
        cookie: cookie(),
        origin: 'https://untrusted.example.test',
        'content-type': 'text/plain',
      },
      body: JSON.stringify({ email: 'new@example.test' }),
    });
    expect(crossOrigin.status).toBe(403);
    for (const [source, type, status] of [
      [undefined, 'application/json', 403],
      ['null', 'application/json', 403],
      ['https://dashboard.example.test', 'text/plain', 415],
      ['https://dashboard.example.test.attacker.test', 'application/json', 403],
    ] as const) {
      const headers = new Headers({ cookie: cookie(), 'content-type': type });
      if (source) headers.set('origin', source);
      const denied = await fetch(origin + '/api/admin/users/reset-password', {
        method: 'POST',
        headers,
        body: JSON.stringify({ email: 'new@example.test' }),
      });
      expect(denied.status).toBe(status);
    }
    expect(
      (await client.send(new GetCommand({ TableName: users, Key: { id: result.userId } }))).Item
        ?.authVersion,
    ).toBe(1);
    const reset = await fetch(origin + '/api/admin/users/reset-password', {
      method: 'POST',
      headers: {
        cookie: cookie(),
        'content-type': 'application/json',
        origin: 'https://dashboard.example.test',
      },
      body: JSON.stringify({ email: 'admin@example.test' }),
    });
    expect(reset.status, fixture.logs()).toBe(200);
    const resetValue = z.object({ tempPassword: z.string() }).parse(await reset.json());
    const oldSession = await fetch(origin + '/api/auth/session', { headers: { cookie: cookie() } });
    expect(await oldSession.json()).toBeNull();
    expect(
      (await fetch(origin + '/api/admin/users', { headers: { cookie: cookie() } })).status,
    ).toBe(401);
    async function signInAgain(value: string) {
      const response = await fetch(origin + '/api/auth/callback/credentials', {
        method: 'POST',
        redirect: 'manual',
        headers: { cookie: cookie(), 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          email: 'admin@example.test',
          password: value,
          csrfToken: token.csrfToken,
          callbackUrl: 'https://dashboard.example.test/repos',
        }),
      });
      expect(response.headers.get('location')).toBe('https://dashboard.example.test/repos');
      accept(response);
    }
    await signInAgain(resetValue.tempPassword);
    expect(
      (await fetch(origin + '/api/admin/users', { headers: { cookie: cookie() } })).status,
    ).toBe(403);
    const changed = await fetch(origin + '/api/auth/change-password', {
      method: 'POST',
      headers: {
        cookie: cookie(),
        'content-type': 'application/json',
        origin: 'https://dashboard.example.test',
      },
      body: JSON.stringify({
        currentPassword: resetValue.tempPassword,
        newPassword: 'DifferentSecurePassword2!',
      }),
    });
    expect(changed.status, fixture.logs()).toBe(200);
    expect(
      await (await fetch(origin + '/api/auth/session', { headers: { cookie: cookie() } })).json(),
    ).toBeNull();
    await signInAgain('DifferentSecurePassword2!');
    expect(
      (await fetch(origin + '/api/admin/users', { headers: { cookie: cookie() } })).status,
    ).toBe(200);
  } finally {
    await fixture.dispose();
  }
});
