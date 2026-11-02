'use client';
import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { DisclosureChevron } from '@/components/ui/disclosure-chevron';
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
      {/* The shared disclosure trigger: no native marker, a trailing chevron that turns open. */}
      <summary className={styles.trigger}>
        <span className={styles.label}>{label}</span>
        <span className={styles.state}>
          <span className={styles.count}>
            {selected.length ? selected.length + ' selected' : 'Any'}
          </span>
          <DisclosureChevron />
        </span>
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
              <Checkbox
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
