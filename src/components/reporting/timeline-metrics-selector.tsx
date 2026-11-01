'use client';
import { useEffect, useState } from 'react';
import { ExpandIcon, MetricsIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/feedback/callout';
import {
  Dialog,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { ScrollableDialogContent, ScrollableDialogBody } from '@/components/ui/scrollable-dialog';
import { ColumnSelection } from '@/components/tables/column-selection';
import type { TimelineMetricDefinition } from '@/models/timeline-presentation';
/** Choices are grouped by each definition's selectionGroup; callers own any family prefix. */
export function TimelineMetricsSelector({
  metrics,
  selected,
  contextKey,
  onApply,
}: {
  metrics: TimelineMetricDefinition[];
  selected: readonly string[];
  contextKey: string;
  onApply: (ids: string[]) => unknown;
}) {
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState<string[]>([]),
    [error, setError] = useState(''),
    [container, setContainer] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    setOpen(false);
    setError('');
  }, [contextKey]);
  return (
    <div ref={setContainer}>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) {
            setDraft([...selected]);
            setError('');
          }
          setOpen(next);
        }}
      >
        <DialogTrigger asChild>
          <Button variant="secondary">
            <MetricsIcon size={14} />
            Metrics · {selected.length}
            <ExpandIcon size={14} />
          </Button>
        </DialogTrigger>
        <ScrollableDialogContent container={container}>
          <DialogHeader>
            <DialogTitle>Choose metrics</DialogTitle>
            <DialogDescription>
              Each repository groups the selected metrics as rows. Periods stay in columns; counts
              and duration units remain separate.
            </DialogDescription>
          </DialogHeader>
          <ScrollableDialogBody label="Timeline metrics">
            <ColumnSelection
              columns={metrics}
              selectedIds={draft}
              onChange={setDraft}
              mode="form"
              allowEmpty
            />
          </ScrollableDialogBody>
          {error && (
            <Callout tone="error" as="p" role="alert">
              {error}
            </Callout>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraft([])}>
              Clear selection
            </Button>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button
              variant="primary"
              onClick={() => {
                const result = onApply(draft);
                if (typeof result === 'string') {
                  setError(result);
                  return;
                }
                setOpen(false);
              }}
            >
              Apply metrics
            </Button>
          </DialogFooter>
        </ScrollableDialogContent>
      </Dialog>
    </div>
  );
}
