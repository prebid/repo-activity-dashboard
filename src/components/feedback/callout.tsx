import type { ReactNode } from 'react';
import { ErrorIcon, InfoIcon, WarningIcon } from '@/components/ui/icons';
import styles from './callout.module.css';

export const calloutTones = ['info', 'warning', 'error'] as const;
export type CalloutTone = (typeof calloutTones)[number];

const toneIcons = { info: InfoIcon, warning: WarningIcon, error: ErrorIcon } as const;

export interface CalloutProps {
  tone: CalloutTone;
  /** A short phrase in the tone ink before the body, in the same text flow. */
  lead?: string;
  children: ReactNode;
  /** The element the notice is today; `p` keeps the body to phrasing content. */
  as?: 'aside' | 'div' | 'p';
  /** No live role by default: a site that announces passes its own. */
  role?: 'status' | 'alert' | 'note';
  'aria-label'?: string;
  id?: string;
}

/** A tinted notice: the icon names the tone, so meaning never rests on colour alone. */
export function Callout({
  tone,
  lead,
  children,
  as: Element = 'div',
  role,
  'aria-label': label,
  id,
}: CalloutProps) {
  const Icon = toneIcons[tone];
  const Body = Element === 'p' ? 'span' : 'div';
  return (
    <Element className={styles.callout} data-tone={tone} role={role} aria-label={label} id={id}>
      <span className={styles.icon}>
        <Icon size={16} />
      </span>
      <Body className={styles.body}>
        {lead && <strong className={styles.lead}>{lead}</strong>}
        {lead && ' '}
        {children}
      </Body>
    </Element>
  );
}
