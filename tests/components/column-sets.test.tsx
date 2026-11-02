import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ColumnMenu } from '@/components/tables/column-menu';
import { CsvExportDialog } from '@/components/exports/csv-export-dialog';
import { LocalDataTable } from '@/components/tables/local-data-table';
import type { ColumnSetChoice, DataColumn } from '@/components/tables/table-columns';

interface Row {
  id: string;
}
const ids = ['name', 'company', 'prs', 'merged', 'reviews', 'approvals', 'comments'];
const columns: DataColumn<Row>[] = ids.map((id) => ({
  id,
  label: label(id),
  selectionGroup: id === 'name' || id === 'company' ? 'Identity' : 'Metrics',
  hideable: id !== 'name',
  value: () => 1,
}));
const contributor = ['prs', 'merged'];
function choice(onChoose: (id: string) => void): ColumnSetChoice {
  return {
    label: 'Column set',
    domain: ['prs', 'merged', 'reviews', 'approvals', 'comments'],
    options: [
      { id: 'contributor', label: 'Contributor', columnIds: contributor },
      { id: 'reviewer', label: 'Reviewer', columnIds: ['reviews', 'approvals'] },
      { id: 'credits', label: 'All credits', columnIds: ['prs', 'merged', 'reviews', 'approvals'] },
      { id: 'all', label: 'All columns', columnIds: ids.slice(1) },
    ],
    onChoose,
  };
}
/** The visibility map for the hideable columns with exactly `shown` visible. */
const showing = (...shown: string[]) =>
  Object.fromEntries(ids.slice(1).map((id) => [id, shown.includes(id)]));

