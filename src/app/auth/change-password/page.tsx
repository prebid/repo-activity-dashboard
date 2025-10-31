'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut, signIn } from 'next-auth/react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import Image from 'next/image';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const passwordRequirements = [
    { test: (p: string) => p.length >= 8, text: 'At least 8 characters' },
    { test: (p: string) => /[A-Z]/.test(p), text: 'One uppercase letter' },
    { test: (p: string) => /[a-z]/.test(p), text: 'One lowercase letter' },
    { test: (p: string) => /[0-9]/.test(p), text: 'One number' },
  ];

  const isPasswordValid = passwordRequirements.every(req => req.test(newPassword));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    // Validate password strength
    if (!isPasswordValid) {
      setError('Please meet all password requirements');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to change password');
      } else {
        // Password changed successfully
        // Automatically sign in with the new password
        const signInResult = await signIn('credentials', {
          email: session?.user?.email,
          password: newPassword,
          redirect: false,
        });

        if (signInResult?.ok) {
          // Successfully logged in with new password, redirect to dashboard
          router.push('/');
        } else {
          // If auto-login fails for some reason, sign out and redirect to login
          await signOut({ redirect: false });
          router.push('/auth/login?passwordChanged=true');
        }
      }
    } catch (error) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const isFirstLogin = session?.user?.mustChangePassword;

  return (
    <div className="container relative min-h-screen flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-1 lg:px-0">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px]">
        <Card style={{ padding: '32px 48px 48px 48px' }}>
          <div>
            {/* Logo */}
            <div className="flex justify-center mb-4">
              <div style={{ width: '150px', height: '150px', position: 'relative' }}>
                <Image
                  src="/prebid-logo.png"
                  alt="Prebid Logo"
                  fill
                  style={{ objectFit: 'contain' }}
                />
              </div>
            </div>
            
            {/* Title and Description */}
            <div className="text-center mb-4">
              <h2 className="text-2xl font-semibold tracking-tight">
                {isFirstLogin ? 'Set Your Password' : 'Change Password'}
              </h2>
              <p className="text-sm text-muted-foreground mt-2">
                {isFirstLogin
                  ? 'You must set a new password before continuing'
                  : 'Update your account password'}
              </p>
            </div>

            {/* Form container with additional padding */}
            <div style={{ padding: '0 24px' }}>
              {isFirstLogin && (
                <Alert className="mb-5">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>First Time Login</AlertTitle>
                  <AlertDescription>
                    For security reasons, you must change your temporary password before accessing the dashboard.
                  </AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit}>
                {error && (
                  <Alert variant="destructive" style={{ marginBottom: '20px' }}>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div style={{ marginBottom: '20px' }}>
                  <Label htmlFor="currentPassword" style={{ display: 'block', marginBottom: '8px' }}>
                    {isFirstLogin ? 'Temporary Password' : 'Current Password'}
                  </Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    placeholder={isFirstLogin ? 'Enter temporary password' : 'Enter current password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    autoComplete="current-password"
                    autoFocus
                    className="bg-background text-foreground"
                    style={{ height: '48px' }}
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <Label htmlFor="newPassword" style={{ display: 'block', marginBottom: '8px' }}>
                    New Password
                  </Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    autoComplete="new-password"
                    className="bg-background text-foreground"
                    style={{ height: '48px' }}
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <Label htmlFor="confirmPassword" style={{ display: 'block', marginBottom: '8px' }}>
                    Confirm New Password
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    autoComplete="new-password"
                    className="bg-background text-foreground"
                    style={{ height: '48px' }}
                  />
                </div>

                {/* Password Requirements */}
                <div style={{ marginBottom: '24px' }} className="space-y-1 text-sm">
                  <p className="text-muted-foreground font-medium">Password must have:</p>
                  {passwordRequirements.map((req, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-2 ${
                        newPassword && req.test(newPassword)
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-muted-foreground'
                      }`}
                    >
                      <span>{newPassword && req.test(newPassword) ? '✓' : '○'}</span>
                      <span>{req.text}</span>
                    </div>
                  ))}
                </div>

                <div>
                  <Button
                    type="submit"
                    className="w-full font-semibold text-base"
                    style={{ height: '48px', marginBottom: '12px' }}
                    disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Changing Password...
                      </>
                    ) : (
                      'Change Password'
                    )}
                  </Button>

                  {!isFirstLogin && (
                    <Button
                      variant="secondary"
                      className="w-full font-medium"
                      style={{ height: '48px' }}
                      onClick={() => router.back()}
                      type="button"
                      disabled={isLoading}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </div>

            {/* Footer text */}
            <div className="text-center text-sm text-muted-foreground mt-6">
              <p>Password changes take effect immediately.</p>
              {isFirstLogin && (
                <p className="mt-1">You'll be redirected after successfully changing your password.</p>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}