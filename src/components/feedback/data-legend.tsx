import { Fragment } from 'react';
import { InfoIcon } from '@/components/ui/icons';
import type { Measurement } from '@/models/reporting-measurement';
import styles from './data-legend.module.css';

export const dataLegendMarks = ['missing', 'partial'] as const;
export type DataLegendMark = (typeof dataLegendMarks)[number];

/**
 * The marks a set of measurements shows: a dash for a missing or not-applicable value and an
 * asterisk for a partial one, in the legend's order.
 */
export function measurementMarks(
  measurements: Iterable<Pick<Measurement, 'status'>>,
): DataLegendMark[] {
  const shown = new Set<DataLegendMark>();
  for (const { status } of measurements) {
    if (status === 'missing' || status === 'not-applicable') shown.add('missing');
    else if (status === 'partial') shown.add('partial');
  }
  return dataLegendMarks.filter((mark) => shown.has(mark));
}

/** The one wording for each value glyph, wherever a table, matrix or chart explains them. */
const wording = {
  missing: { glyph: '—', text: 'Not available or not applicable' },
  partial: { glyph: '*', text: 'Partial data' },
} as const satisfies Record<DataLegendMark, { glyph: string; text: string }>;

export interface DataLegendProps {
  /** The glyphs the surface can show; listed in the legend's own order. */
  marks?: readonly DataLegendMark[];
}

export function DataLegend({ marks = dataLegendMarks }: DataLegendProps) {
  const shown = dataLegendMarks.filter((mark) => marks.includes(mark));
  if (!shown.length) return null;
  return (
    <p className={styles.legend}>
      <InfoIcon size={14} />
      <span>
        {shown.map((mark, index) => (
          <Fragment key={mark}>
            {index > 0 && (
              <>
                {' '}
                <span aria-hidden="true">·</span>{' '}
              </>
            )}
            <span className={styles.entry} data-mark={mark}>
              <span className={styles.glyph}>{wording[mark].glyph}</span> {wording[mark].text}
            </span>
          </Fragment>
        ))}
      </span>
    </p>
  );
}
