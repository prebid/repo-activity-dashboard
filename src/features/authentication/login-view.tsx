'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { notifyAuthTransition } from '@/components/providers/auth-transitions';
import { safeReturnPath } from '@/lib/presentation/navigation';
export function LoginView({
  callbackUrl,
  preview,
  passwordChanged = false,
}: {
  callbackUrl?: string;
  preview: boolean;
  passwordChanged?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(preview ? 'alice@example.test' : '');
  const [password, setPassword] = useState(preview ? 'preview' : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await signIn('credentials', { email, password, redirect: false });
      if (result?.error || !result?.ok)
        setError(
          result?.error === 'Configuration'
            ? 'Sign-in is temporarily unavailable. Try again or contact an administrator.'
            : 'Unable to sign in. Check your details and try again.',
        );
      else {
        notifyAuthTransition();
        router.replace(safeReturnPath(callbackUrl));
        router.refresh();
      }
    } catch {
      setError('Unable to sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mx-auto max-w-md rounded-xl border bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-2 text-muted-foreground">Repository activity dashboard</p>
      {passwordChanged && (
        <p role="status" className="mt-4">
          Password changed. Sign in with your new password.
        </p>
      )}
      {preview && (
        <p className="mt-4 rounded-md bg-muted p-3 text-sm">
          Preview accounts: alice@example.test or bob@example.test. Password: preview.
        </p>
      )}
      <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </section>
  );
}
