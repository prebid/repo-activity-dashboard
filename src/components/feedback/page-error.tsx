'use client';
import { startTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PageState } from './page-state';

export function PageError({ reset }: { reset: () => void }) {
  const router = useRouter();
  return (
    <PageState
      title="This page could not load"
      onRetry={() =>
        startTransition(() => {
          router.refresh();
          reset();
        })
      }
    >
      Please try again.
    </PageState>
  );
}
