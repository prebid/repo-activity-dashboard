'use client';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { tablePageSize } from '@/models/table-query';
import type {
  ContributionOptions,
  ContributionChoicePage,
  ContributionChoiceQuery,
} from '@/models/contribution-options';
import styles from './contribution-controls.module.css';
export function ContributionChoices({
  label,
  kind,
  options,
  selected,
  onChange,
}: {
  label: string;
  kind: ContributionChoiceQuery['kind'];
  options: ContributionOptions;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState(''),
    [page, setPage] = useState(0),
    [onlySelected, setOnlySelected] = useState(false),
    [retry, setRetry] = useState(0);
  const queryKey = JSON.stringify({
    kind,
    search,
    page,
    selectedIds: onlySelected ? selected : null,
  });
  const requestKey = queryKey + ':' + retry;
  const [result, setResult] = useState<{
    key: string;
    owner: ContributionOptions;
    data?: ContributionChoicePage;
    error?: boolean;
  }>();
  useEffect(() => {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const start = setTimeout(
      () => {
        timeout = setTimeout(() => {
          controller.abort();
          setResult({ key: requestKey, owner: options, error: true });
        }, 15000);
        const query: ContributionChoiceQuery = JSON.parse(queryKey) as ContributionChoiceQuery;
        void options
          .choices(query, controller.signal)
          .then((data) => {
            if (!controller.signal.aborted) setResult({ key: requestKey, owner: options, data });
          })
          .catch(() => {
            if (!controller.signal.aborted)
              setResult({ key: requestKey, owner: options, error: true });
          })
          .finally(() => clearTimeout(timeout));
      },
      search ? 200 : 0,
    );
    return () => {
      controller.abort();
      clearTimeout(start);
      clearTimeout(timeout);
    };
  }, [options, queryKey, requestKey, search]);
  const current = result?.key === requestKey && result.owner === options ? result : undefined,
    data = current?.data;
  return (
    <fieldset className={styles.choices}>
      <legend>
        {label} <span>({selected.length} selected)</span>
      </legend>
      <Input
        aria-label={'Find ' + label.toLowerCase()}
        placeholder="Find…"
        value={search}
        maxLength={200}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(0);
        }}
      />
      <div className={styles.actions}>
        <label>
          <input
            type="checkbox"
            checked={onlySelected}
            onChange={(event) => {
              setOnlySelected(event.target.checked);
              setPage(0);
            }}
          />{' '}
          Show selected only
        </label>
        <Button size="sm" variant="ghost" onClick={() => onChange([])}>
          Clear {label.toLowerCase()}
        </Button>
      </div>
      <div className={styles.options} aria-busy={!current}>
        {!current ? (
          <p role="status">Loading choices…</p>
        ) : current.error ? (
          <div role="alert">
            Choices could not load.{' '}
            <Button size="sm" variant="ghost" onClick={() => setRetry((value) => value + 1)}>
              Retry {label.toLowerCase()}
            </Button>
          </div>
        ) : (
          data?.choices.map((option) => (
            <label key={option.value}>
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...new Set([...selected, option.value])]
                      : selected.filter((id) => id !== option.value),
                  )
                }
              />
              <span>{option.label}</span>
            </label>
          ))
        )}
        {data && !data.total && <p>No matching choices</p>}
      </div>
      {data && data.total > tablePageSize && (
        <nav className={styles.actions} aria-label={label + ' choices pages'}>
          <Button
            size="sm"
            variant="outline"
            disabled={!data.page}
            onClick={() => setPage(data.page - 1)}
          >
            Previous
          </Button>
          <span>
            Page {data.page + 1} of {Math.ceil(data.total / tablePageSize)}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={(data.page + 1) * tablePageSize >= data.total}
            onClick={() => setPage(data.page + 1)}
          >
            Next
          </Button>
        </nav>
      )}
    </fieldset>
  );
}
