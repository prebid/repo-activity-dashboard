'use client';
import { startTransition } from 'react';
import { useRouter } from 'next/navigation';
import { EmptyState } from './empty-state';

export function PageError({ reset }: { reset: () => void }) {
  const router = useRouter();
  return (
    <EmptyState
      kind="error"
      title="This page could not load"
      onRetry={() =>
        startTransition(() => {
          router.refresh();
          reset();
        })
      }
    >
      Please try again.
    </EmptyState>
  );
}
