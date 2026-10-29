import { expect, it, vi } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';
import { RepositoryScopeControls } from '@/features/repositories/repository-scope-controls';
import { TimeframeControl } from '@/features/repositories/timeframe-control';
import { repositoryPageSample } from '@/mocks/repository-page';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';
const samples = repositoryOverviewSamples();
const source = repositoryPageSample(samples.repositories[0].repository, {
  selection: { scope: 'current', metric: 'totalOpenPrs' },
  returnTo: '/repos',
});
it('hydrates report controls in place, enabling them only after client handlers attach', async () => {
  const changeScope = vi.fn(),
    changePeriod = vi.fn();
  const view = (
    <>
      <RepositoryScopeControls source={source} onChange={changeScope} />
      <TimeframeControl
        period={samples.periods[2].period}
        label="Period"
        asOf={source.asOf}
        onChange={changePeriod}
      />
    </>
  );
  const container = document.createElement('div');
  container.innerHTML = renderToString(view);
  document.body.append(container);
  const controls = [...container.querySelectorAll('select, button')];
  expect(controls).toHaveLength(3);
  for (const control of controls) expect(control).toBeDisabled();
  const recover = vi.fn();
  let root: Root | undefined;
  try {
    act(() => {
      root = hydrateRoot(container, view, { onRecoverableError: recover });
    });
    await waitFor(() => {
      for (const control of controls) expect(control).toBeEnabled();
    });
    const hydratedControls = [...container.querySelectorAll('select, button')];
    for (const [index, control] of controls.entries())
      expect(hydratedControls[index]).toBe(control);
    expect(recover).not.toHaveBeenCalled();
    expect(changeScope).not.toHaveBeenCalled();
    expect(changePeriod).not.toHaveBeenCalled();
  } finally {
    act(() => root?.unmount());
    container.remove();
  }
});
