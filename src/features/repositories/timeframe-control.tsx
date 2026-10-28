'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  periodPresets,
  periodSelectionSchema,
  type PeriodSelection,
  type ResolvedPeriod,
} from '@/models/reporting-period';
import { resolveReportingPeriod } from '@/lib/presentation/reporting-period';
import styles from './overview-controls.module.css';

export const periodLabels = {
  'this-week': 'This week',
  'last-week': 'Last week',
  'this-month': 'This month',
  'last-month': 'Last month',
  'this-year': 'This year to date',
  'last-year-to-date': 'Last year to the same date',
  'last-full-year': 'Last full year',
};

export function TimeframeControl({
  period,
  asOf,
  onChange,
}: {
  period: ResolvedPeriod;
  asOf: string;
  onChange: (selection: PeriodSelection) => void;
}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const select = useRef<HTMLSelectElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState('');
  const [through, setThrough] = useState('');
  const [error, setError] = useState('');
  const periodKey = JSON.stringify(period.selection);
  const previousPeriod = useRef(periodKey);
  useEffect(() => {
    if (previousPeriod.current !== periodKey) {
      setOpen(false);
      previousPeriod.current = periodKey;
    }
  }, [periodKey]);
  function editDates(trigger: HTMLElement) {
    setFrom(
      period.selection.kind === 'custom' ? period.selection.from : period.range.start.slice(0, 10),
    );
    setThrough(
      period.selection.kind === 'custom'
        ? period.selection.through
        : new Date(new Date(period.range.end).getTime() - Number(!period.range.endInclusive))
            .toISOString()
            .slice(0, 10),
    );
    setError('');
    returnFocus.current = trigger;
    setOpen(true);
  }
  return (
    <div ref={setContainer} className={styles.timeframe}>
      <label className={styles.selectLabel}>
        <span className="sr-only">Activity timeframe</span>
        <select
          ref={select}
          className={styles.select}
          value={period.selection.kind === 'preset' ? period.selection.preset : 'custom'}
          onChange={(event) => {
            if (event.target.value === 'custom') editDates(event.currentTarget);
            else
              onChange(periodSelectionSchema.parse({ kind: 'preset', preset: event.target.value }));
          }}
        >
          {periodPresets.map((preset) => (
            <option key={preset} value={preset}>
              {periodLabels[preset]}
            </option>
          ))}
          <option value="custom">Custom range</option>
        </select>
      </label>
      {period.selection.kind === 'custom' && (
        <Button
          variant="outline"
          className={styles.control}
          onClick={(event) => editDates(event.currentTarget)}
        >
          Edit dates
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          container={container}
          className={styles.dialog}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            (returnFocus.current?.isConnected ? returnFocus.current : select.current)?.focus();
          }}
        >
          <DialogHeader className="text-left">
            <DialogTitle>Custom date range</DialogTitle>
            <DialogDescription>
              Choose inclusive UTC dates. Activity stops at the reporting snapshot.
            </DialogDescription>
          </DialogHeader>
          <form
            className={styles.dateForm}
            onSubmit={(event) => {
              event.preventDefault();
              const parsed = periodSelectionSchema.safeParse({ kind: 'custom', from, through });
              if (!parsed.success) {
                setError('Enter valid dates with the start on or before the end.');
                return;
              }
              try {
                resolveReportingPeriod(parsed.data, asOf);
              } catch {
                setError('The start date must not be after the reporting snapshot.');
                return;
              }
              onChange(parsed.data);
              setOpen(false);
            }}
          >
            <label className={styles.dateField}>
              Start date
              <Input
                type="date"
                required
                max={asOf.slice(0, 10)}
                value={from}
                onChange={(event) => {
                  setFrom(event.target.value);
                  setError('');
                }}
              />
            </label>
            <label className={styles.dateField}>
              End date
              <Input
                type="date"
                required
                value={through}
                onChange={(event) => {
                  setThrough(event.target.value);
                  setError('');
                }}
              />
            </label>
            <p className={styles.help}>
              Ranges without prepared sample values will display dashes.
            </p>
            {error && (
              <p role="alert" className={styles.error}>
                {error}
              </p>
            )}
            <DialogFooter className="gap-2 sm:space-x-0">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" className={styles.apply}>
                Apply dates
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
