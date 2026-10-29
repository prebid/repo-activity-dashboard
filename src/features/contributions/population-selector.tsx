'use client';
import { tablePageSize } from '@/lib/presentation/table-query';
import { useEffect, useState } from 'react';
import { Users, ChevronDown } from 'lucide-react';
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
import type { ContributionDirectory } from '@/models/contribution-settings';
import type { ContributionSelection } from '@/models/contributions';
import styles from './contribution-controls.module.css';

type Population = Pick<ContributionSelection, 'population' | 'excludedAccountIds'>;
type Choice = { value: string; label: string };
/** Bounded picker pages keep high-volume account directories usable without altering selections. */
function Choices({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: Choice[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState(''),
    [page, setPage] = useState(0),
    [onlySelected, setOnlySelected] = useState(false);
  const matching = options.filter(
    (option) =>
      option.label.toLowerCase().includes(search.toLowerCase()) &&
      (!onlySelected || selected.includes(option.value)),
  );
  const effectivePage = Math.min(page, Math.max(0, Math.ceil(matching.length / tablePageSize) - 1));
  return (
    <fieldset className={styles.choices}>
      <legend>
        {label} <span>({selected.length} selected)</span>
      </legend>
      <Input
        aria-label={'Find ' + label.toLowerCase()}
        placeholder="Find…"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(0);
        }}
      />
      <div className={styles.actions}>
        <label>
          <input
            type="checkbox"
            checked={onlySelected}
            onChange={(event) => {
              setOnlySelected(event.target.checked);
              setPage(0);
            }}
          />{' '}
          Show selected only
        </label>
        <Button size="sm" variant="ghost" onClick={() => onChange([])}>
          Clear {label.toLowerCase()}
        </Button>
      </div>
      <div className={styles.options}>
        {matching
          .slice(effectivePage * tablePageSize, (effectivePage + 1) * tablePageSize)
          .map((option) => (
            <label key={option.value}>
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...selected, option.value]
                      : selected.filter((id) => id !== option.value),
                  )
                }
              />
              <span>{option.label}</span>
            </label>
          ))}
        {!matching.length && <p>No matching choices</p>}
      </div>
      {matching.length > tablePageSize && (
        <nav className={styles.actions} aria-label={label + ' choices pages'}>
          <Button
            size="sm"
            variant="outline"
            disabled={!effectivePage}
            onClick={() => setPage(effectivePage - 1)}
          >
            Previous
          </Button>
          <span>
            Page {effectivePage + 1} of {Math.ceil(matching.length / tablePageSize)}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={(effectivePage + 1) * tablePageSize >= matching.length}
            onClick={() => setPage(effectivePage + 1)}
          >
            Next
          </Button>
        </nav>
      )}
    </fieldset>
  );
}
export function PopulationSelector({
  directory,
  selected,
  onApply,
}: {
  directory: ContributionDirectory;
  selected: Population;
  onApply: (value: Population) => void;
}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState(selected);
  const key = JSON.stringify(selected);
  useEffect(() => setOpen(false), [key]);
  const accounts = directory.accounts.map((account) => ({
    value: account.id,
    label: account.name + ' (@' + account.login + ')',
  }));
  const population = draft.population;
  return (
    <div ref={setContainer}>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) setDraft(selected);
          setOpen(next);
        }}
      >
        <DialogTrigger asChild>
          <Button variant="outline" className={styles.control}>
            <Users size={14} aria-hidden="true" />
            {selected.population.kind === 'all' ? 'All accounts' : 'Selected accounts'}
            {selected.excludedAccountIds.length > 0
              ? ' · ' + selected.excludedAccountIds.length + ' excluded'
              : ''}
            <ChevronDown size={13} aria-hidden="true" />
          </Button>
        </DialogTrigger>
        <DialogContent container={container} className={styles.dialog}>
          <DialogHeader className="text-left">
            <DialogTitle>Include and exclude accounts</DialogTitle>
            <DialogDescription>
              Combine individuals and current company members. Exclusions always win; company
              mappings stay unchanged.
            </DialogDescription>
          </DialogHeader>
          <div className={styles.body} role="region" aria-label="Account choices" tabIndex={0}>
            <fieldset className={styles.mode}>
              <legend>Population</legend>
              {(['all', 'selected'] as const).map((kind) => (
                <label key={kind}>
                  <input
                    type="radio"
                    name="population"
                    value={kind}
                    checked={population.kind === kind}
                    onChange={() =>
                      setDraft({
                        ...draft,
                        population:
                          kind === 'all' ? { kind } : { kind, accountIds: [], companyIds: [] },
                      })
                    }
                  />
                  {kind === 'all' ? 'All accounts' : 'Selected accounts'}
                </label>
              ))}
            </fieldset>
            {population.kind === 'selected' && (
              <>
                <p className={styles.note}>
                  Select individuals, companies or both. An empty selection shows no accounts.
                </p>
                <Choices
                  label="Companies"
                  options={[
                    ...directory.companies.map((company) => ({
                      value: company.id,
                      label: company.name,
                    })),
                    { value: '', label: 'Unmapped company' },
                  ]}
                  selected={population.companyIds.map((id) => id ?? '')}
                  onChange={(ids) =>
                    setDraft({
                      ...draft,
                      population: { ...population, companyIds: ids.map((id) => id || null) },
                    })
                  }
                />
                <Choices
                  label="Individuals"
                  options={accounts}
                  selected={population.accountIds}
                  onChange={(ids) =>
                    setDraft({ ...draft, population: { ...population, accountIds: ids } })
                  }
                />
              </>
            )}
            <Choices
              label="Exclusions"
              options={accounts}
              selected={draft.excludedAccountIds}
              onChange={(ids) => setDraft({ ...draft, excludedAccountIds: ids })}
            />
          </div>
          <DialogFooter className="gap-2 sm:space-x-0">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={() => {
                onApply(draft);
                setOpen(false);
              }}
            >
              Apply accounts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
