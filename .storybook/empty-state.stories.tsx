import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from '../src/components/ui/button';
import { EmptyState, type EmptyStateKind } from '../src/components/feedback/empty-state';

const examples = {
  empty: {
    title: 'No merged PRs in this period',
    body: 'The prepared sample records no merges for the selected repositories in this range.',
  },
  'no-match': {
    title: 'No matching PRs',
    body: 'No PR in this list matches the search and filters.',
  },
  missing: {
    title: 'Sample records unavailable',
    body: 'Records for this repository are not part of the prepared sample, so no count is shown.',
  },
  error: {
    title: 'This page could not load',
    body: 'Please try again.',
  },
  loading: {
    title: 'Loading records…',
    body: undefined,
  },
} as const satisfies Record<EmptyStateKind, { title: string; body: string | undefined }>;

function Specimen({ kind, variant }: { kind: EmptyStateKind; variant: 'page' | 'embedded' }) {
  const { title, body } = examples[kind];
  const state = (
    <EmptyState
      kind={kind}
      title={title}
      variant={variant}
      onRetry={kind === 'error' ? () => {} : undefined}
      action={
        kind === 'no-match' ? (
          <Button type="button" variant="secondary">
            Clear filters
          </Button>
        ) : undefined
      }
    >
      {body}
    </EmptyState>
  );
  // The embedded variant has no frame of its own; it sits inside a panel or table.
  return variant === 'embedded' ? (
    <div className="max-w-3xl rounded-lg border bg-card">{state}</div>
  ) : (
    <div className="max-w-3xl">{state}</div>
  );
}

const meta = { title: 'Feedback/Empty state', component: Specimen } satisfies Meta<typeof Specimen>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Empty: Story = { args: { kind: 'empty', variant: 'page' } };
export const EmptyEmbedded: Story = { args: { kind: 'empty', variant: 'embedded' } };
export const NoMatch: Story = { args: { kind: 'no-match', variant: 'page' } };
export const NoMatchEmbedded: Story = { args: { kind: 'no-match', variant: 'embedded' } };
export const Missing: Story = { args: { kind: 'missing', variant: 'page' } };
export const MissingEmbedded: Story = { args: { kind: 'missing', variant: 'embedded' } };
export const Error: Story = { args: { kind: 'error', variant: 'page' } };
export const ErrorEmbedded: Story = { args: { kind: 'error', variant: 'embedded' } };
export const Loading: Story = { args: { kind: 'loading', variant: 'page' } };
export const LoadingEmbedded: Story = { args: { kind: 'loading', variant: 'embedded' } };
