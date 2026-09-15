import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { Ban, CheckCircle2, Clock3, Copy, Download, Edit3, FileSpreadsheet, KeyRound, QrCode, ShieldCheck, Trash2, TriangleAlert, Upload, UserPlus, UsersRound, X, XCircle, type LucideIcon } from 'lucide-react';
import { useAcademyTenantStore } from '@/app/store/useAcademyTenantStore';
import { AdminDialog, AdminEmptyState, AdminPageHeader, AdminSkeleton, AdminStatusBadge, AdminToast, type AdminToastData } from '@/features/admin/AdminUi';
import { AdminDateTimePicker } from '@/features/admin/AdminDateTimePicker';
import { ReadOnlyPagination } from '@/components/ReadOnlyPagination';
import {
  academyAdmissionKeys,
  academyAdmissionsApi,
  downloadAdmissionTemplate,
  getAdmissionQrRotationDelay,
  parseAdmissionCsv,
  type AdmissionCode,
  type AdmissionImportResult,
  type AdmissionImportRow,
  type AdmissionQrSession,
  type AdmissionValidationResult,
} from './academyAdmissionsApi';
import './academy-admissions.css';

const defaultExpiry = () => new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 16);
const formatDate = (value: string | null | undefined) => {
  if (!value) return '—';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  } catch {
    return '—';
  }
};
const statusTone = (status: string) => status === 'SUCCESS' || status === 'ACTIVE' ? 'success' : status === 'FAILED' || status === 'REVOKED' ? 'danger' : status === 'EXPIRED' || status === 'EXHAUSTED' ? 'warning' : 'info';
const methodLabel = (method: string) => ({ BULK_IMPORT: 'Bulk import', QR_CODE: '10-second QR', ADMISSION_CODE: 'Admission code' }[method] ?? method);
type QrRotationStatus = 'starting' | 'active' | 'refreshing' | 'paused';

