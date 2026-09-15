import { useEffect, useState } from 'react';
import { Eye, EyeOff, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { apiRequest } from '@/lib/api/client';
import { AdminDialog, AdminStatusBadge, AdminToast, type AdminToastData } from './AdminUi';

type SuperAdmin = {
  id: string;
  fullName: string;
  email: string;
  status: 'ACTIVE' | 'DISABLED';
  createdAt: string;
  lastLoginAt: string | null;
};

async function listSuperAdmins() {
  return apiRequest<{ items: SuperAdmin[] }>('/api/admin/super-admins');
}

export function SuperAdminManagementDialog({ open, onClose, currentUserId }: { open: boolean; onClose: () => void; currentUserId?: string }) {
  const [items, setItems] = useState<SuperAdmin[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SuperAdmin | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<AdminToastData | null>(null);

  const refresh = async () => {
    setLoading(true); setError('');
    try { setItems((await listSuperAdmins()).items); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load Super Admin accounts.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (open) void refresh(); }, [open]);

  const close = () => {
    if (saving) return;
    setAdding(false); setDeleteTarget(null); setError(''); setPassword(''); onClose();
  };

  const create = async () => {
    setSaving(true); setError('');
    try {
      await apiRequest('/api/admin/super-admins', { method: 'POST', body: { fullName, email, password } });
      setFullName(''); setEmail(''); setPassword(''); setAdding(false);
      await refresh();
      setToast({ id: crypto.randomUUID(), tone: 'success', title: 'Super Admin added', message: 'The new account can now sign in with its configured credentials.' });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to add the Super Admin.'); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setSaving(true); setError('');
    try {
      await apiRequest(`/api/admin/super-admins/${deleteTarget.id}`, { method: 'DELETE', body: { confirmation: 'DELETE SUPER ADMIN' } });
      setDeleteTarget(null); await refresh();
      setToast({ id: crypto.randomUUID(), tone: 'success', title: 'Super Admin deleted', message: 'Access and active sessions were revoked.' });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to delete the Super Admin.'); }
    finally { setSaving(false); }
  };

  return <>
    <AdminDialog open={open} onClose={close} size="large" title={deleteTarget ? 'Delete Super Admin' : adding ? 'Add Super Admin' : 'Super Admin management'} description={deleteTarget ? `Remove access for ${deleteTarget.email}.` : adding ? 'Create a protected Super Admin sign-in.' : 'Manage the accounts authorized to operate the Admin Console.'} icon={<ShieldCheck size={20} />} footer={deleteTarget ? <><button type="button" className="pf-admin-button pf-admin-button--secondary" disabled={saving} onClick={() => setDeleteTarget(null)}>Cancel</button><button type="button" className="pf-admin-button pf-admin-button--danger" disabled={saving} onClick={() => void remove()}>{saving ? 'Deleting…' : 'Delete Super Admin'}</button></> : adding ? <><button type="button" className="pf-admin-button pf-admin-button--secondary" disabled={saving} onClick={() => setAdding(false)}>Cancel</button><button type="button" className="pf-admin-button pf-admin-button--primary" disabled={saving || fullName.trim().length < 2 || !email.includes('@') || password.length < 12} onClick={() => void create()}>{saving ? 'Adding…' : 'Add Super Admin'}</button></> : <button type="button" className="pf-admin-button pf-admin-button--secondary" onClick={close}>Close</button>}>
      {error ? <div className="pf-super-admin-error" role="alert">{error}</div> : null}
      {deleteTarget ? <div className="pf-super-admin-confirm"><Trash2 size={24} /><strong>{deleteTarget.fullName}</strong><span>{deleteTarget.email}</span><p>This disables the account and immediately revokes its active sessions. Audit history is retained.</p></div> : adding ? <div className="pf-super-admin-form"><label className="pf-admin-field"><span>Full name</span><input className="pf-admin-input" value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={120} autoComplete="name" /></label><label className="pf-admin-field"><span>Email</span><input className="pf-admin-input" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={320} type="email" autoComplete="email" /></label><label className="pf-admin-field"><span>Password</span><span className="pf-super-admin-password"><input className="pf-admin-input" value={password} onChange={(event) => setPassword(event.target.value)} maxLength={128} minLength={12} type={passwordVisible ? 'text' : 'password'} autoComplete="new-password" /><button type="button" onClick={() => setPasswordVisible((value) => !value)} aria-label={passwordVisible ? 'Hide password' : 'Show password'}>{passwordVisible ? <EyeOff size={17} /> : <Eye size={17} />}</button></span><small>Minimum 12 characters.</small></label></div> : <div className="pf-super-admin-list"><div className="pf-super-admin-list__head"><span>{items.length} Super Admin{items.length === 1 ? '' : 's'}</span><button type="button" className="pf-admin-button pf-admin-button--primary" onClick={() => { setAdding(true); setError(''); }}><Plus size={16} /> Add Super Admin</button></div>{loading ? <p className="pf-super-admin-state">Loading accounts…</p> : items.length ? items.map((item) => <div className="pf-super-admin-row" key={item.id}><span className="pf-super-admin-row__avatar">{item.fullName.trim().slice(0, 2).toUpperCase()}</span><span className="pf-super-admin-row__copy"><strong>{item.fullName}{item.id === currentUserId ? ' (You)' : ''}</strong><small>{item.email}</small><small>Added {new Date(item.createdAt).toLocaleDateString('en-IN')}</small></span><AdminStatusBadge tone={item.status === 'ACTIVE' ? 'success' : 'danger'}>{item.status}</AdminStatusBadge><button type="button" className="pf-super-admin-delete" aria-label={`Delete ${item.fullName}`} disabled={item.id === currentUserId || saving} onClick={() => setDeleteTarget(item)}><Trash2 size={17} /></button></div>) : <p className="pf-super-admin-state">No Super Admin accounts were found.</p>}</div>}
    </AdminDialog>
    <AdminToast toast={toast} onClose={() => setToast(null)} />
  </>;
}
