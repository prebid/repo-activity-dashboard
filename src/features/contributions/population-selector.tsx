'use client';
import { ScrollableDialogContent, ScrollableDialogBody } from '@/components/ui/scrollable-dialog';
import { useEffect, useState } from 'react';
import { Users, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import type { ContributionOptions } from '@/models/contribution-options';
import { ContributionChoices } from './contribution-choices';
import type { ContributionSelection } from '@/models/contributions';
import styles from './contribution-controls.module.css';

type Population = Pick<ContributionSelection, 'population' | 'excludedAccountIds'>;
export function PopulationSelector({
  options,
  selected,
  onApply,
}: {
  options: ContributionOptions;
  selected: Population;
  onApply: (value: Population) => void;
}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState(selected);
  const key = JSON.stringify(selected);
  useEffect(() => setOpen(false), [key]);
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
        <ScrollableDialogContent container={container}>
          <DialogHeader className="text-left">
            <DialogTitle>Include and exclude accounts</DialogTitle>
            <DialogDescription>
              Combine individuals and current company members. Exclusions always win; company
              mappings stay unchanged.
            </DialogDescription>
          </DialogHeader>
          {open && (
            <ScrollableDialogBody label="Account choices">
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
                  <ContributionChoices
                    label="Companies"
                    kind="companies"
                    options={options}
                    selected={population.companyIds.map((id) => id ?? '')}
                    onChange={(ids) =>
                      setDraft({
                        ...draft,
                        population: { ...population, companyIds: ids.map((id) => id || null) },
                      })
                    }
                  />
                  <ContributionChoices
                    label="Individuals"
                    kind="accounts"
                    options={options}
                    selected={population.accountIds}
                    onChange={(ids) =>
                      setDraft({ ...draft, population: { ...population, accountIds: ids } })
                    }
                  />
                </>
              )}
              <ContributionChoices
                label="Exclusions"
                kind="accounts"
                options={options}
                selected={draft.excludedAccountIds}
                onChange={(ids) => setDraft({ ...draft, excludedAccountIds: ids })}
              />
            </ScrollableDialogBody>
          )}
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
        </ScrollableDialogContent>
      </Dialog>
    </div>
  );
}