export const AcademyAdmissionsPage: React.FC = () => {
  const academyId = useAcademyTenantStore((state) => state.activeAcademyId);
  const academy = useAcademyTenantStore((state) => state.activeAcademy);
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<AdminToastData | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<AdmissionImportRow[]>([]);
  const [validation, setValidation] = useState<AdmissionValidationResult | null>(null);
  const [importResult, setImportResult] = useState<AdmissionImportResult | null>(null);

  const [qrOpen, setQrOpen] = useState(true);
  const [qr, setQr] = useState<AdmissionQrSession | null>(null);
  const [qrImage, setQrImage] = useState('');
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [qrRotationStatus, setQrRotationStatus] = useState<QrRotationStatus>('starting');
  const [qrRotationError, setQrRotationError] = useState('');
  const [qrRestartKey, setQrRestartKey] = useState(0);

  const [codeOpen, setCodeOpen] = useState(false);
  const [codeUsage, setCodeUsage] = useState<'unlimited' | 'limited'>('unlimited');
  const [maxUses, setMaxUses] = useState(25);
  const [codeExpiration, setCodeExpiration] = useState<'never' | 'scheduled'>('never');
  const [expiresAt, setExpiresAt] = useState(defaultExpiry);

  const [editingCode, setEditingCode] = useState<AdmissionCode | null>(null);
  const [editUsage, setEditUsage] = useState<'unlimited' | 'limited'>('unlimited');
  const [editMaxUses, setEditMaxUses] = useState(25);
  const [editExpiration, setEditExpiration] = useState<'never' | 'scheduled'>('never');
  const [editExpiresAt, setEditExpiresAt] = useState(defaultExpiry);

  const [pendingDelete, setPendingDelete] = useState<AdmissionCode | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; code: AdmissionCode } | null>(null);

  const [historyPage, setHistoryPage] = useState(1);
  const [codesPage, setCodesPage] = useState(1);
  const PAGE_LIMIT = 8;

  const dashboard = useQuery({
    queryKey: academyAdmissionKeys.root(academyId ?? 'unresolved'),
    queryFn: ({ signal }) => academyAdmissionsApi.dashboard(signal),
    enabled: Boolean(academyId),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });
  const codes = useQuery({
    queryKey: academyAdmissionKeys.codes(academyId ?? 'unresolved'),
    queryFn: ({ signal }) => academyAdmissionsApi.codes(signal),
    enabled: Boolean(academyId),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: academyAdmissionKeys.root(academyId ?? 'unresolved') }),
      queryClient.invalidateQueries({ queryKey: ['academy', academyId, 'students'] }),
      queryClient.invalidateQueries({ queryKey: ['academy', academyId, 'overview'] }),
    ]);
  };

  const validateMutation = useMutation({
    mutationFn: academyAdmissionsApi.validate,
    onSuccess: setValidation,
    onError: (error) => setToast({ id: Date.now(), tone: 'error', title: 'CSV validation failed', message: error instanceof Error ? error.message : 'The server rejected this CSV.' }),
  });
  const confirmMutation = useMutation({
    mutationFn: () => academyAdmissionsApi.confirm(fileName, rows),
    onSuccess: async (result) => {
      setImportResult(result);
      await refresh();
      setToast({ id: Date.now(), tone: 'success', title: 'Import completed', message: `${result.summary.successCount} student${result.summary.successCount === 1 ? '' : 's'} admitted by the backend.` });
    },
    onError: (error) => setToast({ id: Date.now(), tone: 'error', title: 'Import failed', message: error instanceof Error ? error.message : 'No success was recorded.' }),
  });
  const codeMutation = useMutation({
    mutationFn: () => academyAdmissionsApi.generateCode({
      maxUses: codeUsage === 'limited' ? maxUses : null,
      expiresAt: codeExpiration === 'scheduled' ? new Date(expiresAt).toISOString() : null,
    }),
    onSuccess: async (code) => {
      setCodeOpen(false);
      await queryClient.invalidateQueries({ queryKey: academyAdmissionKeys.codes(academyId ?? 'unresolved') });
      setToast({ id: Date.now(), tone: 'success', title: 'Admission code generated', message: `${code.code} is now active for ${academy?.name ?? 'this Academy'}.` });
    },
    onError: (error) => setToast({ id: Date.now(), tone: 'error', title: 'Code generation failed', message: error instanceof Error ? error.message : 'The server rejected the request.' }),
  });

  const updateCodeMutation = useMutation({
    mutationFn: ({ codeId, payload }: { codeId: string; payload: { maxUses?: number | null; expiresAt?: string | null; status?: 'ACTIVE' | 'REVOKED' } }) =>
      academyAdmissionsApi.updateCode(codeId, payload),
    onSuccess: async (_, variables) => {
      setEditingCode(null);
      await queryClient.invalidateQueries({ queryKey: academyAdmissionKeys.codes(academyId ?? 'unresolved') });
      const actionText = variables.payload.status === 'ACTIVE' ? 'enabled' : variables.payload.status === 'REVOKED' ? 'disabled' : 'updated';
      setToast({ id: Date.now(), tone: 'success', title: 'Admission code updated', message: `Admission code has been ${actionText}.` });
    },
    onError: (error) => setToast({ id: Date.now(), tone: 'error', title: 'Update failed', message: error instanceof Error ? error.message : 'The server rejected the update.' }),
  });

  const deleteCodeMutation = useMutation({
    mutationFn: (codeId: string) => academyAdmissionsApi.deleteCode(codeId),
    onSuccess: async () => {
      setPendingDelete(null);
      await queryClient.invalidateQueries({ queryKey: academyAdmissionKeys.codes(academyId ?? 'unresolved') });
      setToast({ id: Date.now(), tone: 'success', title: 'Admission code deleted', message: 'The admission code has been removed.' });
    },
    onError: (error) => setToast({ id: Date.now(), tone: 'error', title: 'Delete failed', message: error instanceof Error ? error.message : 'The server rejected the delete operation.' }),
  });

  useEffect(() => {
    if (!contextMenu) return undefined;
    const handleClick = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setContextMenu(null); };
    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!academyId || !qrOpen) return undefined;
    let cancelled = false;
    let requestVersion = 0;
    let controller: AbortController | null = null;
    let rotationTimer: number | undefined;

    const rotate = async () => {
      const version = ++requestVersion;
      controller?.abort();
      controller = new AbortController();
      setQrRotationStatus((current) => current === 'active' ? 'refreshing' : 'starting');
      setQrRotationError('');
      try {
        const nextQr = await academyAdmissionsApi.generateQr(controller.signal);
        if (cancelled || version !== requestVersion) return;
        setQrImage('');
        setQr(nextQr);
        setQrRotationStatus('active');
        void queryClient.invalidateQueries({ queryKey: academyAdmissionKeys.root(academyId) });
        const rotateAfter = getAdmissionQrRotationDelay(nextQr);
        rotationTimer = window.setTimeout(() => { void rotate(); }, rotateAfter);
      } catch (error) {
        if (cancelled || version !== requestVersion) return;
        setQr(null);
        setQrImage('');
        setSecondsRemaining(0);
        setQrRotationStatus('paused');
        setQrRotationError(error instanceof Error ? error.message : 'The backend could not rotate the QR.');
        rotationTimer = window.setTimeout(() => { void rotate(); }, 3_000);
      }
    };

    void rotate();
    return () => {
      cancelled = true;
      requestVersion += 1;
      controller?.abort();
      if (rotationTimer !== undefined) window.clearTimeout(rotationTimer);
    };
  }, [academyId, qrRestartKey, qrOpen, queryClient]);

  useEffect(() => {
    if (!qr || !qrOpen) { setQrImage(''); setSecondsRemaining(0); return; }
    let active = true;
    void QRCode.toDataURL(qr.qrToken, { width: 280, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#10203d', light: '#ffffff' } })
      .then((image) => { if (active) setQrImage(image); })
      .catch(() => { if (active) setToast({ id: Date.now(), tone: 'error', title: 'QR rendering failed', message: 'The secure token was created, but its QR image could not be rendered.' }); });
    const update = () => setSecondsRemaining(Math.max(0, Math.ceil((new Date(qr.expiresAt).getTime() - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 200);
    return () => { active = false; window.clearInterval(timer); };
  }, [qr, qrOpen]);

  const validationIssues = useMemo(() => validation ? [
    ...validation.invalidRows,
    ...validation.duplicateRows,
    ...validation.alreadyAdmittedRows,
    ...validation.conflictRows,
  ] : [], [validation]);

  const openImport = () => {
    setRows([]); setValidation(null); setImportResult(null); setFileName(''); setImportOpen(true);
  };
  const chooseFile = async (file?: File) => {
    if (!file) return;
    try {
      if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') throw new Error('Upload a CSV file created from the supported template.');
      const parsed = parseAdmissionCsv(await file.text());
      setFileName(file.name); setRows(parsed); setImportResult(null); setValidation(null);
      validateMutation.mutate(parsed);
    } catch (error) {
      setRows([]); setValidation(null);
      setToast({ id: Date.now(), tone: 'error', title: 'CSV could not be read', message: error instanceof Error ? error.message : 'Use the supported CSV template.' });
    }
  };
  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setToast({ id: Date.now(), tone: 'success', title: `${label} copied`, message: 'Ready to share securely.' });
    } catch {
      setToast({ id: Date.now(), tone: 'error', title: 'Copy unavailable', message: 'Select and copy the value manually.' });
    }
  };

  const openEditCode = (code: AdmissionCode) => {
    setEditingCode(code);
    setEditUsage(code.maxUses !== null ? 'limited' : 'unlimited');
    setEditMaxUses(code.maxUses ?? 25);
    setEditExpiration(code.expiresAt ? 'scheduled' : 'never');
    setEditExpiresAt(code.expiresAt ? new Date(code.expiresAt).toISOString().slice(0, 16) : defaultExpiry());
  };

  const rawHistory = dashboard.data?.history ?? [];
  const sortedHistory = useMemo(() => {
    return [...rawHistory].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [rawHistory]);
  const historyTotalPages = Math.ceil(sortedHistory.length / PAGE_LIMIT) || 1;
  const paginatedHistory = useMemo(() => {
    const start = (historyPage - 1) * PAGE_LIMIT;
    return sortedHistory.slice(start, start + PAGE_LIMIT);
  }, [sortedHistory, historyPage]);

  const rawCodes = codes.data ?? [];
  const sortedCodes = useMemo(() => {
    return [...rawCodes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [rawCodes]);
  const codesTotalPages = Math.ceil(sortedCodes.length / PAGE_LIMIT) || 1;
  const paginatedCodes = useMemo(() => {
    const start = (codesPage - 1) * PAGE_LIMIT;
    return sortedCodes.slice(start, start + PAGE_LIMIT);
  }, [sortedCodes, codesPage]);

  if (dashboard.isLoading || codes.isLoading) return <AdminSkeleton label="Loading Academy admissions" rows={7} variant="detail" />;
  if (dashboard.error) return <AdminEmptyState title="Admissions unavailable" description={dashboard.error instanceof Error ? dashboard.error.message : 'The server could not load admissions.'} />;
  const summary = dashboard.data!.summary;

  const stats: Array<{ label: string; value: number; Icon: LucideIcon }> = [
    { label: 'Recent (30 days)', value: summary.recentCount, Icon: Clock3 },
    { label: 'Pending', value: summary.pendingCount, Icon: UsersRound },
    { label: 'Successful', value: summary.successfulCount, Icon: CheckCircle2 },
    { label: 'Failed', value: summary.failedCount, Icon: XCircle },
    { label: 'Duplicates', value: summary.duplicateCount, Icon: TriangleAlert },
  ];

  return (
    <div className="pf-admin-page pf-academy-admissions">
      {toast ? <AdminToast toast={toast} onDismiss={() => setToast(null)} /> : null}
      <AdminPageHeader eyebrow="ACADEMY ENROLLMENT" title="Admissions" description={`Admit students into ${academy?.name ?? 'your Academy'}. The backend determines the Academy for every operation.`} />

      <section className="pf-admission-methods" aria-label="Admission methods">
        <article className="pf-admin-table-card pf-admin-card pf-admission-method">
          <span><FileSpreadsheet size={22} /></span>
          <div>
            <p>BULK IMPORT</p>
            <h2>Import students</h2>
            <small>Validate and admit up to 1,000 students using the supported CSV template.</small>
          </div>
          <button className="pf-admin-button pf-admin-button--primary" type="button" onClick={openImport}>
            <Upload size={16} /> Import Students
          </button>
        </article>

        <article className="pf-admin-table-card pf-admin-card pf-admission-method">
          <span><QrCode size={22} /></span>
          <div>
            <p>10-SECOND QR</p>
            <h2>Rotating admission QR</h2>
            <small>The backend issues an opaque, single-use token and invalidates the previous QR every cycle.</small>
          </div>
          <button
            className={`pf-admin-button ${qrOpen && qrRotationStatus !== 'paused' ? 'pf-admin-button--quiet' : 'pf-admin-button--primary'}`}
            type="button"
            onClick={() => {
              if (qrRotationStatus === 'paused') {
                setQrRestartKey((v) => v + 1);
              } else if (qrOpen) {
                setQrOpen(false);
              } else {
                setQrOpen(true);
                setQrRestartKey((v) => v + 1);
              }
            }}
          >
            {qrRotationStatus === 'paused' ? <QrCode size={16} /> : qrOpen ? <X size={16} /> : <QrCode size={16} />}
            {qrRotationStatus === 'paused' ? 'Retry now' : qrOpen ? 'Close' : 'Generate QR'}
          </button>
        </article>

        <article className="pf-admin-table-card pf-admin-card pf-admission-method">
          <span><KeyRound size={22} /></span>
          <div>
            <p>ADMISSION CODE</p>
            <h2>Shareable Academy code</h2>
            <small>Create a limited or unlimited code. Only the backend resolves the owning Academy.</small>
          </div>
          <button
            className="pf-admin-button pf-admin-button--primary"
            type="button"
            onClick={() => {
              setCodeUsage('unlimited');
              setMaxUses(25);
              setCodeExpiration('never');
              setExpiresAt(defaultExpiry());
              setCodeOpen(true);
            }}
          >
            <KeyRound size={16} /> Generate Code
          </button>
        </article>
      </section>

      {qrOpen && (
        <section className={`pf-admin-table-card pf-admission-qr ${qrRotationStatus === 'paused' ? 'is-paused' : ''}`} aria-live="polite">
          <div className="pf-admission-qr__image">
            {qr && qrImage && secondsRemaining > 0 ? (
              <img src={qrImage} alt={`Admission QR for ${academy?.name ?? 'this Academy'}`} />
            ) : (
              <span>
                {qrRotationStatus === 'paused' ? (
                  <><TriangleAlert size={28} /> QR paused</>
                ) : (
                  <><QrCode size={28} /> Preparing secure QR…</>
                )}
              </span>
            )}
          </div>
          <div>
            <p className="pf-admin-eyebrow">SCAN TO JOIN</p>
            <h2>{academy?.name ?? 'Academy'} Admission QR</h2>
            {qrRotationStatus === 'paused' ? (
              <>
                <strong className="is-paused">Connection lost — QR paused</strong>
                <p>{qrRotationError || 'The QR will resume when the local backend is reachable.'}</p>
              </>
            ) : (
              <>
                <strong>{qrRotationStatus === 'refreshing' || secondsRemaining === 0 ? 'Refreshing secure QR…' : `Refreshes in ${secondsRemaining}s`}</strong>
                <p>The QR contains only an opaque token. Expiration, rotation, and single-use enforcement are controlled by the backend.</p>
              </>
            )}
          </div>
        </section>
      )}

      <section className="pf-admin-stat-grid pf-admission-stats" aria-label="Admission statistics">
        {stats.map(({ label, value, Icon }) => (
          <article className="pf-admin-table-card pf-admin-card pf-admin-metric" key={label}>
            <span className="pf-admin-metric__icon"><Icon size={18} /></span>
            <div><p>{label}</p><strong>{value}</strong></div>
          </article>
        ))}
      </section>

      <section className="pf-admin-table-card">
        <div className="pf-admin-table-card__header">
          <div><h2>Admission history</h2><p>Durable Academy-owned results from all three admission methods.</p></div>
          <ShieldCheck size={19} />
        </div>
        {!sortedHistory.length ? (
          <AdminEmptyState icon={<UserPlus size={24} />} title="No admissions yet" description="Use one of the three admission methods above. No sample or copied data is shown." />
        ) : (
          <>
            <div className="pf-admin-table-scroll">
              <table className="pf-admin-table">
                <thead>
                  <tr><th>STUDENT</th><th>METHOD</th><th>STATUS</th><th>CREATED BY</th><th>CREATED</th><th>COMPLETED</th><th>DETAIL</th></tr>
                </thead>
                <tbody>
                  {paginatedHistory.map((record) => (
                    <tr key={record.id}>
                      <td><strong>{record.studentName || 'Unnamed student'}</strong><small>{record.email}</small></td>
                      <td>{methodLabel(record.method)}</td>
                      <td><AdminStatusBadge tone={statusTone(record.status)}>{record.status.replace('_', ' ')}</AdminStatusBadge></td>
                      <td>{record.createdBy?.fullName ?? record.createdBy?.email ?? 'System'}</td>
                      <td>{formatDate(record.createdAt)}</td>
                      <td>{formatDate(record.completedAt)}</td>
                      <td>{record.failureReason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ReadOnlyPagination
              page={historyPage}
              totalPages={historyTotalPages}
              total={sortedHistory.length}
              pageSize={PAGE_LIMIT}
              onPageChange={setHistoryPage}
              noun="admissions"
            />
          </>
        )}
      </section>

      <section className="pf-admin-table-card">
        <div className="pf-admin-table-card__header">
          <div><h2>Admission codes</h2><p>Active and historical codes for this Academy only. Right-click any row for options.</p></div>
        </div>
        {!sortedCodes.length ? (
          <AdminEmptyState compact icon={<KeyRound size={22} />} title="No admission codes" description="Generate an admission code above." />
        ) : (
          <>
            <div className="pf-admin-table-scroll">
              <table className="pf-admin-table">
                <thead>
                  <tr><th>CODE</th><th>USAGE</th><th>STATUS</th><th>EXPIRES</th><th>CREATED BY</th><th>ACTIONS</th></tr>
                </thead>
                <tbody>
                  {paginatedCodes.map((code) => (
                    <tr
                      key={code.id}
                      className="pf-admin-code-row"
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({ x: e.clientX, y: e.clientY, code });
                      }}
                    >
                      <td>
                        <button className="pf-admission-code" type="button" onClick={() => void copy(code.code, 'Admission code')}>
                          {code.code} <Copy size={14} />
                        </button>
                      </td>
                      <td>{code.currentUses} / {code.maxUses ?? 'Unlimited'}</td>
                      <td><AdminStatusBadge tone={statusTone(code.status)}>{code.status}</AdminStatusBadge></td>
                      <td>{code.expiresAt ? formatDate(code.expiresAt) : 'Never'}</td>
                      <td>{code.createdBy?.fullName || code.createdBy?.email || 'System'}</td>
                      <td>
                        <div className="pf-code-actions-cell">
                          <button
                            className="pf-admin-button pf-admin-button--quiet"
                            type="button"
                            disabled={updateCodeMutation.isPending}
                            onClick={() => updateCodeMutation.mutate({ codeId: code.id, payload: { status: code.status === 'ACTIVE' ? 'REVOKED' : 'ACTIVE' } })}
                          >
                            {code.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            className="pf-admin-button pf-admin-button--quiet"
                            type="button"
                            onClick={() => openEditCode(code)}
                          >
                            Edit
                          </button>
                          <button
                            className="pf-admin-button pf-admin-button--quiet"
                            type="button"
                            style={{ color: '#dc2626' }}
                            onClick={() => setPendingDelete(code)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ReadOnlyPagination
              page={codesPage}
              totalPages={codesTotalPages}
              total={sortedCodes.length}
              pageSize={PAGE_LIMIT}
              onPageChange={setCodesPage}
              noun="codes"
            />
          </>
        )}
      </section>

      {contextMenu && (
        <div
          className="pf-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="pf-context-menu__item"
            onClick={() => {
              const c = contextMenu.code;
              setContextMenu(null);
              updateCodeMutation.mutate({ codeId: c.id, payload: { status: c.status === 'ACTIVE' ? 'REVOKED' : 'ACTIVE' } });
            }}
          >
            <Ban size={15} /> {contextMenu.code.status === 'ACTIVE' ? 'Disable code' : 'Enable code'}
          </button>
          <button
            type="button"
            className="pf-context-menu__item"
            onClick={() => {
              const c = contextMenu.code;
              setContextMenu(null);
              openEditCode(c);
            }}
          >
            <Edit3 size={15} /> Edit code
          </button>
          <button
            type="button"
            className="pf-context-menu__item pf-context-menu__item--danger"
            onClick={() => {
              const c = contextMenu.code;
              setContextMenu(null);
              setPendingDelete(c);
            }}
          >
            <Trash2 size={15} /> Delete code
          </button>
        </div>
      )}

      <AdminDialog
        open={importOpen}
        onClose={() => !confirmMutation.isPending && !validateMutation.isPending && setImportOpen(false)}
        title="Bulk import students"
        description="The browser previews the CSV; the backend independently validates every row before any membership is created."
        size="wide"
        footer={
          <>
            <button className="pf-admin-button pf-admin-button--quiet" type="button" disabled={confirmMutation.isPending} onClick={() => setImportOpen(false)}>Close</button>
            {validation && !importResult ? (
              <button className="pf-admin-button pf-admin-button--primary" type="button" disabled={confirmMutation.isPending || validation.validRows.length === 0} onClick={() => confirmMutation.mutate()}>
                {confirmMutation.isPending ? 'Importing…' : `Confirm ${validation.validRows.length} valid row${validation.validRows.length === 1 ? '' : 's'}`}
              </button>
            ) : null}
          </>
        }
      >
        <div className="pf-admission-import-actions">
          <button className="pf-admin-button pf-admin-button--secondary" type="button" onClick={downloadAdmissionTemplate}><Download size={15} /> Download CSV Template</button>
          <input ref={fileInput} hidden type="file" accept=".csv,text/csv" onChange={(event) => { void chooseFile(event.target.files?.[0]); event.currentTarget.value = ''; }} />
          <button className="pf-admin-button pf-admin-button--primary" type="button" disabled={validateMutation.isPending || confirmMutation.isPending} onClick={() => fileInput.current?.click()}><Upload size={15} /> {fileName ? 'Choose another CSV' : 'Upload CSV'}</button>
          {fileName ? <span>{fileName} · {rows.length} row{rows.length === 1 ? '' : 's'}</span> : null}
        </div>
        {validateMutation.isPending ? <AdminSkeleton rows={4} label="Validating CSV on the server" /> : null}
        {validation ? (
          <>
            <div className="pf-admission-validation">
              <span>Valid <strong>{validation.validRows.length}</strong></span>
              <span>Already enrolled <strong>{validation.alreadyAdmittedRows.length}</strong></span>
              <span>Duplicates <strong>{validation.duplicateRows.length}</strong></span>
              <span>Invalid <strong>{validation.invalidRows.length}</strong></span>
              <span>Conflicts <strong>{validation.conflictRows.length}</strong></span>
            </div>
            <div className="pf-admin-table-scroll pf-admission-preview">
              <table className="pf-admin-table">
                <thead><tr><th>ROW</th><th>NAME</th><th>EMAIL</th><th>PHONE</th><th>RESULT</th></tr></thead>
                <tbody>
                  {validation.validRows.slice(0, 100).map((row) => <tr key={`valid-${row.sNo}`}><td>{row.sNo}</td><td>{row.name}</td><td>{row.email}</td><td>{row.phone || '—'}</td><td><AdminStatusBadge tone="success">VALID</AdminStatusBadge></td></tr>)}
                  {validationIssues.slice(0, 100).map((row, index) => <tr key={`issue-${row.sNo}-${index}`}><td>{row.sNo}</td><td>{row.name || '—'}</td><td>{row.email || '—'}</td><td>{row.phone || '—'}</td><td>{row.reason}</td></tr>)}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
        {importResult ? (
          <div className="pf-admission-result">
            <CheckCircle2 size={24} />
            <div>
              <h3>Import completed</h3>
              <p>Total {importResult.summary.total} · Successful {importResult.summary.successCount} · Already enrolled {importResult.summary.alreadyAdmittedCount} · Duplicates {importResult.summary.duplicateCount} · Invalid {importResult.summary.invalidCount} · Conflicts {importResult.summary.conflictCount}</p>
              <small>Email delivery: provider not configured. Database membership results above are authoritative.</small>
            </div>
          </div>
        ) : null}
      </AdminDialog>

      <AdminDialog
        open={codeOpen}
        onClose={() => !codeMutation.isPending && setCodeOpen(false)}
        title="Generate Admission Code"
        description={`The backend will generate a globally unique code for ${academy?.name ?? 'this Academy'}.`}
        size="small"
        footer={
          <>
            <button className="pf-admin-button pf-admin-button--quiet" type="button" disabled={codeMutation.isPending} onClick={() => setCodeOpen(false)}>Cancel</button>
            <button
              className="pf-admin-button pf-admin-button--primary"
              type="button"
              disabled={codeMutation.isPending || (codeUsage === 'limited' && (maxUses < 1 || maxUses > 100000)) || (codeExpiration === 'scheduled' && (!expiresAt || new Date(expiresAt).getTime() <= Date.now()))}
              onClick={() => codeMutation.mutate()}
            >
              {codeMutation.isPending ? 'Generating…' : 'Generate Code'}
            </button>
          </>
        }
      >
        <div className="pf-admission-code-options">
          <fieldset>
            <legend>Usage</legend>
            <label><input type="radio" name="admission-code-usage" checked={codeUsage === 'unlimited'} onChange={() => setCodeUsage('unlimited')} /> Unlimited</label>
            <label><input type="radio" name="admission-code-usage" checked={codeUsage === 'limited'} onChange={() => setCodeUsage('limited')} /> Limited</label>
          </fieldset>
          {codeUsage === 'limited' ? (
            <label className="pf-admin-field">
              <span>Maximum uses</span>
              <input className="pf-admin-input" type="number" min={1} max={100000} value={maxUses} onChange={(event) => setMaxUses(Number(event.target.value))} />
            </label>
          ) : null}
          <fieldset>
            <legend>Expiration</legend>
            <label><input type="radio" name="admission-code-expiration" checked={codeExpiration === 'never'} onChange={() => setCodeExpiration('never')} /> Never expires</label>
            <label><input type="radio" name="admission-code-expiration" checked={codeExpiration === 'scheduled'} onChange={() => setCodeExpiration('scheduled')} /> Expires on</label>
          </fieldset>
          {codeExpiration === 'scheduled' ? (
            <label className="pf-admin-field">
              <span>Expiration date/time</span>
              <AdminDateTimePicker min={new Date(Date.now() + 60_000).toISOString()} value={expiresAt || null} onChange={setExpiresAt} placeholder="Choose expiration date and time" />
            </label>
          ) : null}
          <p className="pf-admission-code-options__note">The code is generated automatically. Academy identity is never embedded in or accepted from the client.</p>
        </div>
      </AdminDialog>

      <AdminDialog
        open={editingCode !== null}
        onClose={() => !updateCodeMutation.isPending && setEditingCode(null)}
        title="Edit Admission Code"
        description={`Update limit and expiration settings for code ${editingCode?.code ?? ''}.`}
        size="small"
        footer={
          <>
            <button className="pf-admin-button pf-admin-button--quiet" type="button" disabled={updateCodeMutation.isPending} onClick={() => setEditingCode(null)}>Cancel</button>
            <button
              className="pf-admin-button pf-admin-button--primary"
              type="button"
              disabled={
                updateCodeMutation.isPending ||
                (editUsage === 'limited' && (editMaxUses < 1 || editMaxUses > 100000)) ||
                (editExpiration === 'scheduled' && (!editExpiresAt || new Date(editExpiresAt).getTime() <= Date.now()))
              }
              onClick={() => {
                if (!editingCode) return;
                updateCodeMutation.mutate({
                  codeId: editingCode.id,
                  payload: {
                    maxUses: editUsage === 'limited' ? editMaxUses : null,
                    expiresAt: editExpiration === 'scheduled' ? new Date(editExpiresAt).toISOString() : null,
                  },
                });
              }}
            >
              {updateCodeMutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </>
        }
      >
        <div className="pf-admission-code-options">
          <fieldset>
            <legend>Usage</legend>
            <label><input type="radio" name="edit-admission-code-usage" checked={editUsage === 'unlimited'} onChange={() => setEditUsage('unlimited')} /> Unlimited</label>
            <label><input type="radio" name="edit-admission-code-usage" checked={editUsage === 'limited'} onChange={() => setEditUsage('limited')} /> Limited</label>
          </fieldset>
          {editUsage === 'limited' ? (
            <label className="pf-admin-field">
              <span>Maximum uses</span>
              <input className="pf-admin-input" type="number" min={1} max={100000} value={editMaxUses} onChange={(event) => setEditMaxUses(Number(event.target.value))} />
            </label>
          ) : null}
          <fieldset>
            <legend>Expiration</legend>
            <label><input type="radio" name="edit-admission-code-expiration" checked={editExpiration === 'never'} onChange={() => setEditExpiration('never')} /> Never expires</label>
            <label><input type="radio" name="edit-admission-code-expiration" checked={editExpiration === 'scheduled'} onChange={() => setEditExpiration('scheduled')} /> Expires on</label>
          </fieldset>
          {editExpiration === 'scheduled' ? (
            <label className="pf-admin-field">
              <span>Expiration date/time</span>
              <AdminDateTimePicker min={new Date(Date.now() + 60_000).toISOString()} value={editExpiresAt || null} onChange={setEditExpiresAt} placeholder="Choose expiration date and time" />
            </label>
          ) : null}
        </div>
      </AdminDialog>

      <AdminDialog
        open={pendingDelete !== null}
        onClose={() => !deleteCodeMutation.isPending && setPendingDelete(null)}
        title="Delete Admission Code"
        description={`Are you sure you want to delete admission code ${pendingDelete?.code ?? ''}? This action cannot be undone.`}
        size="small"
        footer={
          <>
            <button className="pf-admin-button pf-admin-button--quiet" type="button" disabled={deleteCodeMutation.isPending} onClick={() => setPendingDelete(null)}>Cancel</button>
            <button
              className="pf-admin-button pf-admin-button--primary"
              type="button"
              style={{ background: '#dc2626', borderColor: '#dc2626' }}
              disabled={deleteCodeMutation.isPending}
              onClick={() => {
                if (pendingDelete) deleteCodeMutation.mutate(pendingDelete.id);
              }}
            >
              {deleteCodeMutation.isPending ? 'Deleting…' : 'Delete Code'}
            </button>
          </>
        }
      >
        <p style={{ margin: 0, color: '#64748b', fontSize: '13px', lineHeight: 1.5 }}>
          Deleting this code removes it permanently from the Academy system. Existing students who already used this code will remain admitted.
        </p>
      </AdminDialog>
    </div>
  );
};

export default AcademyAdmissionsPage;
