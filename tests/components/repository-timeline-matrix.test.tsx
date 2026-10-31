import { expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import userEvent from '@testing-library/user-event';
import { renderedMain } from '../support/rendered-html';
import { RepositoryTimelineMatrixView } from '@/features/repositories/repository-timeline-matrix-view';
import { AllRepositoriesTabs } from '@/features/repositories/all-repositories-header';
import {
  repositoryTimelineMatrixSample,
  type RepositoryTimelineScenario,
} from '@/mocks/repository-timeline';
import { selectRepositoryTimelineMatrix } from '@/lib/presentation/repository-timeline-matrix';
import {
  repositoryTimelineMetricScope,
  type RepositoryTimelineMetric,
} from '@/models/repository-timeline';
import type { RepositoryTimelineMatrix } from '@/models/repository-timeline-matrix';
import type { TimelineRequest } from '@/models/reporting-timeline';

const request: TimelineRequest = {
  grouping: 'month',
  range: { start: '2026-01-01T00:00:00.000Z', end: '2026-10-24T12:00:00.000Z', endInclusive: true },
};
function report(
  sample: RepositoryTimelineScenario = 'reference',
  metric: RepositoryTimelineMetric = 'prsOpened',
  query = request,
) {
  const source = repositoryTimelineMatrixSample(
    repositoryTimelineMetricScope(metric).recordKind,
    sample,
  );
  return selectRepositoryTimelineMatrix(source, query, {
    metric,
    repositoryIds: source.repositories.map((row) => row.repository.id),
  });
}
function preview(matrix: RepositoryTimelineMatrix) {
  return (
    <RepositoryTimelineMatrixView
      matrix={matrix}
      href="/repos?timeline=1"
      summaryHref="/repos?period=last-month&age=60"
    />
  );
}
function repoRow(name: string) {
  return within(screen.getByRole('table')).getByRole('cell', { name }).closest('tr')!;
}
it('renders repository rows with exact monthly values, honest partial dates and no unfinished controls', () => {
  render(preview(report()));
  expect(screen.getByRole('link', { name: 'Timeline' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Summary' })).toHaveAttribute(
    'href',
    '/repos?period=last-month&age=60',
  );
  expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(18);
  const js = within(repoRow('Prebid.js'))
    .getAllByRole('cell')
    .map((cell) => cell.textContent);
  expect(js).toEqual(['Prebid.js', '0', '0', '0', '0', '0', '0', '0', '1', '1', '3']);
  expect(screen.getByRole('columnheader', { name: 'Oct 2026 (partial)' })).toBeVisible();
  expect(screen.getByRole('table').querySelector('sup')).toBeNull();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  for (const name of ['Columns', 'Export CSV', 'Show chart', 'Next'])
    expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Earlier' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Later' })).toBeDisabled();
});
it('keeps sorting by a period after moving it offscreen and restores the same values on return', async () => {
  const user = userEvent.setup();
  const matrix = report('reference', 'prsOpened', {
    ...request,
    range: { ...request.range, start: '2025-01-01T00:00:00.000Z' },
  });
  render(preview(matrix));
  expect(screen.getByRole('status')).toHaveTextContent('Periods 13–22 of 22');
  await user.click(screen.getByRole('button', { name: 'Aug 2026' }));
  await user.click(screen.getByRole('button', { name: 'Aug 2026 ↑' }));
  const names = () =>
    Array.from(screen.getByRole('table').querySelectorAll('tbody [data-column="repository"]')).map(
      (cell) => cell.textContent,
    );
  const sorted = names();
  expect(sorted[0]).toBe('Prebid.js');
  await user.click(screen.getByRole('button', { name: 'Earlier' }));
  expect(screen.getByRole('status')).toHaveTextContent('Periods 1–12 of 22');
  expect(screen.getByRole('table').querySelectorAll('thead th')).toHaveLength(13);
  expect(
    screen.getByText(/Sorted by Aug 2026 \(descending; outside visible periods\)/),
  ).toBeVisible();
  expect(names()).toEqual(sorted);
  const priorYear = within(repoRow('Prebid.js')).getAllByRole('cell').slice(1);
  expect(priorYear).toHaveLength(12);
  for (const cell of priorYear)
    expect(cell).toHaveTextContent('— This time range has incomplete prepared sample coverage.');
  expect(screen.getByRole('button', { name: 'Earlier' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Later' }));
  expect(names()).toEqual(sorted);
  expect(screen.getByRole('columnheader', { name: 'Aug 2026 ↓' })).toHaveAttribute(
    'aria-sort',
    'descending',
  );
  expect(screen.getByRole('status')).toHaveTextContent('Periods 13–22 of 22');
});
it('bounds a 500-period DOM and keeps 50-row repository pages independent of the period window', async () => {
  const user = userEvent.setup();
  const dense = report('reference', 'prsOpened', {
    grouping: 'day',
    range: { ...request.range, start: '2025-06-12T00:00:00.000Z' },
  });
  const view = render(preview(dense));
  expect(screen.getByRole('status')).toHaveTextContent('Periods 493–500 of 500');
  expect(screen.getByRole('table').querySelectorAll('thead th')).toHaveLength(9);
  const matrix = report('reference', 'prsOpened', {
    ...request,
    range: { ...request.range, start: '2025-01-01T00:00:00.000Z' },
  });
  // A future 51-repository catalog exercises table pagination without expanding the prepared source.
  const base = matrix.rows[0];
  matrix.rows = Array.from({ length: 51 }, (_, i) => ({
    ...base,
    id: 'future-' + i,
    repository: {
      ...base.repository,
      id: 'future-' + i,
      name: 'Repository ' + String(i).padStart(2, '0'),
    },
  }));
  matrix.scope.repositoryIds = matrix.rows.map((row) => row.id);
  view.rerender(preview(matrix));
  expect(screen.getByRole('status')).toHaveTextContent('Periods 13–22 of 22');
  expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(50);
  await user.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(1);
  expect(repoRow('Repository 50')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Earlier' }));
  expect(screen.getByRole('status')).toHaveTextContent('Periods 1–12 of 22');
  expect(screen.getByText('Page 2 of 2')).toBeVisible();
  expect(repoRow('Repository 50')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Repository ↑' }));
  expect(screen.getByText('Page 1 of 2')).toBeVisible();
  expect(screen.getByRole('table').querySelector('tbody tr')).toHaveTextContent('Repository 50');
  expect(screen.getByRole('status')).toHaveTextContent('Periods 1–12 of 22');
});
it('keeps known zero, incomplete zero, missing and duration values distinct', () => {
  const view = render(preview(report('mixed')));
  expect(screen.getByLabelText('Timeline data coverage')).toBeVisible();
  expect(repoRow('Prebid Server (Java)').querySelector('td:nth-child(2)')).toHaveTextContent('—');
  expect(repoRow('Prebid Documentation').querySelector('td:nth-child(2)')).toHaveTextContent(/^0$/);
  view.rerender(preview(report('mixed', 'prsOpened', { ...request, grouping: 'quarter' })));
  const partial = repoRow('Prebid Server (Go)');
  expect(partial.querySelector('td:nth-child(2) sup')).toHaveTextContent('*');
  view.rerender(preview(report('reference', 'medianMergeDays')));
  const cells = within(repoRow('Prebid.js')).getAllByRole('cell');
  expect(cells[9]).toHaveTextContent('5 d');
  expect(cells[10]).toHaveTextContent('31 d');
  expect(cells[1]).toHaveTextContent('—');
});
it('explains snapshot cutoffs in shared column help and keeps empty selection separate', async () => {
  const user = userEvent.setup();
  const matrix = report('partial', 'totalOpenPrs', {
    grouping: 'day',
    range: {
      start: '2026-10-11T00:00:00.000Z',
      end: '2026-10-22T00:00:00.000Z',
      endInclusive: false,
    },
  });
  const view = render(preview(matrix));
  expect(screen.getByLabelText('Timeline scope')).toHaveTextContent(
    'Backlog at each covered interval',
  );
  expect(screen.getByRole('table')).toHaveTextContent('*');
  expect(screen.getByText(/supplied historical values/)).toBeVisible();
  await user.click(screen.getByRole('button', { name: /Column definitions for/ }));
  expect(screen.getByRole('dialog')).toHaveTextContent('exclusive end');
  await user.keyboard('{Escape}');
  view.rerender(preview({ ...matrix, scope: { ...matrix.scope, repositoryIds: [] }, rows: [] }));
  expect(screen.getByRole('heading', { name: 'No repositories selected' })).toBeVisible();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});
it('renders disabled SSR window buttons and a bounded-link unavailable state', () => {
  const main = renderedMain(
    renderToString(
      <main>{preview(report('reference', 'prsOpened', { ...request, grouping: 'week' }))}</main>,
    ),
  )!;
  const buttons = main.querySelectorAll('nav[aria-label="Timeline period windows"] button');
  expect(buttons).toHaveLength(2);
  for (const button of buttons) expect(button).toHaveAttribute('disabled');
  render(<AllRepositoriesTabs active="summary" summaryHref="/repos" timelineHref={null} />);
  expect(screen.getByText('Timeline')).toHaveAttribute('aria-disabled', 'true');
  expect(screen.queryByRole('link', { name: 'Timeline' })).not.toBeInTheDocument();
});
it('labels weekly windows with their covered dates instead of repeating two weekly ranges', async () => {
  const user = userEvent.setup();
  render(preview(report('reference', 'issuesClosed', { ...request, grouping: 'week' })));
  expect(screen.getByRole('status')).toHaveTextContent('Sep 7, 2026 – Oct 24, 2026');
  await user.click(screen.getByRole('button', { name: 'Earlier' }));
  expect(screen.getByRole('status')).toHaveTextContent('Jun 15, 2026 – Sep 6, 2026');
});
it('renders statistics as consecutive repository groups, without splitting a group at the fifty-row boundary', async () => {
  const user = userEvent.setup(),
    source = repositoryTimelineMatrixSample('mixed');
  const matrix = selectRepositoryTimelineMatrix(source, request, {
    repositoryIds: [...new Set(source.repositories.map((row) => row.repository.id))],
    metrics: ['prsOpened', 'prsMerged', 'medianMergeDays'],
  });
  const view = render(preview(matrix));
  expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(48);
  expect(screen.getByText('Page 1 of 2')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(6);
  expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(6);
  await user.click(screen.getByRole('button', { name: 'Previous' }));
  await user.click(screen.getByRole('button', { name: 'Oct 2026 (partial)' }));
  await user.click(screen.getByRole('button', { name: 'Oct 2026 (partial) ↑' }));
  const rows = screen.getByRole('table').querySelectorAll('tbody tr');
  expect(rows[0]).toHaveTextContent('Prebid Server (Go)');
  expect(rows[1]).toHaveTextContent('Pull requests — Merged');
  expect(rows[2]).toHaveTextContent('Median merge time');
  view.rerender(
    preview(
      selectRepositoryTimelineMatrix(source, request, {
        repositoryIds: ['repo-prebidjs'],
        metrics: [],
      }),
    ),
  );
  expect(screen.getByRole('heading', { name: 'No metrics selected' })).toBeVisible();
});
