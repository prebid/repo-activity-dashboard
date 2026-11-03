import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { MeasurementValue } from '@/components/metrics/measurement-value';
import { notConnected } from '@/models/reporting-measurement';

it('states that a value is not connected yet, apart from a missing one', () => {
  const { container } = render(
    <>
      <MeasurementValue measurement={notConnected('Issues are not collected yet.')} />
      <MeasurementValue
        measurement={{ status: 'missing', value: null, reason: 'No data for this range.' }}
      />
    </>,
  );
  const [pending, missing] = container.querySelectorAll<HTMLElement>('[title]');
  expect(pending).toHaveTextContent('— Not connected yet. Issues are not collected yet.');
  expect(pending).toHaveAttribute('title', 'Not connected yet: Issues are not collected yet.');
  expect(pending).toHaveAttribute('data-not-connected', 'true');
  expect(missing).toHaveTextContent('— No data for this range.');
  expect(missing).not.toHaveAttribute('data-not-connected');
});
