'use client';
import { FieldError } from '@/components/feedback/field-error';
import { useEffect, useRef, useState } from 'react';
import { ExpandIcon, RepositoriesIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import styles from './overview-controls.module.css';

const searchable = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
export function RepositorySelector({
  repositories,
  selected,
  onApply,
  description = 'This selection applies to both tables.',
}: {
  repositories: readonly { id: string; name: string; slug: string }[];
  description?: string;
  selected: readonly string[];
  onApply: (ids: string[]) => string | void;
}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const selectionKey = selected.join('|');
  const previousSelection = useRef(selectionKey);
  useEffect(() => {
    if (previousSelection.current !== selectionKey) {
      setOpen(false);
      previousSelection.current = selectionKey;
    }
  }, [selectionKey]);
  const matching = repositories.filter((repo) =>
    searchable(repo.name + repo.slug).includes(searchable(search)),
  );
  function changeOpen(next: boolean) {
    if (next) {
      setDraft([...selected]);
      setSearch('');
      setError('');
    }
    setOpen(next);
  }
  const changeDraft: typeof setDraft = (next) => {
    setError('');
    setDraft(next);
  };
  return (
    <div ref={setContainer}>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogTrigger asChild>
          <Button
            variant="secondary"
            aria-label={'Choose repositories ' + selected.length + ' / ' + repositories.length}
          >
            <RepositoriesIcon size={14} />
            Repositories{' '}
            <span className={styles.count}>
              {selected.length} / {repositories.length}
            </span>
            <ExpandIcon size={14} />
          </Button>
        </DialogTrigger>
        <DialogContent container={container}>
          <DialogHeader className="text-left">
            <DialogTitle>Choose repositories</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <Input
            aria-label="Search repositories"
            placeholder="Find a repository…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className={styles.selectionActions}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => changeDraft(repositories.map((repo) => repo.id))}
            >
              Select all {repositories.length}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => changeDraft([])}>
              Clear selection
            </Button>
            <span aria-live="polite">{draft.length} selected</span>
          </div>
          <div className={styles.repositoryList} role="group" aria-label="Repositories">
            {matching.map((repo) => (
              <label key={repo.id} className={styles.repositoryOption}>
                <Checkbox
                  checked={draft.includes(repo.id)}
                  onChange={(event) => {
                    const checked = event.currentTarget.checked;
                    changeDraft((previous) =>
                      checked ? [...previous, repo.id] : previous.filter((id) => id !== repo.id),
                    );
                  }}
                />
                <span>{repo.name}</span>
              </label>
            ))}
            {!matching.length && (
              <p className={styles.help}>
                No repositories match this search. Your selection has not changed.
              </p>
            )}
          </div>
          <FieldError message={error} />
          <DialogFooter className="gap-2 sm:space-x-0">
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button
              variant="primary"
              onClick={() => {
                const message = onApply(draft);
                setError(message || '');
                if (!message) setOpen(false);
              }}
            >
              Apply selection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
