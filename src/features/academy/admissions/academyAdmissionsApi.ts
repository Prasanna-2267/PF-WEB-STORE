import { apiRequest } from '@/lib/api/client';

export interface AdmissionImportRow {
  sNo?: number | string;
  name: string;
  email: string;
  phone?: string;
}

export interface AdmissionRejectedRow extends AdmissionImportRow { reason: string }

export interface AdmissionValidationResult {
  totalRows: number;
  validRows: AdmissionImportRow[];
  invalidRows: AdmissionRejectedRow[];
  duplicateRows: AdmissionRejectedRow[];
  alreadyAdmittedRows: AdmissionRejectedRow[];
  conflictRows: AdmissionRejectedRow[];
  errors: string[];
}

export interface AdmissionImportResult {
  batchId: string;
  deliveryStatus: 'EMAIL_PROVIDER_NOT_CONFIGURED';
  summary: {
    total: number;
    successCount: number;
    alreadyAdmittedCount: number;
    duplicateCount: number;
    invalidCount: number;
    conflictCount: number;
    failedCount: number;
  };
}

export interface AdmissionDashboard {
  summary: { recentCount: number; pendingCount: number; successfulCount: number; failedCount: number; duplicateCount: number };
  history: Array<{
    id: string;
    studentName: string;
    email: string;
    method: 'BULK_IMPORT' | 'QR_CODE' | 'ADMISSION_CODE';
    status: 'SUCCESS' | 'ALREADY_ADMITTED' | 'FAILED';
    createdBy: { fullName: string; email: string } | null;
    createdAt: string;
    completedAt: string | null;
    failureReason: string | null;
  }>;
}

export interface AdmissionQrSession { qrToken: string; expiresAt: string; refreshIntervalMs: number }

export const getAdmissionQrRotationDelay = (session: AdmissionQrSession, now = Date.now()): number => {
  const serverLifetime = Math.max(1_000, new Date(session.expiresAt).getTime() - now);
  return Math.max(1_000, Math.min(session.refreshIntervalMs, serverLifetime) - 750);
};

export interface AdmissionCode {
  id: string;
  code: string;
  maxUses: number | null;
  currentUses: number;
  status: 'ACTIVE' | 'EXHAUSTED' | 'EXPIRED' | 'REVOKED';
  expiresAt: string | null;
  createdAt: string;
  createdBy: { fullName: string; email: string };
}

export const academyAdmissionKeys = {
  root: (academyId: string) => ['academy', academyId, 'admissions'] as const,
  codes: (academyId: string) => ['academy', academyId, 'admissions', 'codes'] as const,
};

export const academyAdmissionsApi = {
  dashboard: (signal?: AbortSignal) => apiRequest<AdmissionDashboard>('/api/academy/admissions', { signal }),
  validate: (rows: AdmissionImportRow[]) => apiRequest<AdmissionValidationResult>('/api/academy/admissions/import/validate', { method: 'POST', body: { rows } }),
  confirm: (fileName: string, rows: AdmissionImportRow[]) => apiRequest<AdmissionImportResult>('/api/academy/admissions/bulk-import', { method: 'POST', body: { fileName, rows } }),
  generateQr: (signal?: AbortSignal) => apiRequest<AdmissionQrSession>('/api/academy/admissions/qr', { method: 'POST', body: {}, signal }),
  codes: (signal?: AbortSignal) => apiRequest<AdmissionCode[]>('/api/academy/admissions/codes', { signal }),
  generateCode: (input: { maxUses: number | null; expiresAt: string | null }) => apiRequest<AdmissionCode>('/api/academy/admissions/code', { method: 'POST', body: input }),
  updateCode: (codeId: string, input: { maxUses?: number | null; expiresAt?: string | null; status?: 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'EXHAUSTED' }) => apiRequest<AdmissionCode>(`/api/academy/admissions/codes/${encodeURIComponent(codeId)}`, { method: 'PATCH', body: input }),
  deleteCode: (codeId: string) => apiRequest<{ success: boolean }>(`/api/academy/admissions/codes/${encodeURIComponent(codeId)}`, { method: 'DELETE' }),
  revokeCode: (codeId: string) => apiRequest<AdmissionCode>(`/api/academy/admissions/codes/${encodeURIComponent(codeId)}/revoke`, { method: 'PATCH', body: {} }),
};

const splitCsvLine = (line: string): string[] => {
  const cells: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) { cells.push(value.trim()); value = ''; }
    else value += character;
  }
  cells.push(value.trim());
  return cells;
};

export const parseAdmissionCsv = (text: string): AdmissionImportRow[] => {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error('The CSV must contain a header and at least one student row.');
  const headers = splitCsvLine(lines[0]).map((value) => value.trim().toLowerCase());
  const nameIndex = headers.indexOf('name');
  const emailIndex = headers.indexOf('email');
  const phoneIndex = headers.indexOf('phone');
  if (nameIndex < 0 || emailIndex < 0) throw new Error('The CSV header must include name and email columns.');
  if (lines.length - 1 > 1000) throw new Error('A single import can contain at most 1,000 students.');
  return lines.slice(1).map((line, index) => {
    const cells = splitCsvLine(line);
    return { sNo: index + 1, name: cells[nameIndex] ?? '', email: cells[emailIndex] ?? '', ...(phoneIndex >= 0 && cells[phoneIndex] ? { phone: cells[phoneIndex] } : {}) };
  });
};

export const downloadAdmissionTemplate = (): void => {
  const csv = 'name,email,phone\r\nAsha Rao,asha@example.com,+919876543210\r\n';
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'parallax-flow-admission-template.csv';
  anchor.click();
  URL.revokeObjectURL(url);
};
