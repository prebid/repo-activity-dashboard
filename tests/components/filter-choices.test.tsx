import { useState } from 'react';
import { expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterChoices } from '@/components/tables/filter-choices';
function Choices({ large = false }: { large?: boolean }) {
  const [selected, setSelected] = useState(['unlisted']);
  return (
    <FilterChoices
      label="Authors"
      selected={selected}
      onChange={setSelected}
      options={Array.from({ length: large ? 12 : 2 }, (_, i) => ({
        value: 'author-' + i,
        label: 'Author ' + i,
      }))}
    />
  );
}
it('keeps selected values that are absent from the sample and supports selecting and removing values', () => {
  render(<Choices />);
  fireEvent.click(screen.getByText('Authors'));
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Author 1' }));
  expect(screen.getByText('2 selected')).toBeVisible();
  fireEvent.click(screen.getByRole('checkbox', { name: 'unlisted' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Author 1' }));
  expect(screen.getByText('Any')).toBeVisible();
});
it('searches a long facet without clearing hidden selections', () => {
  render(<Choices large />);
  fireEvent.click(screen.getByText('Authors'));
  fireEvent.change(screen.getByRole('textbox', { name: 'Find authors' }), {
    target: { value: 'Author 11' },
  });
  expect(screen.getAllByRole('checkbox')).toHaveLength(1);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Author 11' }));
  expect(screen.getByText('2 selected')).toBeVisible();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'not here' } });
  expect(screen.getByText('No matching options')).toBeVisible();
});
