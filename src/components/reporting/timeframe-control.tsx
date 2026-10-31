'use client';
import { useClientReady } from '@/lib/navigation/use-client-ready';
import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';
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
import { periodLabels } from '@/lib/presentation/overview-periods';
import styles from './overview-controls.module.css';
import { customPeriodForRange } from '@/lib/presentation/reporting-period';

export function TimeframeControl({
  period,
  other,
  label,
  asOf,
  onChange,
}: {
  period?: ResolvedPeriod;
  other?: PeriodSelection;
  label: string;
  asOf: string;
  onChange: (selection: PeriodSelection) => string | undefined;
}) {
  const ready = useClientReady();
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const select = useRef<HTMLSelectElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState('');
  const [through, setThrough] = useState('');
  const [error, setError] = useState('');
  const periodKey = JSON.stringify(period?.selection ?? null);
  const previousPeriod = useRef(periodKey);
  useEffect(() => {
    if (previousPeriod.current !== periodKey) {
      setOpen(false);
      setError('');
      previousPeriod.current = periodKey;
    }
  }, [periodKey]);
  function editDates(trigger: HTMLElement) {
    setFrom(
      period?.selection.kind === 'custom'
        ? period.selection.from
        : (period?.range.start.slice(0, 10) ?? ''),
    );
    setThrough(
      period
        ? period.selection.kind === 'custom'
          ? period.selection.through
          : customPeriodForRange(period.range).through
        : '',
    );
    setError('');
    returnFocus.current = trigger;
    setOpen(true);
  }
  const custom = period?.selection.kind === 'custom';
  return (
    <div ref={setContainer}>
      <div className={styles.timeframe}>
        <label className={styles.selectLabel}>
          <span className="sr-only">{label} preset</span>
          <select
            ref={select}
            disabled={!ready}
            className={styles.select}
            value={period?.selection.kind === 'preset' ? period.selection.preset : ''}
            onChange={(event) =>
              setError(
                onChange(
                  periodSelectionSchema.parse({ kind: 'preset', preset: event.target.value }),
                ) ?? '',
              )
            }
          >
            <option value="" disabled>
              {custom ? 'Switch to preset…' : 'Choose preset'}
            </option>
            {periodPresets.map((preset) => (
              <option
                key={preset}
                value={preset}
                disabled={other?.kind === 'preset' && other.preset === preset}
              >
                {periodLabels[preset]}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className={styles.selectChevron} aria-hidden="true" />
        </label>
        <Button
          variant="outline"
          disabled={!ready}
          className={styles.control}
          aria-label={(custom ? 'Edit custom range for ' : 'Custom range for ') + label}
          onClick={(event) => editDates(event.currentTarget)}
        >
          <CalendarDays size={14} aria-hidden="true" />
          {custom ? 'Edit custom range' : 'Custom range'}
        </Button>
      </div>
      {error && !open && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setError('');
        }}
      >
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
              {label} · Choose inclusive UTC dates. Activity stops at the reporting snapshot.
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
              const message = onChange(parsed.data);
              setError(message ?? '');
              if (!message) setOpen(false);
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
