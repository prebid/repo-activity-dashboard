'use client';
import { FieldError } from '@/components/feedback/field-error';
import { accountTypeLabels } from '@/models/github-account';
import { useEffect, useId, useState } from 'react';
import { Users, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { contributionActorTypes, type ContributionAccount } from '@/models/contributions';

import styles from './contributions.module.css';
type ActorType = ContributionAccount['actorType'];
export function AccountTypeFilter({
  selected,
  onApply,
  pending = false,
}: {
  selected: ActorType[];
  onApply: (types: ActorType[]) => string | void;
  pending?: boolean;
}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState(selected);
  const [error, setError] = useState('');
  const errorId = useId();
  const selectionKey = JSON.stringify(selected);
  useEffect(() => setOpen(false), [selectionKey]);
  const summary =
    selected.length === contributionActorTypes.length
      ? 'All'
      : selected.length === 1
        ? accountTypeLabels[selected[0]]
        : selected.length
          ? selected.length + ' types'
          : 'None';
  const changeDraft: typeof setDraft = (next) => {
    setError('');
    setDraft(next);
  };
  return (
    <div ref={setContainer}>
      <DropdownMenu
        open={open}
        onOpenChange={(next) => {
          if (next) {
            changeDraft([...selected]);
          }
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
          <DropdownMenuGroup className={styles.typeChoices}>
            {contributionActorTypes.map((type) => (
              <DropdownMenuCheckboxItem
                key={type}
                checked={draft.includes(type)}
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={(checked) =>
                  changeDraft((previous) =>
                    checked
                      ? [...new Set([...previous, type])]
                      : previous.filter((value) => value !== type),
                  )
                }
              >
                {accountTypeLabels[type]}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                changeDraft([...contributionActorTypes]);
              }}
            >
              Select all
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                changeDraft([]);
              }}
            >
              Clear selection
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          {error && (
            <DropdownMenuLabel
              aria-hidden="true"
              className="font-normal text-[13px] text-[var(--prebid-error-ink)]"
            >
              {error}
            </DropdownMenuLabel>
          )}
          <DropdownMenuItem
            aria-describedby={error ? errorId : undefined}
            onSelect={(event) => {
              event.preventDefault();
              const message = onApply(
                contributionActorTypes.filter((type) => draft.includes(type)),
              );
              setError(message || '');
              if (!message) setOpen(false);
            }}
          >
            Apply account types
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <FieldError id={errorId} message={open ? error : ''} className="sr-only" />
    </div>
  );
}
