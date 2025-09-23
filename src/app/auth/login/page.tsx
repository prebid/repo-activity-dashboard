'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAuthUrl } from '@/lib/auth/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const callbackUrl = searchParams.get('callbackUrl') || '/';

  useEffect(() => {
    // Check for error in URL params (from NextAuth)
    const error = searchParams.get('error');
    if (error) {
      setError('Authentication failed. Please try again.');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl: callbackUrl,
      });

      if (result?.error) {
        setError(result.error);
      } else if (result?.ok) {
        // Successful login - redirect to callback URL
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (error) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

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
            <p className="text-center text-sm text-muted-foreground mb-4">
              Enter your email to access your account
            </p>
            {/* Form container with additional padding */}
            <div style={{ padding: '0 24px' }}>
              <form onSubmit={handleSubmit}>
              {error && (
                <Alert variant="destructive" style={{ marginBottom: '20px' }}>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div style={{ marginBottom: '20px' }}>
                <Label htmlFor="email" style={{ display: 'block', marginBottom: '8px' }}>Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect="off"
                  className="bg-background text-foreground"
                  style={{ height: '48px' }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <Label htmlFor="password" style={{ display: 'block', marginBottom: '8px' }}>Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="current-password"
                  className="bg-background text-foreground"
                  style={{ height: '48px' }}
                />
              </div>

              <div>
                <Button
                  type="submit"
                  className="w-full font-semibold text-base"
                  style={{ height: '48px', marginBottom: '12px' }}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    'Login'
                  )}
                </Button>

                {/* Back to Dashboard */}
                <Button
                  variant="secondary"
                  className="w-full font-medium"
                  style={{ height: '48px' }}
                  onClick={() => router.push('/')}
                  type="button"
                >
                  Back to Dashboard
                </Button>
              </div>
            </form>
            </div>

            {/* Footer text */}
            <div className="text-center text-sm text-muted-foreground mt-6">
              <p>Access is restricted to authorized users.</p>
              <p className="mt-1">Contact your administrator for credentials.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}