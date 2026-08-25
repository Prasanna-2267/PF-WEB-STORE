import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/lib/api/client';
import { academyAdmissionKeys, academyAdmissionsApi, getAdmissionQrRotationDelay, parseAdmissionCsv } from './academyAdmissionsApi';

describe('Academy admissions API', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('parses the supported CSV format including quoted commas', () => {
    expect(parseAdmissionCsv('name,email,phone\r\n"Rao, Asha",asha@example.com,+919876543210')).toEqual([
      { sNo: 1, name: 'Rao, Asha', email: 'asha@example.com', phone: '+919876543210' },
    ]);
  });

  it('rejects CSVs without the required columns', () => {
    expect(() => parseAdmissionCsv('student,contact\nAsha,asha@example.com')).toThrow(/name and email/);
  });

  it('uses tenant-derived endpoints without sending academyId', async () => {
    const request = vi.spyOn(api, 'apiRequest').mockResolvedValue({});
    const rows = [{ name: 'Asha Rao', email: 'asha@example.com' }];
    await academyAdmissionsApi.validate(rows);
    await academyAdmissionsApi.confirm('students.csv', rows);
    await academyAdmissionsApi.generateQr();
    await academyAdmissionsApi.generateCode({ maxUses: 10, expiresAt: '2027-01-01T00:00:00.000Z' });

    expect(request).toHaveBeenNthCalledWith(1, '/api/academy/admissions/import/validate', { method: 'POST', body: { rows } });
    expect(request).toHaveBeenNthCalledWith(2, '/api/academy/admissions/bulk-import', { method: 'POST', body: { fileName: 'students.csv', rows } });
    expect(request).toHaveBeenNthCalledWith(3, '/api/academy/admissions/qr', { method: 'POST', body: {}, signal: undefined });
    expect(request).toHaveBeenNthCalledWith(4, '/api/academy/admissions/code', { method: 'POST', body: { maxUses: 10, expiresAt: '2027-01-01T00:00:00.000Z' } });
    expect(JSON.stringify(request.mock.calls)).not.toContain('academyId');
  });

  it('sends explicit unlimited and never-expiring options without academy identity', async () => {
    const request = vi.spyOn(api, 'apiRequest').mockResolvedValue({});
    await academyAdmissionsApi.generateCode({ maxUses: null, expiresAt: null });
    expect(request).toHaveBeenCalledWith('/api/academy/admissions/code', {
      method: 'POST',
      body: { maxUses: null, expiresAt: null },
    });
    expect(JSON.stringify(request.mock.calls)).not.toContain('academyId');
  });

  it('forwards cancellation and refreshes before the server-authoritative expiry', async () => {
    const request = vi.spyOn(api, 'apiRequest').mockResolvedValue({});
    const controller = new AbortController();
    await academyAdmissionsApi.generateQr(controller.signal);
    expect(request).toHaveBeenCalledWith('/api/academy/admissions/qr', { method: 'POST', body: {}, signal: controller.signal });
    expect(getAdmissionQrRotationDelay({ qrToken: 'opaque', expiresAt: new Date(20_000).toISOString(), refreshIntervalMs: 10_000 }, 10_000)).toBe(9_250);
  });

  it('separates React Query keys by Academy identity', () => {
    expect(academyAdmissionKeys.root('academy-a')).toEqual(['academy', 'academy-a', 'admissions']);
    expect(academyAdmissionKeys.root('academy-a')).not.toEqual(academyAdmissionKeys.root('academy-b'));
  });
});
