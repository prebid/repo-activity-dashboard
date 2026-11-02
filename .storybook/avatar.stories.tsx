import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Avatar, type AvatarProps, type AvatarSize } from '../src/components/github/avatar';

type Identity =
  | Omit<Extract<AvatarProps, { kind: 'person' }>, 'size'>
  | Omit<Extract<AvatarProps, { kind: 'company' }>, 'size'>
  | Omit<Extract<AvatarProps, { kind: 'unmapped-company' }>, 'size'>;
const sizes: readonly AvatarSize[] = [32, 48];

function Row({ identity, hovered = false }: { identity: Identity; hovered?: boolean }) {
  const name = identity.kind === 'unmapped-company' ? 'Unmapped company' : identity.name;
  const label = hovered ? 'On a hovered row' : 'On the card';
  return (
    <div
      className="flex items-center gap-6 px-4 py-3"
      // A hovered table row sets --identity-surface, so the badge disc matches the row.
      style={
        hovered
          ? ({
              background: 'var(--prebid-row-hover)',
              '--identity-surface': 'var(--prebid-row-hover)',
            } as CSSProperties)
          : undefined
      }
    >
      <span className="w-32 text-small text-muted-foreground">{label}</span>
      {sizes.map((size) => (
        <span key={size} className="flex items-center gap-3">
          <Avatar {...identity} size={size} />
          <span className="text-body">{name}</span>
        </span>
      ))}
    </div>
  );
}

function Specimen({ identity }: { identity: Identity }) {
  return (
    <div className="max-w-2xl overflow-hidden rounded-lg border bg-card">
      <Row identity={identity} />
      <Row identity={identity} hovered />
    </div>
  );
}

const meta = { title: 'Identity/Avatar', component: Specimen } satisfies Meta<typeof Specimen>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Human: Story = {
  args: { identity: { kind: 'person', name: 'Alice Liddell', accountType: 'human' } },
};
export const Agent: Story = {
  args: { identity: { kind: 'person', name: 'Prebid sample agent', accountType: 'agent' } },
};
export const Bot: Story = {
  args: { identity: { kind: 'person', name: 'Sample bot', accountType: 'bot' } },
};
export const Unknown: Story = {
  args: { identity: { kind: 'person', name: 'Dana Reyes', accountType: 'unknown' } },
};
/** The account type is not available: no badge, unlike the Unknown classification. */
export const Unavailable: Story = {
  args: { identity: { kind: 'person', name: 'Dana Reyes', accountType: null } },
};
export const Company: Story = { args: { identity: { kind: 'company', name: 'Example Acme' } } };
export const Unmapped: Story = { args: { identity: { kind: 'unmapped-company' } } };
