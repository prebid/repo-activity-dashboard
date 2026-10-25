'use client';
import { PageState } from '@/components/feedback/page-state';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <PageState title="This page could not load" onRetry={reset}>
      Please try again.
    </PageState>
  );
}
