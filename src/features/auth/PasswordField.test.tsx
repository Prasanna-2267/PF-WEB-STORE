import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PasswordField } from './PasswordField';

describe('PasswordField', () => {
  it('starts masked and toggles visibility without changing the value', async () => {
    const user = userEvent.setup();
    render(<PasswordField label="Password" name="password" defaultValue="secret-value" />);

    const input = screen.getByLabelText('Password') as HTMLInputElement;
    expect(input.type).toBe('password');

    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input.type).toBe('text');
    expect(input.value).toBe('secret-value');

    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input.type).toBe('password');
  });
});
