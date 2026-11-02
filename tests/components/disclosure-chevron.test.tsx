import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { DisclosureChevron } from '@/components/ui/disclosure-chevron';
import { ChartPanel } from '@/components/charts/chart-panel';
import { FilterChoices } from '@/components/tables/filter-choices';
import { LoginView } from '@/features/authentication/login-view';

vi.mock('next-auth/react', () => ({ signIn: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/components/providers/auth-transitions', () => ({ notifyAuthTransition: vi.fn() }));

it('is the one disclosure glyph of ChartPanel, FilterChoices and the sign-in help', () => {
  const { container } = render(<DisclosureChevron />);
  const chevron = container.firstElementChild!;
  expect(chevron.tagName).toBe('SPAN');
  expect(chevron.firstElementChild).toHaveClass('lucide-chevron-down');
  expect(chevron.firstElementChild).toHaveAttribute('width', '14');
  // CSS module class names are hashed per file, so a copy in another module would not match.
  const shared = chevron.className;
  render(
    <ChartPanel
      label="Charts"
      title="Charts"
      description="Every chart."
      content="bars"
      showLabel="Show charts"
      hideLabel="Hide charts"
      expanded={false}
      onExpandedChange={() => {}}
    >
      Chart
    </ChartPanel>,
  );
  const trigger = screen.getByRole('button', { name: 'Show charts' });
  expect(trigger.lastElementChild).toHaveClass(shared);
  render(<FilterChoices label="Authors" options={[]} selected={[]} onChange={() => {}} />);
  const facet = screen.getByText('Authors').closest('summary')!;
  expect(facet.querySelector('svg')!.parentElement).toHaveClass(shared);
  render(<LoginView preview={false} callbackUrl="/repos" />);
  const help = screen.getByText('Signing in for the first time?');
  expect(help.tagName).toBe('SUMMARY');
  expect(help.lastElementChild).toHaveClass(shared);
  expect(help.querySelectorAll('svg')).toHaveLength(1);
});
