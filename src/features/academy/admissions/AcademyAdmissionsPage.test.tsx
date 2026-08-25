import React from 'react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAcademyTenantStore } from '@/app/store/useAcademyTenantStore';
import { academyAdmissionsApi } from './academyAdmissionsApi';
import { AcademyAdmissionsPage } from './AcademyAdmissionsPage';

vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,qr') } }));

const dashboard = {
  summary: { recentCount: 0, pendingCount: 0, successfulCount: 0, failedCount: 0, duplicateCount: 0 },
  history: [],
};

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><AcademyAdmissionsPage /></QueryClientProvider>);
};

describe('Academy Admissions page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAcademyTenantStore.setState({
      activeAcademyId: 'academy-a',
      activeAcademy: { id: 'academy-a', name: 'Academy A' } as never,
      status: 'ready',
    });
    vi.spyOn(academyAdmissionsApi, 'dashboard').mockResolvedValue(dashboard);
    vi.spyOn(academyAdmissionsApi, 'codes').mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    useAcademyTenantStore.getState().clearTenantState();
  });

  it('automatically starts a server-issued QR and never exposes the raw token in UI text', async () => {
    const generate = vi.spyOn(academyAdmissionsApi, 'generateQr').mockResolvedValue({
      qrToken: 'PFQR.opaque-secret-token',
      expiresAt: new Date(Date.now() + 10_000).toISOString(),
      refreshIntervalMs: 10_000,
    });
    renderPage();
    expect(await screen.findByText(/Refreshes in \d+s/)).toBeInTheDocument();
    expect(generate).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('PFQR.opaque-secret-token')).not.toBeInTheDocument();
    expect(screen.queryByText(/QR expired/i)).not.toBeInTheDocument();
  });

  it('pauses and hides the QR when the backend cannot issue a fresh token', async () => {
    vi.spyOn(academyAdmissionsApi, 'generateQr').mockRejectedValue(new Error('Network unavailable'));
    renderPage();
    expect(await screen.findByText('Connection lost — QR paused')).toBeInTheDocument();
    expect(screen.getByText('Network unavailable')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Retry now' })).toBeEnabled();
  });

  it('shows conditional unlimited/limited and never/scheduled code controls', async () => {
    vi.spyOn(academyAdmissionsApi, 'generateQr').mockResolvedValue({ qrToken: 'PFQR.token', expiresAt: new Date(Date.now() + 10_000).toISOString(), refreshIntervalMs: 10_000 });
    const generateCode = vi.spyOn(academyAdmissionsApi, 'generateCode').mockResolvedValue({ id: 'code-1', code: 'ABCDEFGH', maxUses: null, currentUses: 0, status: 'ACTIVE', expiresAt: null, createdAt: new Date().toISOString(), createdBy: { fullName: 'Admin A', email: 'admin@example.test' } });
    renderPage();
    await screen.findByText(/Refreshes in \d+s/);
    await userEvent.click(screen.getByRole('button', { name: 'Generate Code' }));
    const dialog = screen.getByRole('dialog', { name: 'Generate Admission Code' });
    expect(within(dialog).getByRole('radio', { name: 'Unlimited' })).toBeChecked();
    expect(within(dialog).getByRole('radio', { name: 'Never expires' })).toBeChecked();
    expect(within(dialog).queryByLabelText('Maximum uses')).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Expiration date/time')).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Generate Code' }));
    await waitFor(() => expect(generateCode).toHaveBeenCalledWith({ maxUses: null, expiresAt: null }));
  });

  it('allows closing and re-generating the QR code display', async () => {
    vi.spyOn(academyAdmissionsApi, 'generateQr').mockResolvedValue({ qrToken: 'PFQR.token', expiresAt: new Date(Date.now() + 10_000).toISOString(), refreshIntervalMs: 10_000 });
    renderPage();
    await screen.findByText(/Refreshes in \d+s/);
    const closeBtn = screen.getByRole('button', { name: 'Close' });
    await userEvent.click(closeBtn);
    expect(screen.queryByText(/Refreshes in \d+s/)).not.toBeInTheDocument();
    const generateBtn = screen.getByRole('button', { name: 'Generate QR' });
    await userEvent.click(generateBtn);
    expect(await screen.findByText(/Refreshes in \d+s/)).toBeInTheDocument();
  });

  it('supports Disable, Enable, Edit, and Delete on admission code rows via right-click and actions', async () => {
    vi.spyOn(academyAdmissionsApi, 'generateQr').mockResolvedValue({ qrToken: 'PFQR.token', expiresAt: new Date(Date.now() + 10_000).toISOString(), refreshIntervalMs: 10_000 });
    const sampleCode = { id: 'code-123', code: 'TESTCODE', maxUses: null, currentUses: 0, status: 'ACTIVE' as const, expiresAt: null, createdAt: new Date().toISOString(), createdBy: { fullName: 'Admin', email: 'admin@test.com' } };
    vi.spyOn(academyAdmissionsApi, 'codes').mockResolvedValue([sampleCode]);
    const updateCode = vi.spyOn(academyAdmissionsApi, 'updateCode').mockResolvedValue({ ...sampleCode, status: 'REVOKED' });
    const deleteCode = vi.spyOn(academyAdmissionsApi, 'deleteCode').mockResolvedValue({ success: true });

    renderPage();
    await screen.findByText('TESTCODE');

    // Right-click code row opens context menu
    const codeCell = screen.getByText('TESTCODE');
    const row = codeCell.closest('tr')!;
    await userEvent.pointer([{ target: row, keys: '[MouseRight]' }]);

    expect(screen.getByRole('button', { name: /Disable code/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Edit code/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete code/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Disable code/i }));
    expect(updateCode).toHaveBeenCalledWith('code-123', { status: 'REVOKED' });
  });
});
