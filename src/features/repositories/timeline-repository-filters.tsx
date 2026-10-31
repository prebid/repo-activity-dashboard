'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { FilterChoices } from '@/components/tables/filter-choices';
import {
  repositoryPageFiltersSchema,
  type RepositoryPageFilters,
  type RepositoryFilterOptions,
} from '@/models/repository-page';
import {
  repositoryFilterFieldsFromOptions,
  repositoryFilterChips,
  removeRepositoryFilter,
  repositoryFilterErrorMessage,
  type RepositoryFilterDraft,
} from './repository-filter-fields';
import { defaultRepositoryFilters } from '@/lib/presentation/repository-page-query';
import styles from './repository-controls.module.css';
export function TimelineRepositoryFilters({
  filters,
  facets,
  snapshot,
  onChange,
}: {
  filters: RepositoryPageFilters;
  facets: RepositoryFilterOptions;
  snapshot: boolean;
  onChange: (value: RepositoryPageFilters) => string | undefined;
}) {
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState<RepositoryFilterDraft>({ ...filters }),
    [error, setError] = useState('');
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const fields = repositoryFilterFieldsFromOptions({
    ...facets,
    kind: filters.kind,
    current: snapshot,
    cutoff: snapshot,
  });
  const chips = repositoryFilterChips(filters, fields);
  return (
    <div ref={setContainer}>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (value) {
            setDraft({ ...filters });
            setError('');
          }
          setOpen(value);
        }}
      >
        <DialogTrigger asChild>
          <Button variant="outline">
            Record filters
            {chips.length || filters.search
              ? ' (' + (chips.length + Number(!!filters.search)) + ')'
              : ''}
          </Button>
        </DialogTrigger>
        <DialogContent container={container} className={styles.dialog}>
          <DialogHeader>
            <DialogTitle>Filter timeline records</DialogTitle>
            <DialogDescription>
              {snapshot
                ? 'Filters use the supplied state at each cutoff.'
                : 'Metadata filters use the reporting snapshot. Current age and review counts require Backlog at cutoff.'}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const parsed = repositoryPageFiltersSchema.safeParse(draft);
              if (!parsed.success) {
                setError(repositoryFilterErrorMessage(parsed.error, fields));
                return;
              }
              const message = onChange(parsed.data);
              setError(message ?? '');
              if (!message) setOpen(false);
            }}
          >
            <div className={styles.fieldGrid}>
              <label className={styles.selectField}>
                Title or number
                <Input
                  aria-label="Timeline title or number"
                  value={draft.search}
                  maxLength={200}
                  onChange={(e) => setDraft({ ...draft, search: e.target.value })}
                />
              </label>
              {fields.map((field) => {
                const value = draft[field.key];
                return field.multiple ? (
                  <FilterChoices
                    key={field.key}
                    label={field.label}
                    options={field.options}
                    selected={Array.isArray(value) ? value : []}
                    onChange={(next) => setDraft({ ...draft, [field.key]: next })}
                  />
                ) : (
                  <label key={field.key} className={styles.selectField}>
                    {field.label}
                    <select
                      value={
                        typeof value === 'string' || typeof value === 'number' ? String(value) : ''
                      }
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          [field.key]:
                            e.target.value === ''
                              ? undefined
                              : field.key === 'ageBand'
                                ? Number(e.target.value)
                                : e.target.value,
                        })
                      }
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
            {error && <p role="alert">{error}</p>}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDraft(defaultRepositoryFilters(filters.kind))}
              >
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
        </DialogContent>
      </Dialog>
      {(chips.length > 0 || filters.search) && (
        <div className={styles.chips} aria-label="Active timeline filters">
          {chips.map((chip) => (
            <button
              key={chip.key + chip.value}
              type="button"
              onClick={() => onChange(removeRepositoryFilter(filters, chip.key, chip.value))}
              aria-label={'Remove ' + chip.label}
            >
              {chip.label} ×
            </button>
          ))}
          {filters.search && (
            <button
              type="button"
              onClick={() => onChange({ ...filters, search: '' })}
              aria-label="Remove title or number filter"
            >
              Title or number: {filters.search} ×
            </button>
          )}
        </div>
      )}
    </div>
  );
}
