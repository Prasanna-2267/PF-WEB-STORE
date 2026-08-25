import React, { useState } from 'react';
import {
  QrCode,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Building2,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Camera,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '@/lib/api/client';
import { queryClient } from '@/lib/queryClient';
import { ROUTES } from '@/config/routes';
import { useAuthStore } from '@/app/store/useAuthStore';

export interface StudentAdmissionViewProps {
  onSuccess?: (academyId: string) => void;
}

export const StudentAdmissionView: React.FC<StudentAdmissionViewProps> = ({ onSuccess }) => {
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.user?.id);

  const [activeMode, setActiveMode] = useState<'qr' | 'code'>('code');
  const [codeInputValue, setCodeInputValue] = useState('');
  const [qrTokenInputValue, setQrTokenInputValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{ academyName: string; message: string } | null>(null);
  type ClaimResult = { status: 'SUCCESS' | 'ALREADY_ADMITTED'; academyId: string; academyName: string };

  // --- CLAIM ADMISSION CODE ---
  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeInputValue.trim()) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const data = await apiRequest<ClaimResult>('/api/student/admissions/codes/claim', {
        method: 'POST',
        body: { code: codeInputValue.trim().toUpperCase() },
      });

      if (data.status === 'ALREADY_ADMITTED') {
        setSuccessResult({
          academyName: data.academyName || 'Academy',
          message: 'You are already an enrolled member of this Academy.',
        });
      } else {
        setSuccessResult({
          academyName: data.academyName || 'Academy',
          message: 'Successfully admitted! Welcome to your new Academy.',
        });
      }

      if (data.academyId) {
        await queryClient.invalidateQueries({ queryKey: ['student', userId] });
        onSuccess?.(data.academyId);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to claim the admission code.');
    } finally {
      setSubmitting(false);
    }
  };

  // --- CLAIM QR SESSION ---
  const handleQrSubmit = async (tokenStr: string) => {
    if (!tokenStr.trim()) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const data = await apiRequest<ClaimResult>('/api/student/admissions/qr/claim', {
        method: 'POST',
        body: { qrToken: tokenStr.trim() },
      });

      setSuccessResult({
        academyName: data.academyName || 'Academy',
        message: 'QR Code verified! You have joined the Academy successfully.',
      });

      if (data.academyId) {
        await queryClient.invalidateQueries({ queryKey: ['student', userId] });
        onSuccess?.(data.academyId);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to claim the QR admission.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Container Card */}
      <div
        style={{
          background: 'var(--admin-panel-solid, #ffffff)',
          border: '1px solid var(--admin-line, #e2e8f0)',
          borderRadius: '20px',
          padding: '32px 24px',
          boxShadow: 'var(--admin-shadow, 0 10px 25px -5px rgba(0,0,0,0.05))',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: 'var(--admin-accent-soft, rgba(99,102,241,0.1))',
            color: 'var(--admin-accent-ink, #4f46e5)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
          }}
        >
          <Building2 size={24} />
        </div>

        <h2 style={{ fontSize: '20px', fontWeight: 750, margin: '0 0 6px 0' }}>Join Your Academy</h2>
        <p style={{ fontSize: '13px', color: 'var(--admin-muted, #64748b)', marginBottom: '24px' }}>
          Enter an admission code from your institute or scan an active Academy QR code.
        </p>

        {/* Mode Selector */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            padding: '4px',
            borderRadius: '12px',
            background: 'var(--admin-panel-soft, #f8fafc)',
            border: '1px solid var(--admin-line, #e2e8f0)',
            marginBottom: '24px',
          }}
        >
          <button
            type="button"
            onClick={() => { setActiveMode('code'); setErrorMessage(null); }}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '8px',
              border: 'none',
              background: activeMode === 'code' ? '#ffffff' : 'transparent',
              color: activeMode === 'code' ? '#0f172a' : '#64748b',
              fontWeight: activeMode === 'code' ? 650 : 500,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: activeMode === 'code' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
            }}
          >
            <KeyRound size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
            Admission Code
          </button>

          <button
            type="button"
            onClick={() => { setActiveMode('qr'); setErrorMessage(null); }}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '8px',
              border: 'none',
              background: activeMode === 'qr' ? '#ffffff' : 'transparent',
              color: activeMode === 'qr' ? '#0f172a' : '#64748b',
              fontWeight: activeMode === 'qr' ? 650 : 500,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: activeMode === 'qr' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
            }}
          >
            <QrCode size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
            Scan QR
          </button>
        </div>

        {/* Success View */}
        {successResult ? (
          <div style={{ padding: '16px 0' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(34, 197, 94, 0.15)',
                color: '#16a34a',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <CheckCircle2 size={32} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 6px 0' }}>{successResult.academyName}</h3>
            <p style={{ fontSize: '13px', color: '#16a34a', marginBottom: '20px' }}>{successResult.message}</p>
            <button
              type="button"
              className="pf-admin-button"
              style={{ width: '100%' }}
              onClick={() => navigate(ROUTES.STORE_PROFILE, { replace: true })}
            >
              Enter Learning Portal <ArrowRight size={16} />
            </button>
          </div>
        ) : activeMode === 'code' ? (
          /* Admission Code Form */
          <form onSubmit={handleCodeSubmit} style={{ display: 'grid', gap: '16px', textAlign: 'left' }}>
            <div>
              <label htmlFor="student-admission-code" style={{ display: 'block', fontSize: '12px', fontWeight: 650, color: '#334155', marginBottom: '6px' }}>
                8-Character Admission Code
              </label>
              <input
                id="student-admission-code"
                type="text"
                placeholder="e.g. ABC7K9X2"
                maxLength={16}
                value={codeInputValue}
                onChange={(e) => setCodeInputValue(e.target.value.toUpperCase())}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1px solid var(--admin-line, #cbd5e1)',
                  fontSize: '16px',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  fontFamily: 'monospace',
                  textAlign: 'center',
                  textTransform: 'uppercase',
                }}
                required
              />
            </div>

            {errorMessage && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#dc2626',
                  fontSize: '12px',
                }}
              >
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              className="pf-admin-button"
              disabled={submitting || !codeInputValue.trim()}
              style={{ width: '100%', padding: '12px', fontSize: '14px' }}
            >
              {submitting ? 'Verifying Code...' : 'Join Academy'}
            </button>
          </form>
        ) : (
          /* QR Code Scanner Form */
          <div style={{ display: 'grid', gap: '16px' }}>
            <div
              style={{
                border: '2px dashed var(--admin-line, #cbd5e1)',
                borderRadius: '16px',
                padding: '32px 16px',
                background: 'var(--admin-panel-soft, #f8fafc)',
              }}
            >
              <Camera size={36} color="var(--admin-muted, #64748b)" style={{ marginBottom: '12px' }} />
              <h4 style={{ fontSize: '14px', fontWeight: 650, margin: '0 0 4px 0' }}>Scan QR Code</h4>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 16px 0' }}>
                Point your device camera at the projected Academy QR code.
              </p>

              <button
                type="button"
                className="pf-admin-button"
                disabled
                style={{ fontSize: '13px' }}
              >
                Camera Scanner Not Connected
              </button>
            </div>

            <div style={{ textAlign: 'left' }}>
              <label htmlFor="student-admission-qr-token" style={{ display: 'block', fontSize: '12px', fontWeight: 650, color: '#334155', marginBottom: '6px' }}>
                Or paste QR Payload Token
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  id="student-admission-qr-token"
                  type="text"
                  placeholder="PFQR...."
                  value={qrTokenInputValue}
                  onChange={(e) => setQrTokenInputValue(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid var(--admin-line, #cbd5e1)',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                  }}
                />
                <button
                  type="button"
                  className="pf-admin-button"
                  disabled={submitting || !qrTokenInputValue.trim()}
                  onClick={() => handleQrSubmit(qrTokenInputValue)}
                  style={{ padding: '10px 16px', fontSize: '12px' }}
                >
                  Claim QR
                </button>
              </div>
            </div>

            {errorMessage && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#dc2626',
                  fontSize: '12px',
                  textAlign: 'left',
                }}
              >
                <span>{errorMessage}</span>
                <button
                  type="button"
                  onClick={() => setErrorMessage(null)}
                  style={{ border: 'none', background: 'transparent', color: '#dc2626', fontWeight: 700, cursor: 'pointer' }}
                >
                  Scan Again
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default StudentAdmissionView;
