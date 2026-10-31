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
} from '@/components/ui/dialog';
import { type RepositoryPageFilters, type RepositoryFilterOptions } from '@/models/repository-page';
import {
  repositoryFilterFieldsFromOptions,
  repositoryFilterChips,
  removeRepositoryFilter,
  type RepositoryFilterDraft,
} from './repository-filter-fields';
import { defaultRepositoryFilters } from '@/lib/presentation/repository-page-query';
import { RepositoryFilterForm } from './repository-filter-form';
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
    [draft, setDraft] = useState<RepositoryFilterDraft>({ ...filters });
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
          <RepositoryFilterForm
            fields={fields}
            draft={draft}
            setDraft={setDraft}
            defaults={defaultRepositoryFilters(filters.kind)}
            onApply={(next) => {
              const message = onChange(next);
              if (!message) setOpen(false);
              return message ?? undefined;
            }}
            leading={
              <label className={styles.selectField}>
                Title or number
                <Input
                  aria-label="Timeline title or number"
                  value={draft.search}
                  maxLength={200}
                  onChange={(e) => setDraft({ ...draft, search: e.target.value })}
                />
              </label>
            }
          />
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
