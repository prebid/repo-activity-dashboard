import { useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Checkbox } from '../src/components/ui/checkbox';
import { Input } from '../src/components/ui/input';
import { Label } from '../src/components/ui/label';
import { NativeSelect } from '../src/components/ui/native-select';
import { Radio } from '../src/components/ui/radio';
import { SearchField } from '../src/components/ui/search-field';

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="grid w-60 gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function Specimen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="space-y-4">
      <h1 className="text-heading font-semibold">{title}</h1>
      <div className="flex flex-wrap items-start gap-6">{children}</div>
    </main>
  );
}

function InputSpecimen() {
  return (
    <Specimen title="Input">
      <Field id="input-empty" label="Empty with placeholder">
        <Input id="input-empty" placeholder="you@company.com" />
      </Field>
      <Field id="input-value" label="With a value">
        <Input id="input-value" defaultValue="prebid/Prebid.js" />
      </Field>
      <Field id="input-small" label="Small, 28px">
        <Input id="input-small" size="sm" placeholder="Find…" />
      </Field>
      <Field id="input-large" label="Large, 40px">
        <Input id="input-large" size="lg" placeholder="Enter your password" />
      </Field>
      <Field id="input-disabled" label="Disabled">
        <Input id="input-disabled" disabled defaultValue="Read only while saving" />
      </Field>
      <Field id="input-mono" label="Monospace, read only">
        <Input id="input-mono" font="mono" readOnly defaultValue="Il1O0-temp-9Qx" />
      </Field>
    </Specimen>
  );
}

function SearchFieldSpecimen() {
  return (
    <Specimen title="Search field">
      <div className="w-60">
        <SearchField aria-label="Search repositories" placeholder="Find in table…" />
      </div>
      <div className="w-60">
        <SearchField aria-label="Search records" defaultValue="adapter" />
      </div>
      <div className="w-60">
        <SearchField aria-label="Search choices" size="sm" placeholder="Find…" />
      </div>
      <div className="w-60">
        <SearchField aria-label="Search unavailable" placeholder="Find in table…" disabled />
      </div>
    </Specimen>
  );
}

const periods = [
  ['this-month', 'This month'],
  ['last-month', 'Last month'],
  ['last-90-days', 'Last 90 days'],
] as const;

function NativeSelectSpecimen() {
  const [period, setPeriod] = useState<string>('this-month');
  return (
    <Specimen title="Native select">
      <Field id="select-period" label="Reporting period">
        <NativeSelect
          id="select-period"
          value={period}
          onChange={(event) => setPeriod(event.target.value)}
        >
          {periods.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field id="select-small" label="Small, 28px">
        <NativeSelect id="select-small" size="sm" defaultValue="last-month">
          {periods.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field id="select-disabled" label="Disabled">
        <NativeSelect id="select-disabled" disabled defaultValue="this-month">
          {periods.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </Field>
    </Specimen>
  );
}

function Choice({ children }: { children: ReactNode }) {
  return <label className="flex items-center gap-2 text-body">{children}</label>;
}

function CheckboxSpecimen() {
  const [checked, setChecked] = useState(true);
  return (
    <Specimen title="Checkbox">
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-small font-medium">Account types</legend>
        <Choice>
          <Checkbox />
          Unchecked
        </Choice>
        <Choice>
          <Checkbox checked={checked} onChange={(event) => setChecked(event.target.checked)} />
          Checked
        </Choice>
        <Choice>
          <Checkbox indeterminate />
          Some selected
        </Choice>
        <Choice>
          <Checkbox disabled />
          Disabled
        </Choice>
        <Choice>
          <Checkbox disabled defaultChecked />
          Disabled and checked
        </Choice>
      </fieldset>
    </Specimen>
  );
}

function RadioSpecimen() {
  const [format, setFormat] = useState('summary');
  return (
    <Specimen title="Radio">
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-small font-medium">Export format</legend>
        {['summary', 'detail'].map((value) => (
          <Choice key={value}>
            <Radio
              name="format"
              value={value}
              checked={format === value}
              onChange={() => setFormat(value)}
            />
            {value === 'summary' ? 'Summary rows' : 'Detail rows'}
          </Choice>
        ))}
        <Choice>
          <Radio name="format" value="raw" disabled />
          Disabled
        </Choice>
      </fieldset>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-small font-medium">Unavailable</legend>
        <Choice>
          <Radio name="unavailable" disabled defaultChecked />
          Disabled and checked
        </Choice>
      </fieldset>
    </Specimen>
  );
}

const meta = {
  title: 'Primitives/Fields',
  component: InputSpecimen,
} satisfies Meta<typeof InputSpecimen>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Inputs: Story = {};
export const SearchFields: Story = { render: () => <SearchFieldSpecimen /> };
export const NativeSelects: Story = { render: () => <NativeSelectSpecimen /> };
export const Checkboxes: Story = { render: () => <CheckboxSpecimen /> };
export const Radios: Story = { render: () => <RadioSpecimen /> };
