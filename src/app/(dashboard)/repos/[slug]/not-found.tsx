import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EdgeMessage } from '@/components/layout/edge-frame';
export const metadata: Metadata = { title: 'Repository not found' };
// Inside the dashboard frame, which supplies the masthead and footer.
export default function RepositoryNotFound() {
  return (
    <EdgeMessage
      title="Repository not found"
      action={
        <Button asChild variant="primary">
          <Link prefetch={false} href="/repos">
            Back to all repositories
          </Link>
        </Button>
      }
    >
      No repository in this workspace matches this address.
    </EdgeMessage>
  );
}
