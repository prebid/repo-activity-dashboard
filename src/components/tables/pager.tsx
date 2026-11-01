import { Button } from '@/components/ui/button';
import { NextIcon, PreviousIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

export interface PagerLabels {
  previous: string;
  next: string;
  /** The position text, "Page 2 of 5" by default. */
  position: (page: number, pageCount: number) => string;
}

export interface PagerProps {
  /** 1-based. */
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** The navigation landmark's name, such as "Repositories pages". */
  label: string;
  /** md in page toolbars and table footers, sm inside dialogs. */
  size?: 'sm' | 'md';
  /** Disables both buttons, for example before hydration or while a page loads. */
  disabled?: boolean;
  labels?: Partial<PagerLabels>;
}

const defaults: PagerLabels = {
  previous: 'Previous',
  next: 'Next',
  position: (page, pageCount) => `Page ${page} of ${pageCount}`,
};

/** Previous and Next around the position text; renders nothing when there is one page. */
export function Pager({
  page,
  pageCount,
  onPageChange,
  label,
  size = 'md',
  disabled = false,
  labels,
}: PagerProps) {
  if (pageCount <= 1) return null;
  const text = { ...defaults, ...labels };
  return (
    <nav aria-label={label} className="flex items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        size={size}
        disabled={disabled || page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <PreviousIcon size={14} />
        {text.previous}
      </Button>
      <span
        aria-live="polite"
        className={cn(
          size === 'sm' ? 'text-small' : 'text-body',
          'text-muted-foreground tabular-nums lining-nums',
        )}
      >
        {text.position(page, pageCount)}
      </span>
      <Button
        type="button"
        variant="secondary"
        size={size}
        disabled={disabled || page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        {text.next}
        <NextIcon size={14} />
      </Button>
    </nav>
  );
}
