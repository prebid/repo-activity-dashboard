'use client';
import { useEffect, useMemo, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
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
  type RepositoryPageSource,
} from '@/models/repository-page';
import type { TableController } from '@/lib/presentation/table-controller';
import { periodRangeLabel } from '@/lib/presentation/overview-periods';
import { recordListTitle } from '@/lib/presentation/repository-records';
import { defaultRepositoryFilters } from '@/lib/presentation/repository-page-query';
import { repositoryFilterFields, repositoryFilterChips } from './repository-filter-fields';
import styles from './repository-controls.module.css';

export function RepositoryFilterControls({
  source,
  filters,
  table,
  onChange,
  onClear,
}: {
  source: RepositoryPageSource;
  filters: RepositoryPageFilters;
  table: TableController;
  onChange: (filters: RepositoryPageFilters) => void;
  onClear: () => void;
}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false),
    [error, setError] = useState('');
  const [draft, setDraft] = useState<Record<string, unknown>>({ ...filters });
  const fields = useMemo(() => repositoryFilterFields(source), [source]);
  const chips = repositoryFilterChips(filters, fields);
  const defaults = defaultRepositoryFilters(source.kind);
  // Search is owned by the table controller and may settle during the trigger's blur.
  // Close a draft for changed facets/cohorts, not for that pending search commit.
  const filterScope = JSON.stringify([
    source.repository.id,
    source.asOf,
    source.drilldown,
    source.author?.account,
    { ...filters, search: undefined },
  ]);
  useEffect(() => setOpen(false), [filterScope]);
  function remove(key: string, value: string) {
    const next: Record<string, unknown> = { ...filters };
    next[key] = Array.isArray(next[key])
      ? (next[key] as string[]).filter((item) => item !== value)
      : (defaults as unknown as Record<string, unknown>)[key];
    onChange(repositoryPageFiltersSchema.parse(next));
  }
  return (
    <div ref={setContainer} className={styles.filters}>
      <div className={styles.filterActions}>
        <Input
          aria-label={
            'Search ' + recordListTitle(source.drilldown.selection, source.author?.account)
          }
          placeholder="Find a title or number…"
          className={styles.search}
          value={table.draftSearch}
          maxLength={200}
          onChange={(event) => table.setSearch(event.target.value)}
          onBlur={() => table.flushSearch()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              table.flushSearch();
            }
          }}
        />
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
              <SlidersHorizontal size={14} aria-hidden="true" />
              Filters{chips.length ? ' (' + chips.length + ')' : ''}
            </Button>
          </DialogTrigger>
          <DialogContent container={container} className={styles.dialog}>
            <DialogHeader className="text-left">
              <DialogTitle>Filter {source.kind === 'prs' ? 'pull requests' : 'issues'}</DialogTitle>
              <DialogDescription>
                Narrow the selected repository scope. Values within one field match any selection;
                different fields combine.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const parsed = repositoryPageFiltersSchema.safeParse(draft);
                if (!parsed.success) {
                  setError(
                    'Too many selections. Choose at most 100 authors or assignees and 50 labels or branches.',
                  );
                  return;
                }
                onChange(parsed.data);
                setOpen(false);
              }}
            >
              <div className={styles.fieldGrid}>
                {fields.map((field) =>
                  field.multiple ? (
                    <FilterChoices
                      key={field.key}
                      label={field.label}
                      options={field.options}
                      selected={
                        Array.isArray(draft[field.key]) ? (draft[field.key] as string[]) : []
                      }
                      onChange={(value) =>
                        setDraft((previous) => ({ ...previous, [field.key]: value }))
                      }
                    />
                  ) : (
                    <label key={field.key} className={styles.selectField}>
                      {field.label}
                      <select
                        value={
                          typeof draft[field.key] === 'string' ||
                          typeof draft[field.key] === 'number'
                            ? String(draft[field.key])
                            : ''
                        }
                        onChange={(event) => {
                          const value = event.target.value;
                          setDraft((previous) => ({
                            ...previous,
                            [field.key]:
                              value === ''
                                ? undefined
                                : field.key === 'ageBand'
                                  ? Number(value)
                                  : value,
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
                  ),
                )}
              </div>
              {source.kind === 'prs' && source.drilldown.selection.scope === 'current' && (
                <p className={styles.help}>
                  Reviewer, approval, agent/bot coverage, and current latest-activity filters
                  exclude drafts. Human reviewers and current approvals are independent.
                </p>
              )}
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
          </DialogContent>
        </Dialog>
        {(chips.length > 0 || filters.search || filters.eventRange) && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear filters
          </Button>
        )}
      </div>
      {(chips.length > 0 || filters.eventRange) && (
        <div className={styles.chips} aria-label="Active filters">
          {chips.map((chip) => (
            <button
              type="button"
              key={chip.key + ':' + chip.value}
              onClick={() => remove(chip.key, chip.value)}
              aria-label={'Remove ' + chip.label}
            >
              {chip.label}
              <X size={12} aria-hidden="true" />
            </button>
          ))}
          {filters.eventRange && (
            <button type="button" onClick={() => onChange({ ...filters, eventRange: undefined })}>
              Activity dates: {periodRangeLabel(filters.eventRange)} · UTC
              <X size={12} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
