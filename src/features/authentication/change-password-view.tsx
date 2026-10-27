'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { notifyAuthTransition } from '@/components/providers/auth-transitions';
import { minimumPasswordLength, validatePasswordStrength } from '@/models/password-policy';
import { readJsonResponse, mutationFailureMessage } from '@/lib/presentation/http';
import { safeReturnPath } from '@/lib/presentation/navigation';
import { messageResponseSchema } from '@/models/accounts';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ArrowRight, Check, Loader2 } from 'lucide-react';
import { AuthFrame } from './auth-frame';
import { PasswordInput } from '@/components/ui/password-input';
import styles from './authentication.module.css';

export function ChangePasswordView({
  email,
  mustChangePassword,
  callbackUrl,
}: {
  email: string;
  mustChangePassword: boolean;
  callbackUrl?: string;
}) {
  const router = useRouter();
  const returnPath = safeReturnPath(callbackUrl);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const operation = useRef<AbortController | null>(null);
  useEffect(() => () => operation.current?.abort(), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (operation.current && !operation.current.signal.aborted) return;
    setError('');

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    const validation = validatePasswordStrength(newPassword);
    if (!validation.valid) {
      setError(validation.errors.join('. '));
      return;
    }

    setIsLoading(true);
    const current = new AbortController();
    operation.current = current;

    try {
      const response = await fetch('/api/auth/change-password', {
        signal: current.signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      await readJsonResponse(response, messageResponseSchema, 'Failed to change password');
    } catch (error) {
      if (current.signal.aborted) return;
      setError(
        mutationFailureMessage(
          error,
          'The password change could not be confirmed. Try signing in with your new password, or ask an administrator to reissue it.',
        ),
      );
      setIsLoading(false);
      operation.current = null;
      return;
    }
    if (current.signal.aborted) return;
    // The write is confirmed. A sign-in transport failure must not report a failed password change.
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    let destination =
      '/auth/login?passwordChanged=true' +
      (returnPath === '/repos' ? '' : '&callbackUrl=' + encodeURIComponent(returnPath));
    try {
      const result = await signIn('credentials', { email, password: newPassword, redirect: false });
      if (result?.ok && !result.error) destination = returnPath;
    } catch {
      // The previous revision is already invalid; manual sign-in can establish a new session.
    }
    if (current.signal.aborted) return;
    notifyAuthTransition();
    router.replace(destination);
    router.refresh();
  };

  const isFirstLogin = mustChangePassword;

  return (
    <AuthFrame settingPassword>
      {isFirstLogin ? (
        <div className={styles.steps} aria-label="Account setup: step 2 of 2">
          <span>
            <Check size={14} aria-hidden="true" /> Signed in
          </span>
          <span className={styles.stepDivider} aria-hidden="true" />
          <span className={styles.currentStep}>02 &nbsp; Set your password</span>
        </div>
      ) : (
        <p className={styles.formEyebrow}>YOUR ACCOUNT</p>
      )}
      <h1 className={styles.title}>{isFirstLogin ? 'Set Your Password' : 'Change Password'}</h1>
      <p className={styles.subtitle}>
        {isFirstLogin
          ? 'One more step. Replace your temporary password with one only you know.'
          : 'Choose a new password for your Prebid workspace.'}
      </p>
      <form
        method="post"
        onSubmit={(event) => void handleSubmit(event)}
        className={styles.form}
        aria-busy={isLoading}
      >
        <input type="hidden" name="username" autoComplete="username" value={email} readOnly />
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <div className={styles.field}>
          <Label htmlFor="currentPassword">
            {isFirstLogin ? 'Temporary Password' : 'Current Password'}
          </Label>
          <PasswordInput
            id="currentPassword"
            name="currentPassword"
            visibilityLabel={isFirstLogin ? 'temporary password' : 'current password'}
            placeholder={
              isFirstLogin ? 'Enter the password you received' : 'Enter current password'
            }
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
            disabled={isLoading}
            autoComplete="current-password"
          />
        </div>
        <div className={styles.field}>
          <Label htmlFor="newPassword">New Password</Label>
          <PasswordInput
            id="newPassword"
            name="newPassword"
            visibilityLabel="new password"
            placeholder="Create your password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
            disabled={isLoading}
            autoComplete="new-password"
            aria-describedby="password-hint"
          />
          <p id="password-hint" className={styles.fieldHint}>
            Use at least {minimumPasswordLength} characters.
          </p>
        </div>
        <div className={styles.field}>
          <Label htmlFor="confirmPassword">Confirm New Password</Label>
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            visibilityLabel="confirmed password"
            placeholder="Enter your new password again"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            disabled={isLoading}
            autoComplete="new-password"
          />
        </div>
        <Button
          type="submit"
          className={styles.submit}
          disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" /> Changing Password...
            </>
          ) : (
            <>
              {isFirstLogin ? 'Set password and continue' : 'Change Password'}
              <ArrowRight aria-hidden="true" />
            </>
          )}
        </Button>
        {!isFirstLogin && (
          <Button
            variant="secondary"
            className={styles.cancel}
            onClick={() => router.back()}
            type="button"
            disabled={isLoading}
          >
            Cancel
          </Button>
        )}
      </form>
      <div className={styles.passwordFooter}>
        <p>
          {isFirstLogin
            ? 'Your new password replaces the temporary one immediately.'
            : 'Password changes take effect immediately.'}
        </p>
        <Link
          prefetch={false}
          href={
            returnPath === '/repos'
              ? '/auth/login'
              : '/auth/login?callbackUrl=' + encodeURIComponent(returnPath)
          }
          className={styles.backLink}
        >
          Back to sign in
        </Link>
      </div>
    </AuthFrame>
  );
}
