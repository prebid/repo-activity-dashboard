// @vitest-environment node
import { it, expect, inject } from 'vitest';
import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { encode } from 'next-auth/jwt';
import { startProductionApp } from '../support/production-app';
import { createdAccountResponseSchema } from '@/models/accounts';
it('serves the rebuilt reports with existing signed cookies and unmodified legacy account records', async () => {
  const fixture = await startProductionApp(inject('accountEndpoint'), { backend: 'legacy' });
  try {
    const id = await fixture.seedUser({
      id: 'legacy-admin',
      email: 'existing@example.test',
      password: 'ExistingPassword!',
      role: 'admin',
    });
    const read = () =>
      fixture.client.send(new GetCommand({ TableName: fixture.users, Key: { id } }));
    const before = (await read()).Item;
    const accessBefore = await fixture.client.send(
      new GetCommand({ TableName: fixture.whitelist, Key: { email: 'existing@example.test' } }),
    );
    expect(before).not.toHaveProperty('authVersion');
    expect(accessBefore.Item).not.toHaveProperty('userId');
    const token = await encode({
      secret: fixture.secret,
      salt: '__Secure-authjs.session-token',
      token: { id, email: 'existing@example.test', role: 'admin' },
    });
    const cookie = '__Secure-authjs.session-token=' + token;
    const headers = { cookie };
    const session = await fetch(fixture.origin + '/api/auth/session', { headers });
    expect(session.status).toBe(200);
    expect(await session.json()).toMatchObject({ user: { id, role: 'admin', authVersion: 0 } });
    for (const [path, expected] of [
      ['/repos', 'All repositories'],
      [
        '/repos?timeline=1&timeline.metric=prsOpened&timeline.metric=medianMergeDays',
        'Repository metrics',
      ],
      ['/contributors', 'Contributors'],
      ['/companies', 'Companies'],
    ]) {
      const response = await fetch(fixture.origin + path, { headers });
      expect(response.status).toBe(200);
      expect(await response.text()).toContain(expected);
    }
    expect((await read()).Item).toEqual(before);
    expect(
      (
        await fixture.client.send(
          new GetCommand({ TableName: fixture.whitelist, Key: { email: 'existing@example.test' } }),
        )
      ).Item,
    ).toEqual(accessBefore.Item);
    const create = await fetch(fixture.origin + '/api/admin/users', {
      method: 'POST',
      headers: { cookie, origin: fixture.authOrigin, 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'created@example.test', role: 'viewer' }),
    });
    expect(create.status).toBe(200);
    const issued = createdAccountResponseSchema.parse(await create.json());
    expect(issued.expiresAt).toBeNull();
    const stored = await fixture.client.send(
      new GetCommand({ TableName: fixture.users, Key: { id: issued.userId } }),
    );
    expect(stored.Item).toMatchObject({ mustChangePassword: true });
    expect(stored.Item).not.toHaveProperty('authVersion');
    expect(stored.Item).not.toHaveProperty('temporaryPasswordExpiresAt');
    const denied = await fetch(fixture.origin + '/contributors', { redirect: 'manual' });
    expect(denied.status).toBe(307);
    expect(await denied.text()).not.toContain('Alice');
    // A conflicting explicit link must not be replaced by the in-memory compatibility link.
    await fixture.client.send(
      new UpdateCommand({
        TableName: fixture.whitelist,
        Key: { email: 'existing@example.test' },
        UpdateExpression: 'SET userId = :id',
        ExpressionAttributeValues: { ':id': 'different-account' },
      }),
    );
    expect(
      await (await fetch(fixture.origin + '/api/auth/session', { headers })).json(),
    ).toBeNull();
    await fixture.client.send(
      new PutCommand({
        TableName: fixture.whitelist,
        Item: { email: 'existing@example.test', role: 'admin', isActive: false },
      }),
    );
    expect(
      await (await fetch(fixture.origin + '/api/auth/session', { headers })).json(),
    ).toBeNull();
    expect(fixture.secretReads()).toBe(0);
    expect(fixture.accountOperations.length).toBeGreaterThan(0);
    expect(fixture.accountOperations.some((operation) => operation.includes('Transact'))).toBe(
      false,
    );
  } finally {
    await fixture.dispose();
  }
});
