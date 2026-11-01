'use client';
import { FieldError } from '@/components/feedback/field-error';
import { accountTypeLabels } from '@/models/github-account';
import { useEffect, useId, useState } from 'react';
import { AccountTypeIcon, ExpandIcon } from '@/components/ui/icons';
import { accountTypeIcons } from '@/components/github/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuAction,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuScrollGroup,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { contributionActorTypes, type ContributionAccount } from '@/models/contributions';

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
          <Button type="button" variant="secondary" disabled={pending}>
            <AccountTypeIcon size={14} />
            Account type: {summary}
            <ExpandIcon size={14} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent container={container} align="end" size="sm">
          <DropdownMenuLabel>Include account types</DropdownMenuLabel>
          <DropdownMenuScrollGroup>
            {contributionActorTypes.map((type) => {
              // Each choice carries the glyph its accounts show in an identity badge.
              const Icon = accountTypeIcons[type];
              return (
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
                  <Icon size={16} />
                  {accountTypeLabels[type]}
                </DropdownMenuCheckboxItem>
              );
            })}
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
          </DropdownMenuScrollGroup>
          <DropdownMenuSeparator />
          {error && (
            <div
              aria-hidden="true"
              className="px-2 py-1.5 text-body text-[var(--prebid-error-ink)]"
            >
              {error}
            </div>
          )}
          <DropdownMenuAction
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
          </DropdownMenuAction>
        </DropdownMenuContent>
      </DropdownMenu>
      <FieldError id={errorId} message={open ? error : ''} className="sr-only" />
    </div>
  );
}
