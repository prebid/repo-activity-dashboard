'use client';

import { useState } from 'react';
import { useClientReady } from '@/lib/navigation/use-client-ready';
import { ThemeDarkIcon, ThemeLightIcon, ThemeSystemIcon } from '@/components/ui/icons';
import { useTheme } from '@/components/providers/theme-provider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import styles from './theme-menu.module.css';

const choices = [
  { value: 'system', label: 'System', icon: ThemeSystemIcon },
  { value: 'light', label: 'Light', icon: ThemeLightIcon },
  { value: 'dark', label: 'Dark', icon: ThemeDarkIcon },
] as const;

/**
 * The theme choice behind a 36px icon button. `tone` is the surface it sits on: the page canvas,
 * as on the sign-in pages, or the navy masthead. `className` places the control's wrapper.
 */
export function ThemeMenu({
  className,
  tone = 'page',
}: {
  className?: string;
  tone?: 'page' | 'masthead';
}) {
  const { theme, setTheme } = useTheme();
  const mounted = useClientReady();
  // Keep the popup within its owning landmark for assistive navigation.
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  // The server cannot read this browser's saved preference. Keep its first render stable.
  const selected = mounted ? theme : undefined;
  const Icon = choices.find((choice) => choice.value === selected)?.icon ?? ThemeSystemIcon;

  return (
    <div ref={setContainer} className={cn(styles.frame, className)}>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant={tone === 'masthead' ? 'masthead' : 'secondary'}
            size="icon-lg"
            aria-label="Theme settings"
            title="Theme settings"
            disabled={!mounted}
          >
            <Icon size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" container={container}>
          <DropdownMenuLabel>Appearance</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={selected} onValueChange={setTheme}>
            {choices.map(({ value, label, icon: OptionIcon }) => (
              <DropdownMenuRadioItem key={value} value={value}>
                <OptionIcon size={16} />
                {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
