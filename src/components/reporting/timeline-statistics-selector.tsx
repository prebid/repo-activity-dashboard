'use client';
import { useEffect, useState } from 'react';
import { Columns3, ChevronDown } from 'lucide-react';
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
import { ScrollableDialogContent, ScrollableDialogBody } from '@/components/ui/scrollable-dialog';
import { ColumnSelection } from '@/components/tables/column-selection';
import type { TimelineMetricDefinition } from '@/models/timeline-presentation';
import {
  repositoryTimelineMetricScope,
  repositoryTimelineMetricSchema,
} from '@/models/repository-timeline';
export function TimelineStatisticsSelector({
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
  const choices = metrics.map((metric) => ({
    ...metric,
    selectionGroup:
      (repositoryTimelineMetricScope(repositoryTimelineMetricSchema.parse(metric.id)).family ===
      'activity'
        ? 'Period activity'
        : 'Backlog at cutoff') +
      ' · ' +
      metric.group,
    selectionSection: undefined,
  }));
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
          <Button variant="outline">
            <Columns3 size={14} aria-hidden="true" />
            Metrics · {selected.length}
            <ChevronDown size={14} aria-hidden="true" />
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
              columns={choices}
              selectedIds={draft}
              onChange={setDraft}
              mode="form"
              allowEmpty
            />
          </ScrollableDialogBody>
          {error && (
            <p role="alert" className="text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraft([])}>
              Clear selection
            </Button>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
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
