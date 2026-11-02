import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  AccountTypeLabel,
  Avatar,
  avatarInitials,
  type AvatarAccountType,
} from '@/components/github/avatar';

describe('avatarInitials', () => {
  it.each([
    ['Alice', 'A'],
    ['Prebid sample agent', 'PA'],
    ['Sample bot', 'SB'],
    ['example acme', 'EA'],
    ['  Dana   Reyes  ', 'DR'],
    // A decomposed accent stays with its letter.
    ['Émile Zola', 'ÉZ'],
    ['(Unknown) user', 'UU'],
    // One fixed locale: a Turkish locale would give dotted capitals.
    ['ilse işık', 'II'],
    ['2026 Team', '2T'],
    ['—', '—'],
    ['', ''],
  ])('%j gives %j', (name, initials) => {
    expect(avatarInitials(name)).toBe(initials);
  });
});

const glyphs = {
  human: 'user-round',
  agent: 'cpu',
  bot: 'bot',
  unknown: 'circle-question-mark',
} as const satisfies Record<AvatarAccountType, string>;
const labels = { human: 'Human', agent: 'Prebid agent', bot: 'Bot', unknown: 'Unknown' } as const;

describe('Avatar', () => {
  it.each(Object.keys(glyphs) as AvatarAccountType[])(
    'shows a %s person as initials with one account-type badge',
    (accountType) => {
      for (const [size, glyph] of [
        [32, 10],
        [48, 14],
      ] as const) {
        const { container, unmount } = render(
          <Avatar kind="person" name="Alice Liddell" accountType={accountType} size={size} />,
        );
        const avatar = container.firstElementChild!;
        expect(avatar).toHaveAttribute('aria-hidden', 'true');
        expect(avatar).toHaveAttribute('title', labels[accountType]);
        expect(avatar).toHaveAttribute('data-kind', 'person');
        expect(avatar).toHaveAttribute('data-size', String(size));
        expect(avatar).toHaveAttribute('data-account-type', accountType);
        expect(avatar).toHaveTextContent(/^AL$/);
        // Exactly one svg under the titled element: the badge glyph.
        const icons = avatar.querySelectorAll('svg');
        expect(icons).toHaveLength(1);
        expect(icons[0]).toHaveClass('lucide-' + glyphs[accountType]);
        expect(icons[0]).toHaveAttribute('width', String(glyph));
        unmount();
      }
    },
  );

  it('shows a person whose account type is unavailable with no badge, titled as unavailable', () => {
    for (const size of [32, 48] as const) {
      const { container, unmount } = render(
        <Avatar kind="person" name="Dana Reyes" accountType={null} size={size} />,
      );
      const avatar = container.firstElementChild!;
      expect(avatar).toHaveAttribute('aria-hidden', 'true');
      expect(avatar).toHaveAttribute('title', 'Account type unavailable');
      expect(avatar).toHaveAttribute('data-kind', 'person');
      expect(avatar).not.toHaveAttribute('data-account-type');
      expect(avatar).toHaveTextContent(/^DR$/);
      expect(avatar.querySelector('svg')).toBeNull();
      unmount();
    }
  });

  it.each(Object.keys(glyphs) as AvatarAccountType[])(
    'gives assistive technology the %s account type as a separate word',
    (accountType) => {
      const { container } = render(
        <p>
          Alice
          <AccountTypeLabel accountType={accountType} />
        </p>,
      );
      expect(container.querySelector('.sr-only')).not.toHaveAttribute('aria-hidden');
      expect(container.firstElementChild!.textContent).toBe('Alice ' + labels[accountType]);
    },
  );

  it('shows a company as a monogram with no badge or title', () => {
    const { container } = render(<Avatar kind="company" name="Example Acme" size={48} />);
    const avatar = container.firstElementChild!;
    expect(avatar).toHaveAttribute('data-kind', 'company');
    expect(avatar).toHaveAttribute('aria-hidden', 'true');
    expect(avatar).not.toHaveAttribute('title');
    expect(avatar).toHaveTextContent(/^EA$/);
    expect(avatar.querySelector('svg')).toBeNull();
  });

  it('shows the unmapped bucket as a glyph tile, not a monogram', () => {
    const { container } = render(<Avatar kind="unmapped-company" size={32} />);
    const avatar = container.firstElementChild!;
    expect(avatar).toHaveAttribute('data-kind', 'unmapped-company');
    expect(avatar).toHaveAttribute('aria-hidden', 'true');
    expect(avatar).toHaveTextContent(/^$/);
    const icons = avatar.querySelectorAll('svg');
    expect(icons).toHaveLength(1);
    expect(icons[0]).toHaveClass('lucide-building-complex');
    expect(icons[0]).toHaveAttribute('width', '16');
  });
});
