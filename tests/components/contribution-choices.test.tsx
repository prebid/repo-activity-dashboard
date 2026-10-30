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
