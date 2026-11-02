import { SortAscendingIcon, SortDescendingIcon, SortIdleIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import styles from './sort-icon.module.css';

/** A column header's sort state, as its `aria-sort` states it. */
export type SortDirection = 'none' | 'ascending' | 'descending';

/**
 * The sort glyph in a fixed 14px slot, so a header's label keeps its place in every state. It is
 * decorative: the header's `aria-sort` carries the state and the button's name is the label alone.
 */
export function SortIcon({ direction }: { direction: SortDirection }) {
  const Glyph =
    direction === 'ascending'
      ? SortAscendingIcon
      : direction === 'descending'
        ? SortDescendingIcon
        : SortIdleIcon;
  return (
    <span className={cn(styles.slot, direction !== 'none' && styles.sorted)}>
      <Glyph size={12} />
    </span>
  );
}
