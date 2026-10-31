'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  accountListResponseSchema,
  createdAccountResponseSchema,
  resetCredentialResponseSchema,
  accountRoles,
  type AccountSummary,
  type IssuedCredential,
} from '@/models/accounts';
import { readJsonResponse, mutationFailureMessage } from '@/lib/presentation/http';
import { TemporaryCredentialDialog } from './temporary-credential-dialog';
const creationUnknown =
  'Account creation could not be confirmed. It may have succeeded. Refresh the list and reissue a password if the account exists.';
const reissueUnknown =
  'Password reissue could not be confirmed. A new password may have been issued. Reissue again to establish a known credential.';
export default function AdminUsersView() {
  const [users, setUsers] = useState<AccountSummary[]>([]),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState('');
  const [creating, setCreating] = useState(false),
    [createError, setCreateError] = useState(''),
    [resetting, setResetting] = useState(''),
    [resetError, setResetError] = useState('');
  const [email, setEmail] = useState(''),
    [name, setName] = useState(''),
    [role, setRole] = useState('viewer'),
    [company, setCompany] = useState('');
  const [credential, setCredential] = useState<IssuedCredential | null>(null);
  const load = useRef<AbortController | null>(null),
    trigger = useRef<HTMLElement | null>(null),
    createButton = useRef<HTMLButtonElement>(null);
  const fetchUsers = useCallback(async () => {
    load.current?.abort();
    const controller = new AbortController();
    load.current = controller;
    setLoading(true);
    setLoadError('');
    try {
      const response = await fetch('/api/admin/users', {
        signal: controller.signal,
        cache: 'no-store',
      });
      const result = await readJsonResponse(
        response,
        accountListResponseSchema,
        'Failed to load accounts',
      );
      if (!controller.signal.aborted) setUsers(result.users);
    } catch {
      if (!controller.signal.aborted) setLoadError('Unable to load accounts. Try again.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void fetchUsers();
    return () => load.current?.abort();
  }, [fetchUsers]);
  async function create(event: React.FormEvent) {
    event.preventDefault();
    trigger.current = createButton.current;
    setCreateError('');
    setCreating(true);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, name, role, company }),
      });
      const data = await readJsonResponse(response, createdAccountResponseSchema, creationUnknown);
      setCredential(data);
      setEmail('');
      setName('');
      setCompany('');
      setRole('viewer');
      void fetchUsers();
    } catch (error) {
      setCreateError(mutationFailureMessage(error, creationUnknown));
    } finally {
      setCreating(false);
    }
  }
  async function reissue(target: string, element: HTMLButtonElement) {
    trigger.current = element;
    setResetError('');
    setResetting(target);
    try {
      const response = await fetch('/api/admin/users/reset-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: target }),
      });
      setCredential(
        await readJsonResponse(response, resetCredentialResponseSchema, reissueUnknown),
      );
    } catch (error) {
      setResetError(mutationFailureMessage(error, reissueUnknown));
    } finally {
      setResetting('');
    }
  }
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Account administration</h1>
        <p className="text-muted-foreground">Create accounts and reissue temporary credentials.</p>
      </div>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Create account</CardTitle>
            <CardDescription>
              You will receive an expiring password to share privately.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(event) => void create(event)} className="space-y-4">
              {createError && (
                <Alert variant="destructive">
                  <AlertDescription>{createError}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="new-email">Email</Label>
                <Input
                  id="new-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-name">Name</Label>
                <Input id="new-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-company">Company</Label>
                <Input
                  id="new-company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-role">Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger id="new-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {accountRoles.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button ref={createButton} type="submit" disabled={creating || Boolean(resetting)}>
                {creating ? 'Creating…' : 'Create account'}
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Account access list</CardTitle>
            <CardDescription>Reissuing replaces the previous password immediately.</CardDescription>
            <Button
              type="button"
              variant="outline"
              disabled={loading || creating || Boolean(resetting)}
              onClick={() => void fetchUsers()}
            >
              Refresh accounts
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {resetError && (
              <Alert variant="destructive">
                <AlertDescription>{resetError}</AlertDescription>
              </Alert>
            )}
            {loadError ? (
              <Alert variant="destructive">
                <AlertDescription>{loadError}</AlertDescription>
                <Button type="button" variant="outline" onClick={() => void fetchUsers()}>
                  Retry loading accounts
                </Button>
              </Alert>
            ) : loading ? (
              <p role="status">Loading accounts…</p>
            ) : users.length === 0 ? (
              <p>No accounts are listed.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Effective role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.email}>
                      <TableCell className="break-all">{user.email}</TableCell>
                      <TableCell>{user.role ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                          {
                            {
                              active: 'Active',
                              inactive: 'Inactive',
                              unprovisioned: 'No account',
                              'migration-required': 'Migration required',
                            }[user.status]
                          }
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={creating || Boolean(resetting) || user.status !== 'active'}
                          aria-label={'Reissue password for ' + user.email}
                          onClick={(event) => void reissue(user.email, event.currentTarget)}
                        >
                          {resetting === user.email ? 'Reissuing…' : 'Reissue password'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
      {credential && (
        <TemporaryCredentialDialog
          key={credential.expiresAt ?? credential.tempPassword}
          credential={credential}
          onClose={() => setCredential(null)}
          onRestoreFocus={() => {
            const element = trigger.current?.isConnected ? trigger.current : createButton.current;
            element?.focus();
          }}
        />
      )}
    </div>
  );
}
