import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Link2, Pencil, Trash2 } from 'lucide-react';
import { apiRequest } from '@/lib/api/client';
import { AdminDialog, AdminToast } from '../AdminUi';

export interface ContentAttachedLink {
  id: string;
  contentItemId: string;
  url: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  open: boolean;
  contentId: string | null;
  contentName: string;
  apiBase: '/api/admin/content' | '/api/academy/content';
  onClose: () => void;
}

const validHttpUrl = (value: string) => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

export const ContentAttachedLinksDialog: React.FC<Props> = ({ open, contentId, contentName, apiBase, onClose }) => {
  const [links, setLinks] = useState<ContentAttachedLink[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const urlRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setEditingId(null);
    setUrl('');
    setDescription('');
    setError('');
    setNotice('');
  };

  useEffect(() => {
    if (!open || !contentId) return;
    let active = true;
    setLoading(true);
    resetForm();
    apiRequest<ContentAttachedLink[]>(`${apiBase}/${contentId}/links`)
      .then((result) => { if (active) setLinks(result); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Attached links could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [apiBase, contentId, open]);

  const submit = async () => {
    const cleanUrl = url.trim();
    const cleanDescription = description.trim();
    if (!cleanUrl) { setError('Enter a link to attach.'); urlRef.current?.focus(); return; }
    if (!validHttpUrl(cleanUrl)) { setError('Enter a valid HTTP or HTTPS link.'); urlRef.current?.focus(); return; }
    if (cleanUrl.length > 2048) { setError('The link must be 2,048 characters or fewer.'); return; }
    if (!cleanDescription) { setError('Enter a short description for learners.'); return; }
    if (cleanDescription.length > 2000) { setError('The description must be 2,000 characters or fewer.'); return; }
    if (!contentId || saving) return;
    setSaving(true);
    setError('');
    try {
      const path = editingId ? `${apiBase}/${contentId}/links/${editingId}` : `${apiBase}/${contentId}/links`;
      const saved = await apiRequest<ContentAttachedLink>(path, {
        method: editingId ? 'PATCH' : 'POST',
        body: { url: cleanUrl, description: cleanDescription },
      });
      setLinks((current) => editingId ? current.map((link) => link.id === saved.id ? saved : link) : [...current, saved]);
      const message = editingId ? 'Attached link updated.' : 'Link attached successfully.';
      resetForm();
      setNotice(message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The link could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (link: ContentAttachedLink) => {
    if (!contentId || removingId || !window.confirm('Remove this attached link?')) return;
    setRemovingId(link.id);
    setError('');
    setNotice('');
    try {
      await apiRequest(`${apiBase}/${contentId}/links/${link.id}`, { method: 'DELETE' });
      setLinks((current) => current.filter((entry) => entry.id !== link.id));
      if (editingId === link.id) resetForm();
      setNotice('Attached link removed.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The link could not be removed.');
    } finally {
      setRemovingId(null);
    }
  };

  const edit = (link: ContentAttachedLink) => {
    setEditingId(link.id);
    setUrl(link.url);
    setDescription(link.description);
    setError('');
    setNotice('');
    window.requestAnimationFrame(() => urlRef.current?.focus());
  };

  return <>
  <AdminDialog
    open={open}
    onClose={() => !saving && !removingId && onClose()}
    title={`Attach link — ${contentName}`}
    description="Add a useful external resource to this content item."
    icon={<Link2 />}
    size="small"
    initialFocusRef={urlRef}
    bodyClassName="pf-content-links-dialog"
    footer={<>
      <button className="pf-admin-button pf-admin-button--quiet" type="button" disabled={saving || Boolean(removingId)} onClick={editingId ? resetForm : onClose}>{editingId ? 'Cancel edit' : 'Close'}</button>
      <button className="pf-admin-button pf-admin-button--primary" type="button" disabled={saving || loading || Boolean(removingId)} onClick={() => void submit()}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Attach link'}</button>
    </>}
  >
    <div className="pf-content-links-form">
      <label className="pf-admin-field"><span>Link / URL</span><input ref={urlRef} className="pf-admin-input" type="url" inputMode="url" maxLength={2048} value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/resource" /></label>
      <label className="pf-admin-field"><span>Description</span><textarea className="pf-admin-input" rows={3} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Explain what the learner will find here." /></label>
      {error ? <p className="pf-content-links-error" role="alert">{error}</p> : null}
      <div className="pf-content-links-list" aria-live="polite">
        {loading ? <p className="pf-content-links-status">Loading attached links…</p> : null}
        {!loading && !links.length ? <p className="pf-content-links-status">No links attached yet.</p> : null}
        {links.map((link) => <article key={link.id} className={editingId === link.id ? 'is-editing' : ''}>
          <div><strong>{link.description}</strong><a href={link.url} target="_blank" rel="noreferrer">{link.url}<ExternalLink /></a></div>
          <div className="pf-content-links-actions"><button type="button" title="Edit link" onClick={() => edit(link)}><Pencil /></button><button type="button" title="Remove link" disabled={removingId === link.id} onClick={() => void remove(link)}><Trash2 /></button></div>
        </article>)}
      </div>
    </div>
  </AdminDialog>
  <AdminToast
    toast={notice ? { id: `attached-link-${notice}`, title: 'Content link updated', message: notice, tone: 'success' } : null}
    onDismiss={() => setNotice('')}
  />
  </>;
};
