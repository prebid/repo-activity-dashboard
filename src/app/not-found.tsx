import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EdgeFrame, EdgeMessage } from '@/components/layout/edge-frame';
export const metadata: Metadata = { title: 'Page not found' };
export default function NotFound() {
  return (
    <EdgeFrame>
      <EdgeMessage
        title="Page not found"
        action={
          <Button asChild variant="primary">
            <Link prefetch={false} href="/repos">
              Back to all repositories
            </Link>
          </Button>
        }
      >
        No page in this workspace matches this address.
      </EdgeMessage>
    </EdgeFrame>
  );
}
