'use client';
import { useId, type ReactNode } from 'react';
import { DropdownMenuCheckboxItem, DropdownMenuGroup } from '@/components/ui/dropdown-menu';
import type { SelectableColumn } from '@/models/column-selection';
import {
  columnSelectionGroups,
  columnSelectionState,
  changeColumnSelection,
} from '@/lib/presentation/column-selection';
import styles from './column-selection.module.css';
type Mode = 'menu' | 'form';
function Choice({
  mode,
  label,
  accessibleLabel,
  description,
  checked,
  disabled,
  required = false,
  header = false,
  count,
  onChange,
}: {
  mode: Mode;
  label: string;
  accessibleLabel?: string;
  description?: string;
  checked: boolean | 'indeterminate';
  disabled: boolean;
  required?: boolean;
  header?: boolean;
  count?: string;
  onChange: (show: boolean) => void;
}) {
  const descriptionId = useId();
  const name = accessibleLabel ?? (required ? label + ' (required)' : label);
  const content = (
    <>
      <span className={styles.label}>{label}</span>
      {required && (
        <span className={styles.required} aria-hidden="true">
          Required
        </span>
      )}
      {count && (
        <span className={styles.count} aria-hidden="true">
          {count}
        </span>
      )}
    </>
  );
  const className = header ? styles.heading : styles.choice;
  const control =
    mode === 'menu' ? (
      <DropdownMenuCheckboxItem
        className={className}
        aria-label={name}
        aria-describedby={description ? descriptionId : undefined}
        title={description}
        checked={checked}
        disabled={disabled}
        onSelect={(event) => event.preventDefault()}
        onCheckedChange={(value) => onChange(value === true)}
      >
        {content}
      </DropdownMenuCheckboxItem>
    ) : (
      <label className={className} title={description}>
        <input
          type="checkbox"
          aria-label={name}
          aria-describedby={description ? descriptionId : undefined}
          checked={checked === true}
          ref={(node) => {
            if (node) node.indeterminate = checked === 'indeterminate';
          }}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        {content}
      </label>
    );
  return (
    <>
      {control}
      {description && (
        <span id={descriptionId} hidden>
          {description}
        </span>
      )}
    </>
  );
}
function Group({
  mode,
  label,
  children,
  className,
}: {
  mode: Mode;
  label: string;
  children: ReactNode;
  className: string;
}) {
  return mode === 'menu' ? (
    <DropdownMenuGroup aria-label={label} className={className}>
      {children}
    </DropdownMenuGroup>
  ) : (
    <section role="group" aria-label={label} className={className}>
      {children}
    </section>
  );
}
export function ColumnSelection({
  columns,
  selectedIds,
  onChange,
  mode,
  disabled = false,
  allowEmpty = true,
}: {
  columns: readonly SelectableColumn[];
  selectedIds: readonly string[];
  onChange: (ids: string[]) => void;
  mode: Mode;
  disabled?: boolean;
  allowEmpty?: boolean;
}) {
  const selected = columns
    .filter((column) => column.required || selectedIds.includes(column.id))
    .map((column) => column.id);
  function toggle(targets: readonly SelectableColumn[], show: boolean) {
    onChange(changeColumnSelection(columns, selected, targets, show, allowEmpty));
  }
  function control(targets: readonly SelectableColumn[], label: string) {
    const state = columnSelectionState(targets, selected);
    const removable = targets.filter((column) => !column.required).map((column) => column.id);
    const last =
      !allowEmpty && state.checked === true && selected.every((id) => removable.includes(id));
    return (
      <Choice
        mode={mode}
        header
        label={label}
        accessibleLabel={
          targets.some((column) => column.label === label) ? 'All ' + label + ' columns' : label
        }
        description={`${state.count} of ${state.total} selected`}
        checked={state.checked}
        disabled={disabled || !removable.length || last}
        count={`${state.count}/${state.total}`}
        onChange={(show) => toggle(targets, show)}
      />
    );
  }
  return (
    <div className={styles.list} data-column-selection={mode}>
      {columnSelectionGroups(columns).map((group) => (
        <Group key={group.label} mode={mode} label={group.label} className={styles.group}>
          {control(group.columns, group.label)}
          {group.sections.map((section) => (
            <div key={section.label} className={styles.section}>
              {section.label && (
                <div className={styles.subheading}>{control(section.columns, section.label)}</div>
              )}
              {section.columns.map((column) => (
                <Choice
                  key={column.id}
                  mode={mode}
                  label={column.label}
                  description={column.description}
                  required={column.required}
                  checked={selected.includes(column.id)}
                  disabled={
                    disabled ||
                    !!column.required ||
                    (!allowEmpty && selected.length === 1 && selected.includes(column.id))
                  }
                  onChange={(show) => toggle([column], show)}
                />
              ))}
            </div>
          ))}
        </Group>
      ))}
    </div>
  );
}
