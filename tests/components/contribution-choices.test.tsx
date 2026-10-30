import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ContributionChoices } from '@/features/contributions/contribution-choices';
import { contributionOptionsClient } from '@/features/contributions/contribution-options-client';
import { defaultContributionSettings } from '@/lib/presentation/contribution-settings';
import { contributionSample } from '@/mocks/contributions';
import type { ContributionOptions, ContributionChoicePage } from '@/models/contribution-options';
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const choice = (name: string): ContributionChoicePage => ({
  choices: [{ value: name, label: name }],
  total: 1,
  page: 0,
});
it('discards late responses after changing source or closing the picker', async () => {
  vi.useFakeTimers();
  let finish!: (value: ContributionChoicePage) => void;
  const first: ContributionOptions = {
    choices: vi.fn(
      () =>
        new Promise<ContributionChoicePage>((resolve) => {
          finish = resolve;
        }),
    ),
    validate: () => Promise.resolve(null),
  };
  const second: ContributionOptions = {
    choices: vi.fn(() => Promise.resolve(choice('Current'))),
    validate: () => Promise.resolve(null),
  };
  const { rerender, unmount } = render(
    <ContributionChoices
      label="Individuals"
      kind="accounts"
      options={first}
      selected={['Saved']}
      onChange={vi.fn()}
    />,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  rerender(
    <ContributionChoices
      label="Individuals"
      kind="accounts"
      options={second}
      selected={['Saved']}
      onChange={vi.fn()}
    />,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
    finish(choice('Stale'));
  });
  expect(screen.queryByLabelText('Stale')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Current')).toBeVisible();
  rerender(
    <ContributionChoices
      label="Individuals"
      kind="accounts"
      options={first}
      selected={['Saved']}
      onChange={vi.fn()}
    />,
  );
  expect(screen.queryByLabelText('Current')).not.toBeInTheDocument();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  unmount();
  await act(async () => {
    finish(choice('After close'));
    await Promise.resolve();
  });
});
it('times out with a retry action and preserves the selected ids', async () => {
  vi.useFakeTimers();
  let finish!: (value: ContributionChoicePage) => void;
  const choices = vi
    .fn<ContributionOptions['choices']>()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue(choice('Saved'));
  const onChange = vi.fn(),
    options: ContributionOptions = { choices, validate: () => Promise.resolve(null) };
  render(
    <ContributionChoices
      label="Individuals"
      kind="accounts"
      options={options}
      selected={['Saved']}
      onChange={onChange}
    />,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(15001);
  });
  expect(screen.getByRole('alert')).toHaveTextContent('Choices could not load');
  expect(choices.mock.calls[0][1].aborted).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Retry individuals' }));
  expect(screen.getByRole('status')).toHaveTextContent('Loading choices');
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
    finish(choice('Late'));
  });
  expect(screen.getByRole('checkbox', { name: 'Saved' })).toBeChecked();
  expect(screen.queryByLabelText('Late')).not.toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
});
it('validates the metadata transport and refuses redirects, failures and malformed data', async () => {
  const fetcher = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetcher);
  const client = contributionOptionsClient('large'),
    signal = new AbortController().signal;
  const query = { kind: 'accounts' as const, search: 'person', page: 0, selectedIds: null };
  fetcher.mockResolvedValueOnce(Response.json(choice('A')));
  expect(await client.choices(query, signal)).toEqual(choice('A'));
  expect(fetcher).toHaveBeenCalledWith(
    '/api/reporting/contribution-options',
    expect.objectContaining({ method: 'POST', credentials: 'same-origin', signal }),
  );
  const settings = defaultContributionSettings(contributionSample());
  fetcher.mockResolvedValueOnce(Response.json({ settings }));
  expect(await client.validate(settings, signal)).toEqual(settings);
  for (const response of [
    new Response('bad', { status: 500 }),
    new Response('login', { headers: { 'content-type': 'text/html' } }),
    Response.json({ wrong: [] }),
  ]) {
    fetcher.mockResolvedValueOnce(response);
    await expect(client.choices(query, signal)).rejects.toThrow();
  }
  const redirected = Response.json(choice('A'));
  Object.defineProperty(redirected, 'redirected', { value: true });
  fetcher.mockResolvedValueOnce(redirected);
  await expect(client.choices(query, signal)).rejects.toThrow('unavailable');
});

