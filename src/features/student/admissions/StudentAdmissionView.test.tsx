import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StudentAdmissionView } from './StudentAdmissionView';
import * as api from '@/lib/api/client';

describe('Student admission', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(cleanup);

  it('claims the authenticated student by code without mass-assigning studentUserId', async () => {
    const request = vi.spyOn(api, 'apiRequest').mockResolvedValue({ status: 'SUCCESS', academyId: 'academy-a', academyName: 'Academy A' });
    render(<MemoryRouter><StudentAdmissionView /></MemoryRouter>);
    await userEvent.type(screen.getByLabelText(/8-Character Admission Code/i), 'abc7k9x2');
    await userEvent.click(screen.getByRole('button', { name: 'Join Academy' }));
    expect(request).toHaveBeenCalledWith('/api/student/admissions/codes/claim', {
      method: 'POST', body: { code: 'ABC7K9X2' },
    });
    expect(JSON.stringify(request.mock.calls[0])).not.toContain('studentUserId');
    expect(await screen.findByText('Academy A')).toBeInTheDocument();
  });

  it('shows a backend failure and never displays success', async () => {
    vi.spyOn(api, 'apiRequest').mockRejectedValue(new Error('Admission code expired'));
    render(<MemoryRouter><StudentAdmissionView /></MemoryRouter>);
    await userEvent.type(screen.getByLabelText(/8-Character Admission Code/i), 'abc7k9x2');
    await userEvent.click(screen.getByRole('button', { name: 'Join Academy' }));
    expect(await screen.findByText('Admission code expired')).toBeInTheDocument();
    expect(screen.queryByText(/Successfully admitted/i)).not.toBeInTheDocument();
  });

  it('uses the protected Student QR route with no client identity field', async () => {
    const request = vi.spyOn(api, 'apiRequest').mockResolvedValue({ status: 'ALREADY_ADMITTED', academyId: 'academy-a', academyName: 'Academy A' });
    render(<MemoryRouter><StudentAdmissionView /></MemoryRouter>);
    await userEvent.click(screen.getByRole('button', { name: /Scan QR/i }));
    await userEvent.type(screen.getByLabelText(/paste QR Payload Token/i), 'valid-qr-token-payload');
    await userEvent.click(screen.getByRole('button', { name: 'Claim QR' }));
    expect(request).toHaveBeenCalledWith('/api/student/admissions/qr/claim', { method: 'POST', body: { qrToken: 'valid-qr-token-payload' } });
    expect(JSON.stringify(request.mock.calls[0])).not.toContain('studentUserId');
    expect(await screen.findByText('Academy A')).toBeInTheDocument();
  });

  it.each(['QR code expired', 'QR token replayed', 'Admission code exhausted', 'Admission code revoked', 'Forbidden', 'Provider disabled', 'Network unavailable'])(
    'renders %s as failure and never as success', async (message) => {
      vi.spyOn(api, 'apiRequest').mockRejectedValue(new Error(message));
      render(<MemoryRouter><StudentAdmissionView /></MemoryRouter>);
      await userEvent.type(screen.getByLabelText(/8-Character Admission Code/i), 'abc7k9x2');
      await userEvent.click(screen.getByRole('button', { name: 'Join Academy' }));
      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(screen.queryByText(/Successfully admitted/i)).not.toBeInTheDocument();
    },
  );
});
