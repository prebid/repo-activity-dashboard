import { expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocalDataTable } from '@/components/tables/local-data-table';
import { GitHubAccountLink } from '@/components/github/account-link';
import { githubProfileUrlSchema } from '@/models/github-profile';
import { AccountTypeFilter } from '@/features/contributions/account-type-filter';
import { useState } from 'react';
import type { ContributionAccount } from '@/models/contributions';
it('uses one definition for header hover and keyboard/touch help without sorting', async () => {
  const user = userEvent.setup();
  render(
    <LocalDataTable
      search="local"
      title="Example"
      rows={[{ id: 'one', count: 2 }]}
      columns={[
        {
          id: 'count',
          label: 'Count',
          group: 'Activity',
          value: (r) => r.count,
          description: 'One first credit per account and PR.',
        },
      ]}
    />,
  );
  expect(screen.getByRole('button', { name: 'Count' })).toHaveAttribute(
    'title',
    'One first credit per account and PR.',
  );
  const help = screen.getByRole('button', { name: 'Column definitions for Example' });
  help.focus();
  await user.keyboard('{Enter}');
  const dialog = screen.getByRole('dialog', { name: 'Example column definitions' });
  expect(within(dialog).getByText('Activity — Count')).toBeVisible();
  expect(within(dialog).getByText('One first credit per account and PR.')).toBeVisible();
  expect(screen.getByRole('columnheader', { name: 'Count', hidden: true })).toHaveAttribute(
    'aria-sort',
    'none',
  );
  await user.keyboard('{Escape}');
  expect(help).toHaveFocus();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('omits help when no visible column has a definition', () => {
  render(
    <LocalDataTable
      search="local"
      title="Plain"
      rows={[{ id: 'one' }]}
      columns={[{ id: 'id', label: 'ID', value: (r) => r.id }]}
    />,
  );
  expect(screen.queryByRole('button', { name: /Column definitions/ })).not.toBeInTheDocument();
});
it('keeps source-provided profiles external, including bots, and marks fake destinations', () => {
  const view = render(
    <GitHubAccountLink
      login="sample-alice"
      label="Alice"
      url="https://github.example/sample-alice"
    />,
  );
  expect(screen.getByRole('link')).toHaveAttribute('target', '_blank');
  expect(screen.getByRole('link')).toHaveAttribute('rel', 'noopener noreferrer');
  expect(screen.getByRole('link')).toHaveAccessibleName(
    'Alice — GitHub profile for sample-alice (sample placeholder)',
  );
  view.rerender(<GitHubAccountLink login="example[bot]" url="https://github.com/apps/example" />);
  expect(screen.getByRole('link')).toHaveAttribute('href', 'https://github.com/apps/example');
  expect(screen.getByRole('link')).toHaveAccessibleName('GitHub profile for example[bot]');
  for (const url of [
    undefined,
    'javascript:alert(1)',
    'not a url',
    '//github.com/alice',
    'https://evil.example/alice',
    'http://github.com/alice',
    'https://u:p@github.com/alice',
    'https://github.com/',
    'https://github.com:8443/alice',
  ]) {
    view.rerender(<GitHubAccountLink login="Alice" url={url} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(githubProfileUrlSchema.safeParse(url).success).toBe(false);
  }
});
it('allows mixed account types and an explicit empty selection without applying half-edited choices', async () => {
  const user = userEvent.setup();
  function Example() {
    const [selected, setSelected] = useState<ContributionAccount['actorType'][]>([
      'human',
      'agent',
      'bot',
      'unknown',
    ]);
    return (
      <>
        <AccountTypeFilter selected={selected} onApply={setSelected} />
        <output aria-label="Selected types">{selected.join(',')}</output>
      </>
    );
  }
  render(<Example />);
  await user.click(screen.getByRole('button', { name: 'Account type: All' }));
  await user.click(screen.getByRole('menuitem', { name: 'Clear selection' }));
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'Human' }));
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'Prebid agent' }));
  expect(screen.getByLabelText('Selected types')).toHaveTextContent('human,agent,bot,unknown');
  await user.click(screen.getByRole('menuitem', { name: 'Apply account types' }));
  expect(screen.getByLabelText('Selected types')).toHaveTextContent('human,agent');
  await user.click(screen.getByRole('button', { name: 'Account type: 2 types' }));
  await user.click(screen.getByRole('menuitem', { name: 'Clear selection' }));
  await user.click(screen.getByRole('menuitem', { name: 'Apply account types' }));
  expect(screen.getByLabelText('Selected types')).toBeEmptyDOMElement();
  await user.click(screen.getByRole('button', { name: 'Account type: None' }));
  await user.click(screen.getByRole('menuitem', { name: 'Select all' }));
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'Bot' }));
  await user.keyboard('{Escape}');
  expect(screen.getByLabelText('Selected types')).toBeEmptyDOMElement();
});
