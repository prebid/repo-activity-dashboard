'use client';
import { useEffect, useMemo, useState } from 'react';
import { useClientReady } from '@/lib/navigation/use-client-ready';
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
} from '@/components/ui/dialog';
import { type RepositoryPageFilters, type RepositoryPageSource } from '@/models/repository-page';
import type { TableController } from '@/lib/presentation/table-controller';
import { periodRangeLabel } from '@/lib/presentation/overview-periods';
import { recordListTitle } from '@/lib/presentation/repository-records';
import { defaultRepositoryFilters } from '@/lib/presentation/repository-page-query';
import {
  repositoryFilterFields,
  repositoryFilterChips,
  removeRepositoryFilter,
  type RepositoryFilterDraft,
} from './repository-filter-fields';
import { RepositoryFilterForm } from './repository-filter-form';
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
  const interactive = useClientReady();
  const [container, setContainer] = useState<HTMLFieldSetElement | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<RepositoryFilterDraft>({ ...filters });
  const fields = useMemo(() => repositoryFilterFields(source), [source]);
  const chips = repositoryFilterChips(filters, fields);
  const defaults = defaultRepositoryFilters(source.kind);
  // Search may settle as the dialog opens. Close only for changed facets/cohorts.
  // Commit on activation, not blur: page shrink during mouse-down can move the trigger.
  const filterScope = JSON.stringify([
    source.repository.id,
    source.asOf,
    source.drilldown,
    source.author?.account,
    { ...filters, search: undefined },
  ]);
  useEffect(() => setOpen(false), [filterScope]);

  return (
    <fieldset
      ref={setContainer}
      className={styles.filters}
      disabled={!interactive}
      aria-label="Repository record filters"
    >
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
              const captured = table.flushSearch();
              setDraft({ ...filters, search: captured.search });
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
            <RepositoryFilterForm
              fields={fields}
              draft={draft}
              setDraft={setDraft}
              defaults={defaults}
              onApply={(next) => {
                onChange(next);
                setOpen(false);
                return undefined;
              }}
              help={
                source.kind === 'prs' &&
                source.drilldown.selection.scope === 'current' && (
                  <p className={styles.help}>
                    Reviewer, approval, agent/bot coverage, and current latest-activity filters
                    exclude drafts. Human reviewers and current approvals are independent.
                  </p>
                )
              }
            />
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
              onClick={() => onChange(removeRepositoryFilter(filters, chip.key, chip.value))}
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
    </fieldset>
  );
}
