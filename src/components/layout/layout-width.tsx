'use client';
import { createContext, useContext } from 'react';
import { FoldHorizontal, UnfoldHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { layoutWidthCookieString, type LayoutWidth } from '@/lib/presentation/layout-width';
import { cn } from '@/lib/utils';
import frameStyles from './dashboard.module.css';
import styles from './theme-menu.module.css';

export const LayoutWidthContext = createContext<{
  width: LayoutWidth;
  setWidth: (width: LayoutWidth) => void;
} | null>(null);

function saveLayoutWidth(width: LayoutWidth) {
  // A cookie lets the server render the saved width without a layout shift.
  document.cookie = layoutWidthCookieString(width, location.protocol === 'https:');
}

export function LayoutWidthToggle() {
  const layout = useContext(LayoutWidthContext);
  if (!layout) throw new Error('LayoutWidthToggle requires the dashboard frame');
  const wide = layout.width === 'wide';
  const Icon = wide ? UnfoldHorizontal : FoldHorizontal;
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(styles.trigger, frameStyles.widthToggle)}
      aria-label="Full-width layout"
      aria-pressed={wide}
      title={wide ? 'Switch to contained width' : 'Switch to full width'}
      onClick={() => {
        const next = wide ? 'contained' : 'wide';
        saveLayoutWidth(next);
        layout.setWidth(next);
      }}
    >
      <Icon aria-hidden="true" />
    </Button>
  );
}
