import { expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PopulationSelector } from '@/features/contributions/population-selector';
import { AccountTypeFilter } from '@/features/contributions/account-type-filter';
import { ContributionControls } from '@/features/contributions/contribution-controls';
import { RepositorySelector } from '@/components/reporting/repository-selector';
import { contributionSample } from '@/mocks/contributions';
import { defaultContributionSettings } from '@/lib/presentation/contribution-settings';
import { localContributionOptions } from '../support/contribution-options';
const source = contributionSample();
const options = localContributionOptions(source, source.asOf);
const message = 'This selection is too large. Reduce it and try again.';

it('keeps an account draft and its rejection visible until the user cancels or applies it successfully', async () => {
  const user = userEvent.setup();
  const onApply = vi.fn<() => string | undefined>().mockReturnValueOnce(message);
  render(
    <PopulationSelector
      options={options}
      selected={{ population: { kind: 'all' }, excludedAccountIds: [] }}
      onApply={onApply}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'All accounts' }));
  const dialog = screen.getByRole('dialog');
  await user.click(within(dialog).getByRole('radio', { name: 'Selected accounts' }));
  const individuals = within(dialog).getByRole('group', { name: /^Individuals/ });
  await user.click(
    await within(individuals).findByRole('checkbox', { name: 'Alice (@sample-alice)' }),
  );
  await user.click(within(dialog).getByRole('button', { name: 'Apply accounts' }));
  expect(dialog).toBeVisible();
  expect(within(dialog).getByRole('alert')).toHaveTextContent(message);
  expect(
    within(individuals).getByRole('checkbox', { name: 'Alice (@sample-alice)' }),
  ).toBeChecked();
  await user.click(within(dialog).getByRole('button', { name: 'Apply accounts' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(onApply.mock.calls[1]).toEqual(onApply.mock.calls[0]);
});
it('keeps a rejected repository selection editable', async () => {
  const user = userEvent.setup(),
    onApply = vi.fn<() => string | undefined>().mockReturnValueOnce(message);
  render(
    <RepositorySelector
      repositories={[
        { id: 'a', name: 'Alpha', slug: 'alpha' },
        { id: 'b', name: 'Beta', slug: 'beta' },
      ]}
      selected={['a']}
      onApply={onApply}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Choose repositories 1 / 2' }));
  const dialog = screen.getByRole('dialog');
  await user.click(within(dialog).getByRole('checkbox', { name: 'Beta' }));
  await user.click(within(dialog).getByRole('button', { name: 'Apply selection' }));
  expect(within(dialog).getByRole('alert')).toHaveTextContent(message);
  expect(within(dialog).getByRole('checkbox', { name: 'Beta' })).toBeChecked();
  await user.click(within(dialog).getByRole('button', { name: 'Apply selection' }));
  expect(screen.queryByRole('dialog')).toBeNull();
});
it('keeps rejected account types open with their draft selection', async () => {
  const user = userEvent.setup(),
    onApply = vi.fn<() => string | undefined>().mockReturnValueOnce(message);
  render(<AccountTypeFilter selected={['human']} onApply={onApply} />);
  await user.click(screen.getByRole('button', { name: 'Account type: Human' }));
  // Each choice shows its account glyph at 16px, the badge glyph's menu size.
  const glyphs = screen
    .getAllByRole('menuitemcheckbox')
    .map((item) => item.querySelector('svg[width="16"]')?.getAttribute('class'));
  expect(glyphs).toEqual([
    expect.stringContaining('lucide-user-round'),
    expect.stringContaining('lucide-cpu'),
    expect.stringContaining('lucide-bot'),
    expect.stringContaining('lucide-circle-question-mark'),
  ]);
  // Apply is the menu's primary small action, in a footer after the choices.
  const apply = screen.getByRole('menuitem', { name: 'Apply account types' });
  expect(apply).toHaveClass('bg-action', 'h-7');
  expect(apply.parentElement).toBe(screen.getByRole('menu').lastElementChild);
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'Bot' }));
  await user.click(screen.getByRole('menuitem', { name: 'Apply account types' }));
  expect(screen.getByRole('alert')).toHaveTextContent(message);
  expect(screen.getByRole('menuitemcheckbox', { name: 'Bot' })).toBeChecked();
  expect(screen.getByRole('menuitem', { name: 'Apply account types' })).toHaveAccessibleDescription(
    message,
  );
  await user.click(screen.getByRole('menuitem', { name: 'Apply account types' }));
  expect(screen.queryByRole('menu')).toBeNull();
  expect(screen.queryByRole('alert')).toBeNull();
});
it('propagates rejected custom dates through the contribution control boundary', async () => {
  const user = userEvent.setup();
  render(
    <ContributionControls
      directory={source}
      options={options}
      value={defaultContributionSettings(source)}
      asOf={source.asOf}
      pending={false}
      onChange={() => message}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Custom range for Reporting period' }));
  const dialog = screen.getByRole('dialog');
  await user.click(within(dialog).getByRole('button', { name: 'Apply dates' }));
  expect(within(dialog).getByRole('alert')).toHaveTextContent(message);
  expect(within(dialog).getByLabelText('Start date')).toHaveValue('2026-01-01');
});
