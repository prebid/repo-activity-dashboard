'use client';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import styles from './filter-choices.module.css';

/** Compact multi-value facet; selections combine with OR within this field. */
export function FilterChoices({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [search, setSearch] = useState('');
  const all = [
    ...options,
    ...selected
      .filter((value) => !options.some((option) => option.value === value))
      .map((value) => ({ value, label: value })),
  ];
  const matching = all.filter((option) =>
    option.label.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <details className={styles.field}>
      <summary>
        {label}
        <span>{selected.length ? selected.length + ' selected' : 'Any'}</span>
      </summary>
      <div className={styles.content}>
        {all.length > 8 && (
          <Input
            aria-label={'Find ' + label.toLowerCase()}
            placeholder="Find…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        )}
        <div className={styles.options} role="group" aria-label={label}>
          {matching.map((option) => (
            <label key={option.value}>
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...selected, option.value]
                      : selected.filter((value) => value !== option.value),
                  )
                }
              />
              {option.label}
            </label>
          ))}
          {!matching.length && <p>No matching options</p>}
        </div>
      </div>
    </details>
  );
}
