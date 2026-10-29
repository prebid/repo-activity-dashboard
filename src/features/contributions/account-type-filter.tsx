'use client';
import { useEffect, useState } from 'react';
import { Users, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { contributionActorTypes, type ContributionAccount } from '@/models/contributions';
import { actorLabels } from './contribution-columns';
import styles from './contributions.module.css';
type ActorType = ContributionAccount['actorType'];
export function AccountTypeFilter({
  selected,
  onApply,
  pending = false,
}: {
  selected: ActorType[];
  onApply: (types: ActorType[]) => void;
  pending?: boolean;
}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState(selected);
  const selectionKey = JSON.stringify(selected);
  useEffect(() => setOpen(false), [selectionKey]);
  const summary =
    selected.length === 4
      ? 'All'
      : selected.length === 1
        ? actorLabels[selected[0]]
        : selected.length
          ? selected.length + ' types'
          : 'None';
  return (
    <div ref={setContainer}>
      <DropdownMenu
        open={open}
        onOpenChange={(next) => {
          if (next) setDraft([...selected]);
          setOpen(next);
        }}
        modal={false}
      >
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" className={styles.typeFilter} disabled={pending}>
            <Users size={14} aria-hidden="true" />
            Account type: {summary}
            <ChevronDown size={13} aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent container={container} align="end" className={styles.typeMenu}>
          <DropdownMenuLabel>Include account types</DropdownMenuLabel>
          {contributionActorTypes.map((type) => (
            <DropdownMenuCheckboxItem
              key={type}
              checked={draft.includes(type)}
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={(checked) =>
                setDraft((previous) =>
                  checked
                    ? [...new Set([...previous, type])]
                    : previous.filter((value) => value !== type),
                )
              }
            >
              {actorLabels[type]}
            </DropdownMenuCheckboxItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              setDraft([...contributionActorTypes]);
            }}
          >
            Select all
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              setDraft([]);
            }}
          >
            Clear selection
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => onApply(contributionActorTypes.filter((type) => draft.includes(type)))}
          >
            Apply account types
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
