import { accountTypeLabels } from '@/models/github-account';
import {
  AgentAccountIcon,
  BotAccountIcon,
  CompaniesIcon,
  HumanAccountIcon,
  UnknownAccountIcon,
} from '@/components/ui/icons';
import styles from './avatar.module.css';

export type AvatarAccountType = keyof typeof accountTypeLabels;
/** 32 in table cells; 48 in detail-page headers. */
export type AvatarSize = 32 | 48;

export type AvatarProps =
  /** A null account type is unavailable: no badge, and a title that says so. */
  | { kind: 'person'; name: string; accountType: AvatarAccountType | null; size: AvatarSize }
  | { kind: 'company'; name: string; size: AvatarSize }
  /** The bucket of accounts without a company mapping: not a company, so no monogram. */
  | { kind: 'unmapped-company'; size: AvatarSize };

/** Each account type's glyph, shared by the identity badge and the account-type choices. */
export const accountTypeIcons = {
  human: HumanAccountIcon,
  agent: AgentAccountIcon,
  bot: BotAccountIcon,
  unknown: UnknownAccountIcon,
} as const satisfies Record<AvatarAccountType, unknown>;

const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
const letter = /[\p{L}\p{N}]/u;

/** The first letter or digit of a word, as a whole grapheme so accents stay attached. */
function firstLetter(word: string) {
  for (const { segment } of segmenter.segment(word)) if (letter.test(segment)) return segment;
  return '';
}

/**
 * One letter for a one-word name; otherwise the first letters of the first and last words. A
 * name with no letter or digit shows its first character. Uppercased in one fixed locale, so the
 * server and the browser render the same text.
 */
export function avatarInitials(name: string): string {
  const letters = name.split(/\s+/).map(firstLetter).filter(Boolean);
  const chosen = letters.length > 1 ? [letters[0], letters[letters.length - 1]] : letters;
  if (!chosen.length) {
    const [first] = segmenter.segment(name.trim());
    return first?.segment ?? '';
  }
  return chosen.join('').toLocaleUpperCase('en');
}

const unavailableAccountTypeLabel = 'Account type unavailable';

/**
 * The account type as text for assistive technology, placed after the name in a cell that shows
 * no visible type, since the avatar's badge and title are hidden from it.
 */
export function AccountTypeLabel({ accountType }: { accountType: AvatarAccountType }) {
  return <span className="sr-only">{' ' + accountTypeLabels[accountType]}</span>;
}

/**
 * Decorative: the name beside it carries the accessible name. A person's avatar keeps the
 * account type as its title, with the type's glyph as the only svg inside it.
 */
export function Avatar(props: AvatarProps) {
  const { kind, size } = props;
  if (kind === 'unmapped-company')
    return (
      <span className={styles.avatar} data-kind={kind} data-size={size} aria-hidden="true">
        <CompaniesIcon size={16} />
      </span>
    );
  const initials = avatarInitials(props.name);
  if (kind === 'company')
    return (
      <span className={styles.avatar} data-kind={kind} data-size={size} aria-hidden="true">
        <span className={styles.initials}>{initials}</span>
      </span>
    );
  const { accountType } = props;
  const Icon = accountType && accountTypeIcons[accountType];
  return (
    <span
      className={styles.avatar}
      data-kind={kind}
      data-size={size}
      data-account-type={accountType ?? undefined}
      title={accountType ? accountTypeLabels[accountType] : unavailableAccountTypeLabel}
      aria-hidden="true"
    >
      <span className={styles.initials}>{initials}</span>
      {Icon && (
        <span className={styles.badge}>
          <Icon size={size === 48 ? 14 : 10} />
        </span>
      )}
    </span>
  );
}
