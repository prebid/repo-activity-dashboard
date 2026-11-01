import { createRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Radio } from '@/components/ui/radio';
import { SearchField } from '@/components/ui/search-field';

describe('Input', () => {
  it('is an opaque 34px field by default with the coarse-pointer text size', () => {
    const ref = createRef<HTMLInputElement>();
    render(
      <>
        <Label htmlFor="email">Email</Label>
        <Input id="email" ref={ref} type="email" placeholder="you@company.com" />
      </>,
    );
    const input = screen.getByRole('textbox', { name: 'Email' });
    expect(ref.current).toBe(input);
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveClass(
      'h-[34px]',
      'bg-(--prebid-input)',
      'border-input',
      'placeholder:text-placeholder',
      'pointer-coarse:text-(length:--prebid-text-input-coarse)',
    );
  });

  it('takes the 28 and 40px sizes and keeps a caller class', () => {
    render(
      <>
        <Input aria-label="Small" size="sm" />
        <Input aria-label="Large" size="lg" className="pr-12" />
      </>,
    );
    expect(screen.getByRole('textbox', { name: 'Small' })).toHaveClass('h-7', 'text-small');
    expect(screen.getByRole('textbox', { name: 'Large' })).toHaveClass('h-10', 'pr-12');
  });

  it('sets a monospace value only when asked', () => {
    render(
      <>
        <Input aria-label="Password" font="mono" readOnly value="Il1O0" />
        <Input aria-label="Name" />
      </>,
    );
    expect(screen.getByRole('textbox', { name: 'Password' })).toHaveClass('font-mono');
    expect(screen.getByRole('textbox', { name: 'Password' })).not.toHaveAttribute('font');
    expect(screen.getByRole('textbox', { name: 'Name' })).not.toHaveClass('font-mono');
  });
});

describe('SearchField', () => {
  it('stays a text box with a decorative icon and forwards edits and its reference', async () => {
    const ref = createRef<HTMLInputElement>();
    const change = vi.fn();
    const { container } = render(
      <SearchField ref={ref} aria-label="Search repositories" onChange={change} size="sm" />,
    );
    const field = screen.getByRole('textbox', { name: 'Search repositories' });
    expect(ref.current).toBe(field);
    expect(field).toHaveAttribute('type', 'text');
    expect(field).toHaveClass('h-7', 'pl-[30px]');
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    await userEvent.type(field, 'pbjs');
    expect(field).toHaveValue('pbjs');
    expect(change).toHaveBeenCalled();
  });
});

describe('NativeSelect', () => {
  function Period() {
    const [value, setValue] = useState('this-month');
    return (
      <>
        <Label htmlFor="period">Reporting period</Label>
        <NativeSelect id="period" value={value} onChange={(event) => setValue(event.target.value)}>
          <option value="this-month">This month</option>
          <option value="last-month">Last month</option>
        </NativeSelect>
      </>
    );
  }

  it('keeps the native combobox, changes value and draws one decorative chevron', async () => {
    const { container } = render(<Period />);
    const select = screen.getByRole('combobox', { name: 'Reporting period' });
    expect(select).toHaveValue('this-month');
    expect(select).toHaveClass('appearance-none', 'h-[34px]', 'font-medium');
    expect(container.querySelectorAll('svg')).toHaveLength(1);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    await userEvent.selectOptions(select, 'last-month');
    expect(select).toHaveValue('last-month');
  });

  it('takes the 28px size, a disabled state and a reference', () => {
    const ref = createRef<HTMLSelectElement>();
    render(
      <NativeSelect ref={ref} aria-label="Measure" size="sm" disabled defaultValue="b">
        <option value="a">A</option>
        <option value="b">B</option>
      </NativeSelect>,
    );
    const select = screen.getByRole('combobox', { name: 'Measure' });
    expect(ref.current).toBe(select);
    expect(select).toBeDisabled();
    expect(select).toHaveValue('b');
    expect(select).toHaveClass('h-7');
  });
});

describe('Checkbox', () => {
  it('toggles, forwards its reference and keeps its label', async () => {
    const ref = createRef<HTMLInputElement>();
    render(
      <label>
        <Checkbox ref={ref} defaultChecked={false} />
        Human accounts
      </label>,
    );
    const box = screen.getByRole('checkbox', { name: 'Human accounts' });
    expect(ref.current).toBe(box);
    expect(box).not.toBeChecked();
    await userEvent.click(screen.getByText('Human accounts'));
    expect(box).toBeChecked();
  });

  it('sets and clears the mixed state, which has no attribute', () => {
    const { rerender } = render(<Checkbox aria-label="All columns" indeterminate />);
    const box = screen.getByRole<HTMLInputElement>('checkbox', { name: 'All columns' });
    expect(box.indeterminate).toBe(true);
    expect(box).toBePartiallyChecked();
    rerender(<Checkbox aria-label="All columns" />);
    expect(box.indeterminate).toBe(false);
  });

  it('cannot be changed while disabled', async () => {
    render(<Checkbox aria-label="Bots" disabled defaultChecked />);
    const box = screen.getByRole('checkbox', { name: 'Bots' });
    await userEvent.click(box);
    expect(box).toBeChecked();
    expect(box).toBeDisabled();
  });
});

describe('Radio', () => {
  it('selects one option of a group and forwards its reference', async () => {
    const ref = createRef<HTMLInputElement>();
    render(
      <fieldset>
        <legend>Export format</legend>
        <label>
          <Radio ref={ref} name="format" value="summary" defaultChecked />
          Summary rows
        </label>
        <label>
          <Radio name="format" value="detail" />
          Detail rows
        </label>
        <label>
          <Radio name="format" value="raw" disabled />
          Raw rows
        </label>
      </fieldset>,
    );
    const summary = screen.getByRole('radio', { name: 'Summary rows' });
    const detail = screen.getByRole('radio', { name: 'Detail rows' });
    expect(ref.current).toBe(summary);
    expect(summary).toBeChecked();
    await userEvent.click(detail);
    expect(detail).toBeChecked();
    expect(summary).not.toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: 'Raw rows' }));
    expect(detail).toBeChecked();
  });
});
