'use client';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/feedback/callout';
import { Pager } from '@/components/tables/pager';
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
    [selectedView, setSelectedView] = useState<{
      owner: ContributionOptions;
      kind: ContributionChoiceQuery['kind'];
      ids: string[];
    } | null>(null),
    [retry, setRetry] = useState(0);
  const selectionSnapshot =
    selectedView?.owner === options && selectedView.kind === kind ? selectedView.ids : null;
  const onlySelected = selectionSnapshot !== null;
  useEffect(() => {
    setSelectedView((current) =>
      current?.owner === options && current.kind === kind ? current : null,
    );
    setPage(0);
  }, [options, kind]);
  const queryKey = JSON.stringify({
    kind,
    search,
    page,
    selectedIds: selectionSnapshot,
  });
  const requestKey = queryKey + ':' + retry;
  const [result, setResult] = useState<{
    key: string;
    owner: ContributionOptions;
    kind: ContributionChoiceQuery['kind'];
    data?: ContributionChoicePage;
    error?: boolean;
  }>();
  useEffect(() => {
    const controller = new AbortController();
    const query: ContributionChoiceQuery = JSON.parse(queryKey) as ContributionChoiceQuery;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const start = setTimeout(
      () => {
        timeout = setTimeout(() => {
          controller.abort();
          setResult({ key: requestKey, owner: options, kind: query.kind, error: true });
        }, 15000);
        void options
          .choices(query, controller.signal)
          .then((data) => {
            if (!controller.signal.aborted)
              setResult({ key: requestKey, owner: options, kind: query.kind, data });
          })
          .catch(() => {
            if (!controller.signal.aborted)
              setResult({ key: requestKey, owner: options, kind: query.kind, error: true });
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
    data = current
      ? current.data
      : result?.owner === options && result.kind === kind
        ? result.data
        : undefined;
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
          if (onlySelected) setSelectedView({ owner: options, kind, ids: [...selected] });
          setPage(0);
        }}
      />
      <div className={styles.actions}>
        <label>
          <input
            type="checkbox"
            checked={onlySelected}
            onChange={(event) => {
              setSelectedView(
                event.target.checked ? { owner: options, kind, ids: [...selected] } : null,
              );
              setPage(0);
            }}
          />{' '}
          Show selected only
        </label>
        <Button size="sm" variant="ghost" onClick={() => onChange([])}>
          Clear {label.toLowerCase()}
        </Button>
      </div>
      {onlySelected && (
        <p className={styles.note}>
          Unchecked choices stay visible until you change this filter or search.
        </p>
      )}
      <div className={styles.options} aria-busy={!current}>
        {!current && <p role="status">{data ? 'Updating choices…' : 'Loading choices…'}</p>}
        {current?.error ? (
          <Callout tone="error" role="alert">
            Choices could not load.{' '}
            <Button size="sm" variant="ghost" onClick={() => setRetry((value) => value + 1)}>
              Retry {label.toLowerCase()}
            </Button>
          </Callout>
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
      {data && (
        <Pager
          label={label + ' choices pages'}
          size="sm"
          page={data.page + 1}
          pageCount={Math.ceil(data.total / tablePageSize)}
          disabled={!current}
          onPageChange={(next) => setPage(next - 1)}
        />
      )}
    </fieldset>
  );
}
