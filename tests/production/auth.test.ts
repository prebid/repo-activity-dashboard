// @vitest-environment node
import { it, expect, inject } from 'vitest';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import { verifyPassword } from '@/lib/auth/passwords';
import { startProductionApp } from '../support/production-app';
import { renderedMain } from '../support/rendered-html';
import { choicePageSchema } from '@/models/contribution-options';

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
      [
        '/repos?timeline=1&timeline.metric=prsOpened&timeline.metric=medianMergeDays',
        'Repository metrics',
      ],
      ['/repos/prebidjs?timeline=1', 'Activity over time'],
      ['/contributors?timeline=1', 'Contributions over time'],
      ['/companies?timeline=1', 'Contributions over time'],
      [
        '/repos/prebidjs?timeline=1&timeline.detail=prsOpened&timeline.interval=month%3A2026-10-01T00%3A00%3A00.000Z&timeline.revision=repositories-reference-v1&timeline.clock=2026-10-24T12%3A00%3A00.000Z',
        'Supporting pull requests',
      ],
      ['/contributors', 'Alice'],
      ['/companies', 'Example Acme'],
      ['/contributors/account-alice', 'sample-alice'],
      ['/contributors/account-alice?metric=approvalContributions', 'sample-alice'],
      ['/contributors/export?column=prsAuthored', 'GitHub account'],
      ['/companies/export?column=reviewerContributions&layout=repositories', 'GitHub account'],
      ['/companies/id/company-acme', 'Example Acme'],
      ['/companies/unmapped', 'Unmapped company'],
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
        'sample-bob',
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
      const body = await permitted.text();
      const csv = permitted.headers.get('content-type')?.includes('text/csv');
      const main = csv ? null : renderedMain(body);
      expect(csv ? body : main?.textContent).toContain(canary);
      if (/^\/(contributors|companies)(?:\?|$|\/(?!export))/.test(route))
        expect(main?.querySelector('table tbody tr')).toBeTruthy();
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
    const timelineBody = JSON.stringify({
      href: '/repos?timeline=1&repo=repo-prebidjs&timeline.metric=prsOpened&timeline.metric=medianMergeDays',
      revision: 'repositories-reference-v1',
      asOf: '2026-10-24T12:00:00.000Z',
      columns: ['period', 'repository', 'prsOpened', 'medianMergeDays'],
    });
    const timelineCsv = await fetch(origin + '/api/reporting/timeline-export', {
      method: 'POST',
      headers: { cookie: cookie(), 'content-type': 'application/json' },
      body: timelineBody,
    });
    expect(timelineCsv.status).toBe(200);
    expect(timelineCsv.headers.get('cache-control')).toBe('private, no-store');
    expect((await timelineCsv.text()).split('\r\n')).toHaveLength(11);
    const deniedTimeline = await fetch(origin + '/api/reporting/timeline-export', {
      method: 'POST',
      redirect: 'manual',
      headers: { 'content-type': 'application/json' },
      body: timelineBody,
    });
    expect(deniedTimeline.status).toBe(307);
    expect(deniedTimeline.headers.get('location')).toContain('/auth/login');
    const choiceBody = JSON.stringify({
      action: 'choices',
      sample: 'large',
      query: { kind: 'accounts', search: '', page: 0, selectedIds: null },
    });
    const choices = await fetch(origin + '/api/reporting/contribution-options', {
      method: 'POST',
      headers: { cookie: cookie(), 'content-type': 'application/json' },
      body: choiceBody,
    });
    expect(choices.status).toBe(200);
    expect(choicePageSchema.parse(await choices.json()).choices).toHaveLength(50);
    expect(choices.headers.get('cache-control')).toBe('private, no-store');
    const anonymousChoices = await fetch(origin + '/api/reporting/contribution-options', {
      method: 'POST',
      redirect: 'manual',
      headers: { 'content-type': 'application/json' },
      body: choiceBody,
    });
    expect(anonymousChoices.status).toBe(307);
    expect(anonymousChoices.headers.get('location')).toContain('/auth/login');
    expect(await anonymousChoices.text()).not.toContain('Sample contributor');
    for (const route of [
      '/contributors/no-such-account',
      '/companies/id/no-such-company',
      '/companies/invalid/path',
    ]) {
      const permitted = await fetch(origin + route, { headers: { cookie: cookie() } });
      expect(permitted.status).toBe(404);
      const anonymous = await fetch(origin + route, { redirect: 'manual' });
      expect(anonymous.status).toBe(307);
      expect(anonymous.headers.get('location')).toContain('/auth/login');
      const flight = await fetch(origin + route, { headers: { RSC: '1' }, redirect: 'manual' });
      expect([200, 307]).toContain(flight.status);
      const payload = await flight.text();
      expect(payload).not.toContain('Example Acme');
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
