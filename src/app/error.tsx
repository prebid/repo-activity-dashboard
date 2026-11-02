'use client';
import { PageError } from '@/components/feedback/page-error';
import { EdgeFrame } from '@/components/layout/edge-frame';

// Catches what the dashboard frame cannot, such as a failure in its own layout.
export default function RootError({ reset }: { reset: () => void }) {
  return (
    <EdgeFrame>
      <PageError reset={reset} />
    </EdgeFrame>
  );
}