it('keeps selected-only choices stable while changing live selections, until search or mode refreshes', async () => {
  const all = [
    { value: 'alice', label: 'Alice' },
    { value: 'bob', label: 'Bob' },
  ];
  const choices = vi.fn<ContributionOptions['choices']>((query) => {
    const matches = all.filter(
      (c) =>
        (!query.selectedIds || query.selectedIds.includes(c.value)) &&
        c.label.toLowerCase().includes(query.search),
    );
    return Promise.resolve({ choices: matches, total: matches.length, page: 0 });
  });
  const options: ContributionOptions = { choices, validate: () => Promise.resolve(null) };
  function Picker() {
    const [selected, setSelected] = useState(['alice', 'bob']);
    return (
      <ContributionChoices
        label="Individuals"
        kind="accounts"
        options={options}
        selected={selected}
        onChange={setSelected}
      />
    );
  }
  render(<Picker />);
  await screen.findByRole('checkbox', { name: 'Alice' });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Show selected only' }));
  await screen.findByRole('checkbox', { name: 'Alice' });
  expect(choices).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Alice' }));
  expect(screen.queryByText('Loading choices…')).toBeNull();
  expect(screen.getByRole('checkbox', { name: 'Alice' })).not.toBeChecked();
  expect(screen.getByText('(1 selected)')).toBeVisible();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Alice' }));
  expect(screen.getByRole('checkbox', { name: 'Alice' })).toBeChecked();
  expect(choices).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Alice' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Find individuals' }), {
    target: { value: 'alice' },
  });
  await screen.findByText('No matching choices');
  expect(choices.mock.calls.at(-1)?.[0].selectedIds).toEqual(['bob']);
});
it('keeps the last page visible during paging and disables repeated paging until it settles', async () => {
  vi.useFakeTimers();
  const first = {
    choices: Array.from({ length: 50 }, (_, i) => ({ value: String(i), label: 'Person ' + i })),
    total: 51,
    page: 0,
  };
  let finish!: (value: ContributionChoicePage) => void;
  const choices = vi
    .fn<ContributionOptions['choices']>()
    .mockResolvedValueOnce(first)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
  render(
    <ContributionChoices
      label="Individuals"
      kind="accounts"
      options={{ choices, validate: () => Promise.resolve(null) }}
      selected={['0']}
      onChange={vi.fn()}
    />,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(screen.getByRole('checkbox', { name: 'Person 0' })).toBeChecked();
  expect(screen.getByText('Updating choices…')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  await act(async () => {
    finish({ choices: [{ value: '50', label: 'Person 50' }], total: 51, page: 1 });
    await Promise.resolve();
  });
  expect(screen.getByRole('checkbox', { name: 'Person 50' })).toBeVisible();
  expect(screen.queryByRole('checkbox', { name: 'Person 0' })).toBeNull();
  expect(screen.getByText('Page 2 of 2')).toBeVisible();
});

it('resets the selected-only snapshot when its picker source changes', async () => {
  const first: ContributionOptions = {
    choices: () => Promise.resolve(choice('A')),
    validate: () => Promise.resolve(null),
  };
  const second: ContributionOptions = {
    choices: () => Promise.resolve(choice('B')),
    validate: () => Promise.resolve(null),
  };
  const { rerender } = render(
    <ContributionChoices
      label="Individuals"
      kind="accounts"
      options={first}
      selected={['A']}
      onChange={vi.fn()}
    />,
  );
  await screen.findByRole('checkbox', { name: 'A' });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Show selected only' }));
  await screen.findByRole('checkbox', { name: 'A' });
  rerender(
    <ContributionChoices
      label="Individuals"
      kind="accounts"
      options={second}
      selected={['B']}
      onChange={vi.fn()}
    />,
  );
  expect(screen.queryByRole('checkbox', { name: 'A' })).toBeNull();
  expect(screen.getByRole('checkbox', { name: 'Show selected only' })).not.toBeChecked();
  expect(await screen.findByRole('checkbox', { name: 'B' })).toBeChecked();
});
