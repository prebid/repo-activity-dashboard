'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const errorMessages: Record<string, string> = {
    Configuration: 'There was a problem with the server configuration. Please check that all environment variables are set correctly.',
    AccessDenied: 'You do not have permission to sign in.',
    Verification: 'The verification token has expired or has already been used.',
    Default: 'An error occurred during authentication.',
  };

  const errorMessage = errorMessages[error || 'Default'] || errorMessages.Default;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8">
        <div className="flex flex-col items-center space-y-4">
          <AlertCircle className="h-12 w-12 text-red-500" />
          <h1 className="text-2xl font-bold">Authentication Error</h1>
          <p className="text-center text-muted-foreground">{errorMessage}</p>
          {error && (
            <p className="text-xs text-muted-foreground">Error code: {error}</p>
          )}
          <div className="flex gap-4">
            <Link href="/auth/login">
              <Button>Try Again</Button>
            </Link>
            <Link href="/">
              <Button variant="outline">Go Home</Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}