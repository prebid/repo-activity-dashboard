import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button, type ButtonSize, type ButtonVariant } from '../src/components/ui/button';
import {
  AddIcon,
  ColumnsIcon,
  ContinueIcon,
  ExpandIcon,
  ExportIcon,
  ResetIcon,
} from '../src/components/ui/icons';

const variants: ButtonVariant[] = ['primary', 'secondary', 'ghost', 'destructive'];
const textSizes = ['sm', 'md', 'lg'] as const satisfies readonly ButtonSize[];
const labels: Record<ButtonVariant, string> = {
  primary: 'Apply',
  secondary: 'Columns',
  ghost: 'Reset view',
  destructive: 'Discard',
};

function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-overline font-semibold text-muted-foreground uppercase">{title}</h2>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

/** Every variant at every size: 28, 34 and 40px text buttons and 28 and 34px icon buttons. */
function SizesSpecimen() {
  return (
    <main className="space-y-6">
      <h1 className="sr-only">Button sizes</h1>
      {variants.map((variant) => (
        <Row key={variant} title={variant}>
          {textSizes.map((size) => (
            <Button key={size} variant={variant} size={size}>
              {labels[variant]} {size}
            </Button>
          ))}
          <Button variant={variant} size="icon-sm" aria-label={labels[variant] + ' icon-sm'}>
            <AddIcon size={14} />
          </Button>
          <Button variant={variant} size="icon" aria-label={labels[variant] + ' icon'}>
            <AddIcon size={14} />
          </Button>
        </Row>
      ))}
    </main>
  );
}

/** The selected state comes from aria-pressed or an open menu's data-state, never colour alone. */
function PressedSpecimen() {
  return (
    <main className="space-y-6">
      <h1 className="sr-only">Pressed buttons</h1>
      <Row title="aria-pressed">
        <Button aria-pressed={false}>Not pressed</Button>
        <Button aria-pressed>Pressed</Button>
        <Button size="sm" aria-pressed>
          Pressed sm
        </Button>
      </Row>
      <Row title="open menu trigger">
        <Button data-state="closed">
          <ColumnsIcon size={14} />
          Columns
          <ExpandIcon size={14} />
        </Button>
        <Button data-state="open" aria-expanded>
          <ColumnsIcon size={14} />
          Columns
          <ExpandIcon size={14} />
        </Button>
      </Row>
    </main>
  );
}

function DisabledSpecimen() {
  return (
    <main className="space-y-6">
      <h1 className="sr-only">Disabled buttons</h1>
      <Row title="disabled">
        {variants.map((variant) => (
          <Button key={variant} variant={variant} disabled>
            {labels[variant]}
          </Button>
        ))}
        <Button size="icon" disabled aria-label="Add disabled">
          <AddIcon size={14} />
        </Button>
      </Row>
    </main>
  );
}

/** 14px icons at sm and md, 16px at lg. */
function WithIconSpecimen() {
  return (
    <main className="space-y-6">
      <h1 className="sr-only">Buttons with icons</h1>
      <Row title="leading icon">
        <Button size="sm">
          <ExportIcon size={14} />
          Export CSV
        </Button>
        <Button>
          <ExportIcon size={14} />
          Export CSV
        </Button>
        <Button variant="ghost">
          <ResetIcon size={14} />
          Reset view
        </Button>
        <Button variant="ghost" size="sm">
          <ResetIcon size={14} />
          Reset view
        </Button>
      </Row>
      <Row title="trailing icon">
        <Button variant="primary" size="lg">
          Sign in
          <ContinueIcon size={16} />
        </Button>
        <Button variant="secondary" size="lg">
          Continue
          <ContinueIcon size={16} />
        </Button>
      </Row>
    </main>
  );
}

const meta = {
  title: 'Primitives/Button',
  component: SizesSpecimen,
} satisfies Meta<typeof SizesSpecimen>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Sizes: Story = {};
export const Pressed: Story = { render: () => <PressedSpecimen /> };
export const Disabled: Story = { render: () => <DisabledSpecimen /> };
export const WithIcon: Story = { render: () => <WithIconSpecimen /> };
