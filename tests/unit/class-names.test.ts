import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn with the type-role sizes', () => {
  it('keeps a role size beside a text colour', () => {
    expect(cn('text-body text-[var(--prebid-error-ink)]')).toBe(
      'text-body text-[var(--prebid-error-ink)]',
    );
    expect(cn('text-small text-muted-foreground')).toBe('text-small text-muted-foreground');
  });
  it('lets a role size replace a default size and the reverse', () => {
    expect(cn('px-2 text-sm font-semibold', 'font-normal text-body')).toBe(
      'px-2 font-normal text-body',
    );
    expect(cn('text-caption', 'text-xs')).toBe('text-xs');
  });
});
