import { useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogFooter } from '@/components/ui/dialog';
import { FilterChoices } from '@/components/tables/filter-choices';
import { repositoryPageFiltersSchema, type RepositoryPageFilters } from '@/models/repository-page';
import { X } from 'lucide-react';
import {
  removeRepositoryFilter,
  repositoryFilterChips,
  repositoryFilterErrorMessage,
  type RepositoryFilterDraft,
  type RepositoryFilterField,
} from './repository-filter-fields';
import styles from './repository-controls.module.css';

/**
 * The repository record filter form shared by record lists and Timelines: field rendering, value
 * encoding, schema validation and the dialog footer. `onApply` returns an error to keep it open.
 */
export function RepositoryFilterForm({
  fields,
  draft,
  setDraft,
  defaults,
  onApply,
  leading,
  help,
}: {
  fields: RepositoryFilterField[];
  draft: RepositoryFilterDraft;
  setDraft: Dispatch<SetStateAction<RepositoryFilterDraft>>;
  defaults: RepositoryPageFilters;
  onApply: (filters: RepositoryPageFilters) => string | undefined;
  leading?: ReactNode;
  help?: ReactNode;
}) {
  const [error, setError] = useState('');
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = repositoryPageFiltersSchema.safeParse(draft);
        setError(
          parsed.success
            ? (onApply(parsed.data) ?? '')
            : repositoryFilterErrorMessage(parsed.error, fields),
        );
      }}
    >
      <div className={styles.fieldGrid}>
        {leading}
        {fields.map((field) => {
          const value = draft[field.key];
          return field.multiple ? (
            <FilterChoices
              key={field.key}
              label={field.label}
              options={field.options}
              selected={Array.isArray(value) ? value : []}
              onChange={(next) => setDraft((previous) => ({ ...previous, [field.key]: next }))}
            />
          ) : (
            <label key={field.key} className={styles.selectField}>
              {field.label}
              <select
                value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
                onChange={(event) => {
                  const next = event.target.value;
                  setDraft((previous) => ({
                    ...previous,
                    [field.key]:
                      next === '' ? undefined : field.key === 'ageBand' ? Number(next) : next,
                  }));
                }}
              >
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
      {help}
      {error && (
        <p role="alert" className={styles.help}>
          {error}
        </p>
      )}
      <DialogFooter className={styles.dialogFooter}>
        <Button type="button" variant="ghost" onClick={() => setDraft({ ...defaults })}>
          Clear selections
        </Button>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit">Apply filters</Button>
      </DialogFooter>
    </form>
  );
}
/** Removable chips for the active field filters; callers add chips for filters they own. */
export function RepositoryFilterChips({
  filters,
  chips,
  label,
  onChange,
  children,
}: {
  filters: RepositoryPageFilters;
  chips: ReturnType<typeof repositoryFilterChips>;
  label: string;
  onChange: (value: RepositoryPageFilters) => unknown;
  children?: ReactNode;
}) {
  return (
    <div className={styles.chips} aria-label={label}>
      {chips.map((chip) => (
        <button
          type="button"
          key={chip.key + ':' + chip.value}
          onClick={() => onChange(removeRepositoryFilter(filters, chip.key, chip.value))}
          aria-label={'Remove ' + chip.label}
        >
          {chip.label}
          <X size={12} aria-hidden="true" />
        </button>
      ))}
      {children}
    </div>
  );
}
