import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppSelect } from './AppSelect';

describe('AppSelect', () => {
  it('opens a styled listbox and reports the selected value through the existing change contract', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AppSelect aria-label="Sort by" value="featured" onChange={onChange}><option value="featured">Featured</option><option value="newest">Newest</option></AppSelect>);

    await user.click(screen.getByRole('combobox', { name: 'Sort by' }));
    expect(screen.getByRole('listbox')).toBeTruthy();
    await user.click(screen.getByRole('option', { name: 'Newest' }));
    expect(onChange.mock.calls[0]?.[0].target.value).toBe('newest');
  });

  it('adds search for long option lists and filters without losing the current selection', async () => {
    const user = userEvent.setup();
    render(<AppSelect aria-label="Course" value="course-1" onChange={() => undefined}>{Array.from({ length: 10 }, (_, index) => <option key={index} value={`course-${index + 1}`}>Course {index + 1}</option>)}</AppSelect>);

    await user.click(screen.getByRole('combobox', { name: 'Course' }));
    await user.type(screen.getByRole('textbox', { name: 'Search options' }), 'Course 10');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option', { name: 'Course 10' })).toBeTruthy();
  });
});
