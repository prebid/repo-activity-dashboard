import { ExternalLinkIcon } from '@/components/ui/icons';
import { githubProfileUrlSchema } from '@/models/github-profile';
import { cn } from '@/lib/utils';
import styles from './account-link.module.css';
export function GitHubAccountLink({
  login,
  url,
  label = login,
  className,
  secondaryLabel,
}: {
  login: string;
  url?: string;
  label?: string;
  className?: string;
  secondaryLabel?: string;
}) {
  const parsed = githubProfileUrlSchema.safeParse(url);
  // The external-link glyph sits in the name's own line box, so it follows the last character of a
  // wrapped name instead of the far edge of the cell.
  const content = (icon?: React.ReactNode) => (
    <span className={styles.label}>
      <span>
        {label}
        {icon}
      </span>
      {secondaryLabel && (
        <>
          {' '}
          <span data-slot="account-secondary" className={styles.secondary}>
            {secondaryLabel}
          </span>
        </>
      )}
    </span>
  );
  if (!parsed.success) return <span className={className}>{content()}</span>;
  const sample = new URL(parsed.data).hostname === 'github.example';
  return (
    <a
      href={parsed.data}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(styles.link, className)}
      aria-label={
        (label === login && !secondaryLabel
          ? ''
          : label + (secondaryLabel ? ' ' + secondaryLabel : '') + ' — ') +
        'GitHub profile for ' +
        login +
        (sample ? ' (sample placeholder)' : '')
      }
      title={
        sample
          ? 'Sample profile placeholder; real accounts will link to their GitHub profiles.'
          : 'Open GitHub profile'
      }
    >
      {content(<ExternalLinkIcon size={14} />)}
    </a>
  );
}
