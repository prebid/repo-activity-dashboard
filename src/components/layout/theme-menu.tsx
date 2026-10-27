"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import styles from "./theme-menu.module.css";

const choices = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

export function ThemeMenu({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // Keep the popup within its owning landmark for assistive navigation.
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  // The server cannot read this browser's saved preference. Keep its first render stable.
  useEffect(() => setMounted(true), []);
  const selected = mounted ? theme : undefined;
  const Icon =
    choices.find((choice) => choice.value === selected)?.icon ?? Monitor;

  return (
    <div ref={setContainer} className={styles.frame}>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(styles.trigger, className)}
            aria-label="Theme settings"
            title="Theme settings"
            disabled={!mounted}
          >
            <Icon aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          container={container}
          className={styles.content}
        >
          <DropdownMenuLabel className={styles.label}>
            Appearance
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup value={selected} onValueChange={setTheme}>
            {choices.map(({ value, label, icon: OptionIcon }) => (
              <DropdownMenuRadioItem
                key={value}
                value={value}
                className={styles.option}
              >
                <OptionIcon size={16} aria-hidden="true" />
                {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
