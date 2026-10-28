'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, FolderGit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import type { OverviewRepository } from '@/models/repository-overview';
import styles from './overview-controls.module.css';

const searchable = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
export function RepositorySelector({
  repositories,
  selected,
  onApply,
}: {
  repositories: readonly OverviewRepository[];
  selected: readonly string[];
  onApply: (ids: string[]) => void;
}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [search, setSearch] = useState('');
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
    }
    setOpen(next);
  }
  return (
    <div ref={setContainer}>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className={styles.control}
            aria-label={'Choose repositories ' + selected.length + ' / ' + repositories.length}
          >
            <FolderGit2 size={15} aria-hidden="true" />
            Repositories{' '}
            <span className={styles.count}>
              {selected.length} / {repositories.length}
            </span>
            <ChevronDown size={14} aria-hidden="true" />
          </Button>
        </DialogTrigger>
        <DialogContent container={container} className={styles.dialog}>
          <DialogHeader className="text-left">
            <DialogTitle>Choose repositories</DialogTitle>
            <DialogDescription>This selection applies to both tables.</DialogDescription>
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
              onClick={() => setDraft(repositories.map((repo) => repo.id))}
            >
              Select all {repositories.length}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDraft([])}>
              Clear selection
            </Button>
            <span aria-live="polite">{draft.length} selected</span>
          </div>
          <div className={styles.repositoryList} role="group" aria-label="Repositories">
            {matching.map((repo) => (
              <label key={repo.id} className={styles.repositoryOption}>
                <input
                  type="checkbox"
                  checked={draft.includes(repo.id)}
                  onChange={(event) => {
                    const checked = event.currentTarget.checked;
                    setDraft((previous) =>
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
          <DialogFooter className="gap-2 sm:space-x-0">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              className={styles.apply}
              onClick={() => {
                onApply(draft);
                setOpen(false);
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
