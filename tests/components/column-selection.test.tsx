import { useState } from 'react';
import { expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ColumnSelection } from '@/components/tables/column-selection';
import { ColumnMenu } from '@/components/tables/column-menu';
import { DataTable } from '@/components/tables/data-table';
import { useLocalTableController } from '@/components/tables/local-data-table';
import type { SelectableColumn } from '@/models/column-selection';
const choices: SelectableColumn[] = [
  { id: 'name', label: 'Name', selectionGroup: 'Identity', required: true },
  {
    id: 'added',
    label: 'Added',
    group: 'Authored',
    selectionSection: 'Files',
    description: 'Files added in merged PRs.',
  },
  { id: 'removed', label: 'Removed', group: 'Authored', selectionSection: 'Files' },
  { id: 'lines', label: 'Lines added', group: 'Authored', selectionSection: 'Lines' },
];
function Form({ disabled = false }: { disabled?: boolean }) {
  const [selected, setSelected] = useState(['name', 'added']);
  return (
    <>
      <ColumnSelection
        mode="form"
        columns={choices}
        selectedIds={selected}
        onChange={setSelected}
        disabled={disabled}
      />
      <output>{selected.join(',')}</output>
    </>
  );
}
it('uses group and section toggles with mixed selection, required fields and shared descriptions', async () => {
  const user = userEvent.setup();
  render(<Form />);
  expect(screen.getByRole('checkbox', { name: 'Name (required)' })).toBeDisabled();
  expect(screen.getByRole('checkbox', { name: 'Authored' })).toBePartiallyChecked();
  expect(screen.getByRole('checkbox', { name: 'Files' })).toBePartiallyChecked();
  expect(screen.getByRole('checkbox', { name: 'Added' })).toHaveAccessibleDescription(
    'Files added in merged PRs.',
  );
  await user.click(screen.getByRole('checkbox', { name: 'Files' }));
  expect(screen.getByRole('checkbox', { name: 'Removed' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Lines added' })).not.toBeChecked();
  await user.click(screen.getByRole('checkbox', { name: 'Authored' }));
  expect(screen.getByRole('checkbox', { name: 'Lines added' })).toBeChecked();
  await user.click(screen.getByRole('checkbox', { name: 'Files' }));
  expect(screen.getByRole('checkbox', { name: 'Added' })).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Lines added' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Name (required)' })).toBeChecked();
  await user.click(screen.getByRole('checkbox', { name: 'Removed' }));
  await user.click(screen.getByRole('checkbox', { name: 'Removed' }));
  expect(screen.getByRole('checkbox', { name: 'Removed' })).not.toBeChecked();
});
it('disables every form choice while an export is preparing', () => {
  render(<Form disabled />);
  for (const checkbox of screen.getAllByRole('checkbox')) expect(checkbox).toBeDisabled();
});
it('keeps menu keyboard semantics and protects the last visible field', async () => {
  const user = userEvent.setup();
  function Menu() {
    const [value, setValue] = useState<Record<string, boolean>>({ added: true, removed: false });
    return (
      <ColumnMenu
        columns={choices.slice(1, 3).map((column) => ({ ...column, value: () => 1 }))}
        visibility={{ value, onChange: setValue }}
      />
    );
  }
  render(<Menu />);
  await user.click(screen.getByRole('button', { name: 'Columns' }));
  expect(screen.getByRole('menuitemcheckbox', { name: 'Added' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'Files' }));
  expect(screen.getByRole('menuitemcheckbox', { name: 'Removed' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  expect(screen.getByRole('menuitemcheckbox', { name: 'Authored' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'Added' }));
  expect(screen.getByRole('menuitemcheckbox', { name: 'Added' })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  await user.keyboard('{Escape}');
  expect(screen.getByRole('button', { name: 'Columns' })).toHaveFocus();
});
it('shares the same organization in the table menu and CSV form without changing visibility', async () => {
  const user = userEvent.setup(),
    changed = vi.fn();
  function Table() {
    const controller = useLocalTableController();
    return (
      <DataTable
        title="Shared"
        rows={[{ id: 'one' }]}
        columns={choices.map((column) => ({
          ...column,
          value: () => 1,
          hideable: !column.required,
        }))}
        controller={controller}
        visibility={{ value: { added: true, removed: false, lines: false }, onChange: changed }}
        exportName="shared.csv"
      />
    );
  }
  render(<Table />);
  await user.click(screen.getByRole('button', { name: 'Columns' }));
  const menu = screen.getByRole('menu');
  expect(within(menu).getByRole('group', { name: 'Identity' })).toBeVisible();
  expect(within(menu).getByRole('group', { name: 'Authored' })).toBeVisible();
  expect(within(menu).getByRole('menuitemcheckbox', { name: 'Files' })).toHaveAttribute(
    'aria-checked',
    'mixed',
  );
  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', { name: 'Export CSV' }));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByRole('group', { name: 'Identity' })).toBeVisible();
  await user.click(within(dialog).getByRole('checkbox', { name: 'Lines' }));
  expect(within(dialog).getByRole('checkbox', { name: 'Lines added' })).toBeChecked();
  expect(changed).not.toHaveBeenCalled();
});

it.each(['menu', 'form'] as const)(
  'distinguishes a %s group toggle from a field with the same label',
  async (mode) => {
    const user = userEvent.setup();
    const columns = [
      { id: 'latest', label: 'Latest activity', group: 'Latest activity', value: () => 1 },
      { id: 'actor', label: 'Latest actor', group: 'Latest activity', value: () => 1 },
    ];
    function Preview() {
      const [selected, setSelected] = useState(['latest']);
      return mode === 'menu' ? (
        <ColumnMenu
          columns={columns}
          allowEmpty
          visibility={{
            value: { latest: selected.includes('latest'), actor: selected.includes('actor') },
            onChange: (next) =>
              setSelected(columns.filter((column) => next[column.id]).map((column) => column.id)),
          }}
        />
      ) : (
        <ColumnSelection
          mode="form"
          columns={columns}
          selectedIds={selected}
          onChange={setSelected}
        />
      );
    }
    render(<Preview />);
    if (mode === 'menu') await user.click(screen.getByRole('button', { name: 'Columns' }));
    const role = mode === 'menu' ? 'menuitemcheckbox' : 'checkbox';
    expect(screen.getAllByRole(role, { name: 'Latest activity' })).toHaveLength(1);
    await user.click(screen.getByRole(role, { name: 'All Latest activity columns' }));
    expect(screen.getByRole(role, { name: 'Latest actor' })).toBeChecked();
    await user.click(screen.getByRole(role, { name: 'Latest activity' }));
    expect(screen.getByRole(role, { name: 'Latest activity' })).not.toBeChecked();
    expect(screen.getByRole(role, { name: 'Latest actor' })).toBeChecked();
  },
);