describe('Columns menu with column sets', () => {
  it.each([
    ['Columns · Contributor', showing('company', ...contributor)],
    ['Columns · Contributor', showing(...contributor)],
    ['Columns · Custom', showing('company', ...contributor, 'comments')],
    ['Columns · All credits', showing('prs', 'merged', 'reviews', 'approvals')],
    ['Columns · All columns', showing(...ids)],
    ['Columns · Custom', showing('prs', 'merged', 'reviews', 'approvals', 'comments')],
  ])('names the trigger and the menu %s', async (name, value) => {
    const user = userEvent.setup();
    render(
      <ColumnMenu
        columns={columns}
        visibility={{ value, onChange: vi.fn(), sets: choice(vi.fn()) }}
      />,
    );
    await user.click(screen.getByRole('button', { name }));
    expect(screen.getByRole('menu', { name })).toBeVisible();
  });
  it('keeps the plain Columns name without sets', () => {
    render(<ColumnMenu columns={columns} visibility={{ value: {}, onChange: vi.fn() }} />);
    expect(screen.getByRole('button', { name: 'Columns' })).toBeVisible();
  });
  it('leads with the Column set radio group, checked by the visible columns', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ColumnMenu
        columns={columns}
        visibility={{ value: showing(...contributor), onChange: vi.fn(), sets: choice(vi.fn()) }}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Columns · Contributor' }));
    const menu = screen.getByRole('menu');
    const groups = within(menu).getAllByRole('group');
    expect(groups[0]).toHaveAccessibleName('Column set');
    expect(groups[1]).toHaveAccessibleName('Identity');
    const radios = within(groups[0]).getAllByRole('menuitemradio');
    expect(radios).toHaveLength(4);
    ['Contributor', 'Reviewer', 'All credits', 'All columns'].forEach((name, index) =>
      expect(radios[index]).toHaveAccessibleName(name),
    );
    expect(radios.map((radio) => radio.getAttribute('aria-checked'))).toEqual([
      'true',
      'false',
      'false',
      'false',
    ]);
    rerender(
      <ColumnMenu
        columns={columns}
        visibility={{
          value: showing(...contributor, 'comments'),
          onChange: vi.fn(),
          sets: choice(vi.fn()),
        }}
      />,
    );
    for (const radio of within(menu).getAllByRole('menuitemradio'))
      expect(radio).toHaveAttribute('aria-checked', 'false');
    expect(within(menu).getByRole('menuitemcheckbox', { name: 'Comments' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
  it('applies a chosen set once through the feature and keeps the menu open', async () => {
    const user = userEvent.setup();
    const chosen = vi.fn();
    function Menu() {
      const [value, setValue] = useState(showing('company', ...contributor));
      const sets = choice((id) => {
        chosen(id);
        const listed = sets.options.find((option) => option.id === id)!.columnIds;
        setValue((current) => ({
          ...current,
          ...Object.fromEntries(sets.domain.map((column) => [column, listed.includes(column)])),
        }));
      });
      return <ColumnMenu columns={columns} visibility={{ value, onChange: setValue, sets }} />;
    }
    render(<Menu />);
    await user.click(screen.getByRole('button', { name: 'Columns · Contributor' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Reviewer' }));
    expect(chosen.mock.calls).toEqual([['reviewer']]);
    const menu = screen.getByRole('menu', { name: 'Columns · Reviewer' });
    expect(within(menu).getByRole('menuitemradio', { name: 'Reviewer' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(within(menu).getByRole('menuitemcheckbox', { name: 'Prs' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(within(menu).getByRole('menuitemcheckbox', { name: 'Company' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    // The set already shown is not applied again.
    await user.click(within(menu).getByRole('menuitemradio', { name: 'Reviewer' }));
    expect(chosen).toHaveBeenCalledTimes(1);
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Columns · Reviewer' })).toHaveFocus();
  });
});

describe('CSV dialog with column sets', () => {
  function Table({
    onChange,
    onChoose,
    sets = true,
  }: {
    onChange: (next: Record<string, boolean>) => void;
    onChoose: (id: string) => void;
    sets?: boolean;
  }) {
    return (
      <LocalDataTable
        search="none"
        title="Credits"
        rows={[{ id: 'one' }]}
        columns={columns}
        exportName="credits.csv"
        visibility={{
          value: showing('company', ...contributor),
          onChange,
          sets: sets ? choice(onChoose) : undefined,
        }}
      />
    );
  }
  it('offers the sets in place of All columns and changes only the export draft', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn(),
      onChoose = vi.fn();
    render(<Table onChange={onChange} onChoose={onChoose} />);
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    const dialog = screen.getByRole('dialog', { name: 'Credits CSV export' });
    const sets = within(dialog).getByRole('group', { name: 'Column set' });
    const radios = within(sets).getAllByRole('radio');
    expect(radios).toHaveLength(4);
    ['Contributor', 'Reviewer', 'All credits', 'All columns'].forEach((name, index) =>
      expect(radios[index]).toHaveAccessibleName(name),
    );
    expect(within(sets).getByRole('radio', { name: 'Contributor' })).toBeChecked();
    expect(within(dialog).queryByRole('button', { name: 'All columns' })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Visible columns' })).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Clear selection' })).toBeVisible();
    expect(checked(dialog)).toEqual(['Name (required)', 'Company', 'Prs', 'Merged']);

    // A set decides its metrics; the identity column keeps its draft state.
    await user.click(within(sets).getByRole('radio', { name: 'Reviewer' }));
    expect(checked(dialog)).toEqual(['Name (required)', 'Company', 'Reviews', 'Approvals']);
    expect(within(sets).getByRole('radio', { name: 'Reviewer' })).toBeChecked();
    await user.click(within(dialog).getByRole('checkbox', { name: 'Company' }));
    await user.click(within(sets).getByRole('radio', { name: 'All credits' }));
    expect(checked(dialog)).toEqual(['Name (required)', 'Prs', 'Merged', 'Reviews', 'Approvals']);

    // All columns decides every hideable column.
    await user.click(within(sets).getByRole('radio', { name: 'All columns' }));
    expect(checked(dialog)).toEqual(['Name (required)', ...ids.slice(1).map(label)]);
    expect(within(dialog).getByText('7 selected')).toBeVisible();

    // A selection no set shows leaves every set unchecked.
    await user.click(within(dialog).getByRole('checkbox', { name: 'Reviews' }));
    for (const radio of within(sets).getAllByRole('radio')) expect(radio).not.toBeChecked();
    await user.click(within(dialog).getByRole('button', { name: 'Visible columns' }));
    expect(within(sets).getByRole('radio', { name: 'Contributor' })).toBeChecked();

    expect(onChange).not.toHaveBeenCalled();
    expect(onChoose).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Columns · Contributor' })).toBeVisible();
  });
  it('keeps All columns and no set group without sets', async () => {
    const user = userEvent.setup();
    render(<Table onChange={vi.fn()} onChoose={vi.fn()} sets={false} />);
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    const dialog = screen.getByRole('dialog', { name: 'Credits CSV export' });
    expect(within(dialog).queryByRole('group', { name: 'Column set' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'All columns' }));
    expect(within(dialog).getByText('7 selected')).toBeVisible();
  });
  it('decides only the columns a layout offers, and locks the sets while preparing', async () => {
    const user = userEvent.setup();
    const onDownload = vi.fn(() => new Promise<never>(() => {}));
    render(
      <CsvExportDialog
        title="Credits"
        columns={columns.map((column) => ({
          id: column.id,
          label: column.label,
          selectionGroup: column.selectionGroup,
          required: column.hideable === false,
        }))}
        visibleColumnIds={['name', 'company', ...contributor]}
        columnSets={choice(vi.fn())}
        contextKey="credits"
        layouts={[{ id: 'compact', label: 'Compact', columnIds: ['name', 'prs', 'reviews'] }]}
        onDownload={onDownload}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    const dialog = screen.getByRole('dialog', { name: 'Credits CSV export' });
    const sets = within(dialog).getByRole('group', { name: 'Column set' });
    await user.click(within(dialog).getByRole('radio', { name: 'Compact' }));
    // Of the Contributor set's metrics, the layout offers only Prs, which the draft holds.
    expect(within(sets).getByRole('radio', { name: 'Contributor' })).toBeChecked();
    await user.click(within(sets).getByRole('radio', { name: 'Reviewer' }));
    expect(checked(dialog)).toEqual(['Name (required)', 'Reviews']);
    await user.click(within(dialog).getByRole('button', { name: 'Download CSV' }));
    expect(onDownload).toHaveBeenCalledWith(
      expect.objectContaining({ layout: 'compact', columnIds: ['name', 'reviews'] }),
    );
    for (const radio of within(sets).getAllByRole('radio')) expect(radio).toBeDisabled();
  });
});
function label(id: string) {
  return id[0].toUpperCase() + id.slice(1);
}
/** The column checkboxes a dialog has checked, by name, leaving out the group toggles. */
function checked(dialog: HTMLElement) {
  const names = ['Name (required)', ...ids.slice(1).map(label)];
  return within(dialog)
    .getAllByRole<HTMLInputElement>('checkbox')
    .filter((box) => box.checked)
    .map((box) => box.getAttribute('aria-label')!)
    .filter((name) => names.includes(name));
}
