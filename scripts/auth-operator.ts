import { temporaryPasswordHoursSchema } from '../src/models/temporary-credentials';
import { parseArgs } from 'node:util';
import { open, constants } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { z } from 'zod';
import { accountRoleSchema, emailSchema, summarizeAccount } from '../src/models/accounts';
import {
  accountTargetSchema,
  accountRegionSchema,
  accountTableNameSchema,
  type AccountTarget,
} from '../src/models/account-target';
import type { AccountStore } from '../src/lib/auth/account-store';
import {
  AccountError,
  AccountDataError,
  MigrationInterruptedError,
} from '../src/lib/auth/account-errors';
import { safeErrorCode } from '../src/lib/auth/diagnostics';

const common = {
  region: accountRegionSchema,
  'users-table': accountTableNameSchema,
  'whitelist-table': accountTableNameSchema,
};
const credentials = {
  ...common,
  email: emailSchema,
  output: z.string().endsWith('.credentials.json'),
};
const commandSchema = z.discriminatedUnion('command', [
  z.object({ command: z.literal('inspect'), ...common, email: emailSchema }).strict(),
  z.object({ command: z.literal('bootstrap'), ...credentials }).strict(),
  z.object({ command: z.literal('create'), ...credentials, role: accountRoleSchema }).strict(),
  z.object({ command: z.literal('reset-password'), ...credentials }).strict(),
  z
    .object({
      command: z.literal('set-access'),
      ...common,
      email: emailSchema,
      role: accountRoleSchema,
      active: z.enum(['true', 'false']),
    })
    .strict(),
  z
    .object({ command: z.literal('migrate'), ...common, apply: z.boolean().default(false) })
    .strict(),
]);
export function parseOperatorCommand(args: string[]) {
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    options: {
      email: { type: 'string' },
      output: { type: 'string' },
      role: { type: 'string' },
      active: { type: 'string' },
      region: { type: 'string' },
      'users-table': { type: 'string' },
      'whitelist-table': { type: 'string' },
      apply: { type: 'boolean' },
    },
  });
  if (parsed.positionals.length !== 1) throw new Error('Specify exactly one operator command.');
  return commandSchema.parse({ command: parsed.positionals[0], ...parsed.values });
}
export async function writeCredentialFile(path: string, data: unknown): Promise<void> {
  // Reserve and sync the private file before any account mutation. An ambiguous
  // network outcome must not lose the only copy of the generated credential.
  const handle = await open(
    resolve(path),
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    0o600,
  );
  try {
    await handle.chmod(0o600);
    await handle.writeFile(JSON.stringify(data, null, 2) + '\n');
    await handle.sync();
  } finally {
    await handle.close();
  }
}
export async function runOperator(args: string[]) {
  const command = parseOperatorCommand(args);
  const target = accountTargetSchema.parse({
    region: command.region,
    usersTable: command['users-table'],
    whitelistTable: command['whitelist-table'],
  });
  const { createAccountClient } = await import('../src/lib/aws/clients');
  const { createAccountStore } = await import('../src/lib/auth/account-store');
  const client = createAccountClient({ region: target.region });
  try {
    return await executeOperator(
      command,
      createAccountStore(client, target, {
        temporaryPasswordHours: temporaryPasswordHoursSchema.parse(
          process.env.DASHBOARD_TEMP_PASSWORD_HOURS,
        ),
      }),
      target,
    );
  } finally {
    client.destroy();
  }
}
async function executeOperator(
  command: z.infer<typeof commandSchema>,
  store: AccountStore,
  target: AccountTarget,
) {
  if (command.command === 'migrate') return store.migrateAccountLinks(command.apply);
  if (command.command === 'inspect') {
    const user = await store.getUserByEmail(command.email);
    if (!user) throw new AccountError('not-found');
    const access = await store.getWhitelistEntry(user.email);
    const summary = summarizeAccount(user.email, user, access);
    return {
      accountId: user.id,
      email: user.email,
      role: summary.role,
      accountRole: user.role,
      whitelistRole: access?.role ?? null,
      status: summary.status,
      active: summary.status === 'active',
      authVersion: user.authVersion,
      mustChangePassword: user.mustChangePassword === true,
      temporaryPasswordExpiresAt: user.temporaryPasswordExpiresAt,
    };
  }
  if (command.command === 'set-access') {
    const user = await store.getUserByEmail(command.email);
    if (!user) throw new AccountError('not-found');
    await store.setAccountAccess(user, command.role, command.active === 'true');
    return { updated: true, accountId: user.id };
  }
  if (command.command === 'reset-password') {
    const user = await store.getUserByEmail(command.email);
    if (!user) throw new AccountError('not-found');
    const prepared = await store.preparePasswordReset(user);
    await writeCredentialFile(command.output, {
      operation: command.command,
      accountId: user.id,
      email: user.email,
      temporaryPassword: prepared.tempPassword,
      expiresAt: prepared.expiresAt,
      target,
    });
    await store.commitPasswordReset(prepared, { kind: 'operator' });
    return { updated: true, accountId: user.id, credentialFile: resolve(command.output) };
  }
  const prepared = await store.prepareAccount(
    { email: command.email, role: command.command === 'bootstrap' ? 'admin' : command.role },
    'operator',
  );
  await store.createPreparedAccount(
    prepared,
    { kind: 'operator' },
    command.command === 'bootstrap',
    () =>
      writeCredentialFile(command.output, {
        operation: command.command,
        accountId: prepared.user.id,
        email: prepared.user.email,
        temporaryPassword: prepared.tempPassword,
        expiresAt: prepared.expiresAt,
        target,
      }),
  );
  return { created: true, accountId: prepared.user.id, credentialFile: resolve(command.output) };
}
// tsx leaves import.meta.main unset; compare real paths so a symlinked invocation still runs.
if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  if (process.argv.includes('--help')) {
    console.log(
      'Commands: bootstrap, create, reset-password, set-access, inspect, migrate. All require --region, --users-table, --whitelist-table. Account commands require --email. Credential commands require --output FILE.credentials.json (new private file). create/set-access require --role; set-access also requires --active true|false. inspect is read-only; migrate is read-only unless --apply is supplied.',
    );
  } else {
    try {
      console.log(JSON.stringify(await runOperator(process.argv.slice(2))));
    } catch (error) {
      console.error(
        error instanceof AccountDataError
          ? JSON.stringify({ error: error.message, records: error.records })
          : error instanceof MigrationInterruptedError
            ? JSON.stringify({
                error: 'Migration interrupted; rerun after resolving the failure.',
                completed: error.completed,
                pending: error.pending,
                code: safeErrorCode(error),
              })
            : error instanceof AccountError
              ? error.message
              : JSON.stringify({
                  error:
                    'Operator command failed. Check arguments, target configuration, permissions, and any retained credential file.',
                  code: safeErrorCode(error),
                }),
      );
      process.exitCode = 1;
    }
  }
}
