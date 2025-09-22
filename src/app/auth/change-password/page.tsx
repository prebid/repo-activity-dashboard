'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2, Shield } from 'lucide-react';

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
        // Sign out and redirect to login with success message
        await signOut({ redirect: false });
        router.push('/auth/login?passwordChanged=true');
      }
    } catch (error) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const isFirstLogin = session?.user?.mustChangePassword;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <Card>
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-4">
              <Shield className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl text-center">
              {isFirstLogin ? 'Set Your Password' : 'Change Password'}
            </CardTitle>
            <CardDescription className="text-center">
              {isFirstLogin
                ? 'You must set a new password before continuing'
                : 'Update your account password'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isFirstLogin && (
              <Alert className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>First Time Login</AlertTitle>
                <AlertDescription>
                  For security reasons, you must change your temporary password before accessing the dashboard.
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="currentPassword">
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
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                />
              </div>

              {/* Password Requirements */}
              <div className="space-y-1 text-sm">
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

              <Button
                type="submit"
                className="w-full"
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
            </form>

            {!isFirstLogin && (
              <div className="mt-4 text-center">
                <Button
                  variant="ghost"
                  onClick={() => router.back()}
                  disabled={isLoading}
                  className="text-sm"
                >
                  Cancel
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}