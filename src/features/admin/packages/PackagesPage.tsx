import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Box,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  File as FileIcon,
  Files,
  Folder,
  FolderOpen,
  Layers3,
  LockKeyhole,
  PackagePlus,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/app/store/useAuthStore';
import { useCourseStore } from '@/app/store/useCourseStore';
import { contentRepository } from '@/app/store/useContentStore';
import {
  useAdminPackagesReadOnly,
  useCreateAdminPackage,
  useUpdateAdminPackage,
  useDeleteAdminPackage,
} from './adminPackagesReadOnlyApi';
import type { ContentBreadcrumb, ContentItem, ContentSearchResult } from '../content/types/content';
import type { LearningPackage, PackageInput, PackageStatus } from './types/package';
import {
  AdminDialog,
  AdminEmptyState,
  AdminPageHeader,
  AdminSkeleton,
  AdminStatusBadge,
  AdminToast,
  type AdminToastData,
} from '../AdminUi';
import { CourseSelector } from '../CourseSelector';
import './packages.css';

const ease = [0.22, 1, 0.36, 1] as const;
const rootBreadcrumb: ContentBreadcrumb = { id: null, name: 'My Flow' };

interface PackageFormState {
  title: string;
  description: string;
  price: string;
  status: PackageStatus;
  contentItemIds: string[];
}

const emptyForm = (): PackageFormState => ({
  title: '',
  description: '',
  price: '',
  status: 'draft',
  contentItemIds: [],
});

const formatCurrency = (value: number): string => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: value % 1 ? 2 : 0,
}).format(value);

const formatDate = (value: string): string => new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
}).format(new Date(value));

const formatBytes = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

const itemMap = (items: ContentItem[]): Map<string, ContentItem> => new Map(items.map((item) => [item.id, item]));

const pathForItem = (item: ContentItem, byId: Map<string, ContentItem>): ContentBreadcrumb[] => {
  const ancestors: ContentItem[] = [];
  const seen = new Set<string>();
  let current: ContentItem | undefined = item;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    ancestors.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return [rootBreadcrumb, ...ancestors.map((entry) => ({ id: entry.id, name: entry.name }))];
};

const ancestorIds = (item: ContentItem, byId: Map<string, ContentItem>): string[] => {
  const result: string[] = [];
  let parentId = item.parentId;
  while (parentId) {
    result.push(parentId);
    parentId = byId.get(parentId)?.parentId ?? null;
  }
  return result;
};

const descendantIds = (folderId: string, items: ContentItem[]): Set<string> => {
  const result = new Set<string>();
  const queue = [folderId];
  while (queue.length) {
    const parentId = queue.shift()!;
    items.forEach((item) => {
      if (item.parentId === parentId && !result.has(item.id)) {
        result.add(item.id);
        if (item.kind === 'folder') queue.push(item.id);
      }
    });
  }
  return result;
};

const summarizeSelection = (ids: string[], items: ContentItem[]) => {
  const byId = itemMap(items);
  const effective = new Set<string>();
  ids.forEach((id) => {
    const item = byId.get(id);
    if (!item) return;
    effective.add(id);
    if (item.kind === 'folder') descendantIds(item.id, items).forEach((descendantId) => effective.add(descendantId));
  });
  const effectiveItems = [...effective].map((id) => byId.get(id)).filter((item): item is ContentItem => Boolean(item));
  const totalBytes = effectiveItems.filter((item) => item.kind === 'file').reduce((sum, item) => sum + (item.size || 0), 0);
  return {
    selected: ids.length,
    files: effectiveItems.filter((item) => item.kind === 'file').length,
    folders: effectiveItems.filter((item) => item.kind === 'folder').length,
    missing: ids.filter((id) => !byId.has(id)).length,
    totalBytes,
  };
};

const statusTone = (status: PackageStatus): 'success' | 'warning' | 'neutral' => {
  if (status === 'published') return 'success';
  if (status === 'draft') return 'warning';
  return 'neutral';
};

const ContentIcon: React.FC<{ item?: ContentItem; size?: number }> = ({ item, size = 19 }) => (
  item?.kind === 'folder' ? <Folder size={size} /> : <FileIcon size={size} />
);

export const PackagesPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const userId = user?.id ?? null;

  const courseId = useCourseStore((state) => state.selections.packages);
  const courses = useCourseStore((state) => state.courses);
  const currentCourse = useMemo(() => courses.find((c) => c.id === courseId), [courses, courseId]);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PackageStatus>('all');

  const packagesQuery = useAdminPackagesReadOnly(userId, {
    page: 1,
    limit: 100,
    courseId,
    status: statusFilter,
    search: query,
  });

  const createMutation = useCreateAdminPackage(userId);
  const updateMutation = useUpdateAdminPackage(userId);
  const deleteMutation = useDeleteAdminPackage(userId);

  const packages = packagesQuery.data?.packages ?? [];
  const packageLoading = packagesQuery.isLoading;
  const packageError = packagesQuery.isError
    ? packagesQuery.error instanceof Error
      ? packagesQuery.error.message
      : 'Packages could not be loaded.'
    : null;

  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [contentLoading, setContentLoading] = useState(true);
  const [contentError, setContentError] = useState<string | null>(null);

  const [editorPackage, setEditorPackage] = useState<LearningPackage | null | undefined>(undefined);
  const [editorStep, setEditorStep] = useState<'form' | 'picker'>('form');
  const [form, setForm] = useState<PackageFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [detailsPackage, setDetailsPackage] = useState<LearningPackage | null>(null);
  const [deletePackage, setDeletePackage] = useState<LearningPackage | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<AdminToastData | null>(null);

  const [pickerFolderId, setPickerFolderId] = useState<string | null>(null);
  const [pickerItems, setPickerItems] = useState<ContentItem[]>([]);
  const [pickerBreadcrumbs, setPickerBreadcrumbs] = useState<ContentBreadcrumb[]>([rootBreadcrumb]);
  const [pickerBackStack, setPickerBackStack] = useState<Array<string | null>>([]);
  const [pickerForwardStack, setPickerForwardStack] = useState<Array<string | null>>([]);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerResults, setPickerResults] = useState<ContentSearchResult[]>([]);
  const [pickerSearching, setPickerSearching] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSelection, setPickerSelection] = useState<string[]>([]);
  const [pickerMessage, setPickerMessage] = useState<string | null>(null);

  const byId = useMemo(() => itemMap(contentItems), [contentItems]);
  const editorOpen = editorPackage !== undefined;
  const filteredPackages = packages;
  const scopedPackageCount = packages.length;
  const formSummary = useMemo(() => summarizeSelection(form.contentItemIds, contentItems), [form.contentItemIds, contentItems]);
  const pickerSummary = useMemo(() => summarizeSelection(pickerSelection, contentItems), [pickerSelection, contentItems]);

  const notify = (title: string, message?: string, tone: AdminToastData['tone'] = 'success') => {
    setToast({ id: Date.now(), title, message, tone });
  };

  const loadContent = async () => {
    setContentLoading(true);
    setContentError(null);
    try {
      setContentItems(await contentRepository.getAllItems(courseId ?? undefined));
    } catch (error) {
      setContentError(error instanceof Error ? error.message : 'The Content Library could not be loaded.');
    } finally {
      setContentLoading(false);
    }
  };

  useEffect(() => {
    if (courseId) void loadContent();
    else setContentItems([]);
  }, [courseId]);

  useEffect(() => {
    const search = pickerQuery.trim();
    if (!search) {
      setPickerResults([]);
      setPickerSearching(false);
      return undefined;
    }
    let active = true;
    setPickerSearching(true);
    const timeout = window.setTimeout(async () => {
      try {
        const results = await contentRepository.searchItems(search, courseId ?? undefined);
        if (active) setPickerResults(results);
      } finally {
        if (active) setPickerSearching(false);
      }
    }, 180);
    return () => { active = false; window.clearTimeout(timeout); };
  }, [courseId, pickerQuery]);

  const loadPickerFolder = async (folderId: string | null, history: 'push' | 'back' | 'forward' | 'replace' = 'push') => {
    setPickerLoading(true);
    setPickerMessage(null);
    const previous = pickerFolderId;
    try {
      const [children, breadcrumbs] = await Promise.all([
        contentRepository.getChildren(folderId, courseId ?? undefined),
        contentRepository.getBreadcrumb(folderId, courseId ?? undefined),
      ]);
      setPickerItems(children);
      setPickerBreadcrumbs(breadcrumbs);
      setPickerFolderId(folderId);
      setPickerQuery('');
      if (history === 'push' && previous !== folderId) {
        setPickerBackStack((stack) => [...stack, previous]);
        setPickerForwardStack([]);
      }
    } catch (error) {
      setPickerMessage(error instanceof Error ? error.message : 'This folder could not be opened.');
    } finally {
      setPickerLoading(false);
    }
  };

  const resetPicker = async (selectedIds: string[]) => {
    setPickerSelection(selectedIds);
    setPickerBackStack([]);
    setPickerForwardStack([]);
    setPickerFolderId(null);
    setPickerQuery('');
    setPickerMessage(null);
    await loadPickerFolder(null, 'replace');
  };

  const openEditor = (item?: LearningPackage) => {
    setEditorPackage(item ?? null);
    setEditorStep('form');
    setFormError(null);
    setPublishConfirmOpen(false);
    setForm(item ? {
      title: item.title,
      description: item.description,
      price: String(item.price),
      status: item.status,
      contentItemIds: item.items.map((reference) => reference.contentItemId),
    } : emptyForm());
  };

  const closeEditor = () => {
    if (saving) return;
    setEditorPackage(undefined);
    setEditorStep('form');
    setFormError(null);
    setPublishConfirmOpen(false);
  };

  const openPicker = async () => {
    setEditorStep('picker');
    await resetPicker(form.contentItemIds);
  };

  const togglePickerItem = (item: ContentItem, force?: boolean) => {
    const selected = pickerSelection.includes(item.id);
    const shouldSelect = force ?? !selected;
    if (!shouldSelect) {
      setPickerSelection((ids) => ids.filter((id) => id !== item.id));
      setPickerMessage(null);
      return;
    }
    const selectedAncestor = ancestorIds(item, byId).find((id) => pickerSelection.includes(id));
    if (selectedAncestor) {
      setPickerMessage(`Already included through “${byId.get(selectedAncestor)?.name ?? 'a selected folder'}”.`);
      return;
    }
    const descendants = item.kind === 'folder' ? descendantIds(item.id, contentItems) : new Set<string>();
    const redundant = pickerSelection.filter((id) => descendants.has(id));
    setPickerSelection((ids) => [...ids.filter((id) => !descendants.has(id)), item.id]);
    setPickerMessage(redundant.length ? `${redundant.length} nested selection${redundant.length === 1 ? '' : 's'} consolidated into this folder.` : null);
  };

  const visiblePickerEntries = pickerQuery.trim()
    ? pickerResults.map((result) => ({ item: result.item, path: result.path }))
    : pickerItems.map((item) => ({ item, path: pathForItem(item, byId).slice(0, -1) }));

  const selectAllVisible = () => {
    let next = [...pickerSelection];
    visiblePickerEntries.forEach(({ item }) => {
      if (next.includes(item.id)) return;
      if (ancestorIds(item, byId).some((id) => next.includes(id))) return;
      const descendants = item.kind === 'folder' ? descendantIds(item.id, contentItems) : new Set<string>();
      next = [...next.filter((id) => !descendants.has(id)), item.id];
    });
    setPickerSelection([...new Set(next)]);
    setPickerMessage('Current results added. Redundant nested selections were removed automatically.');
  };

  const goPickerBack = async () => {
    if (!pickerBackStack.length) return;
    const stack = [...pickerBackStack];
    const destination = stack.pop() ?? null;
    setPickerBackStack(stack);
    setPickerForwardStack((current) => [pickerFolderId, ...current]);
    await loadPickerFolder(destination, 'back');
  };

  const goPickerForward = async () => {
    if (!pickerForwardStack.length) return;
    const stack = [...pickerForwardStack];
    const destination = stack.shift() ?? null;
    setPickerForwardStack(stack);
    setPickerBackStack((current) => [...current, pickerFolderId]);
    await loadPickerFolder(destination, 'forward');
  };

  const moveFormItem = (index: number, direction: -1 | 1) => {
    setForm((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.contentItemIds.length) return current;
      const next = [...current.contentItemIds];
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, contentItemIds: next };
    });
  };

  const validateForm = (): { title: string; price: number } | null => {
    const title = form.title.trim();
    const rawPrice = form.price.trim();
    if (!title) {
      setFormError('Enter a package title.');
      return null;
    }
    if (rawPrice === '' || !/^\d+(\.\d{1,2})?$/.test(rawPrice)) {
      setFormError('Enter a valid price of zero or more (e.g. 999 or 0). Decimals cannot exceed 2 digits.');
      return null;
    }
    const price = Number(rawPrice);
    if (!Number.isFinite(price) || price < 0) {
      setFormError('Enter a valid positive price or zero for a free package.');
      return null;
    }
    if (!form.contentItemIds.length) {
      setFormError('Select at least one file or folder from the Content Library.');
      return null;
    }
    return { title, price: Math.round(price * 100) / 100 };
  };

  const handleFormSubmit = () => {
    const valid = validateForm();
    if (!valid) return;

    if (form.status === 'published') {
      setPublishConfirmOpen(true);
    } else {
      void executeSavePackage(false);
    }
  };

  const executeSavePackage = async (confirmedPublish = false) => {
    const valid = validateForm();
    if (!valid) return;
    const { title, price } = valid;

    const input: PackageInput = {
      title,
      description: form.description.trim(),
      price,
      status: form.status,
      courseId: editorPackage?.courseId ?? courseId ?? null,
      contentItemIds: form.contentItemIds,
    };

    setSaving(true);
    setFormError(null);
    try {
      if (editorPackage) {
        await updateMutation.mutateAsync({ packageId: editorPackage.id, input });
        notify('Package updated', `${title} was updated as ${form.status}.`);
      } else {
        await createMutation.mutateAsync(input);
        notify('Package created', `${title} was created as ${form.status}.`);
      }
      setPublishConfirmOpen(false);
      setEditorPackage(undefined);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'The package could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletePackage) return;
    setDeleting(true);
    try {
      await deleteMutation.mutateAsync(deletePackage.id);
      notify('Package archived', 'Its Content Library files and folders were left untouched.');
      setDeletePackage(null);
    } catch (error) {
      notify('Package could not be archived', error instanceof Error ? error.message : undefined, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const toggleDetailsFolder = (folderId: string) => {
    setExpandedFolders((current) => {
      const next = new Set(current);
      if (next.has(folderId)) next.delete(folderId); else next.add(folderId);
      return next;
    });
  };

  const parsedPriceNum = Number(form.price);
  const isPaid = !isNaN(parsedPriceNum) && parsedPriceNum > 0;

  return (
    <motion.main className="pf-admin-page pf-packages-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
      <AdminPageHeader
        title="Packages"
        description="Bundle files and folders from the selected course's Content Library and prepare them for sale without uploading anything twice."
        breadcrumbs={[{ label: 'Admin', to: '/admin/overview' }, { label: 'Packages' }]}
        actions={
          <div className="pf-packages-actions">
            <CourseSelector module="packages" />
            <button className="pf-admin-button pf-packages-new-btn" type="button" onClick={() => openEditor()}>
              <Plus size={15} aria-hidden="true" /> New package
            </button>
          </div>
        }
      />

      {packageLoading || contentLoading ? <AdminSkeleton variant="table" rows={6} label="Loading packages" /> : null}

      {packageError || contentError ? (
        <AdminEmptyState
          title="Packages could not be loaded"
          description={packageError ?? contentError ?? 'Try loading the module again.'}
          icon={<RefreshCw />}
          action={<button className="pf-admin-button" type="button" onClick={() => { void packagesQuery.refetch(); void loadContent(); }}>Try again</button>}
        />
      ) : null}

      {!packageLoading && !packageError && !contentLoading && !scopedPackageCount ? (
        <AdminEmptyState
          title="No packages yet"
          description="Create a package by selecting existing files and folders from the Content Library."
          icon={<Box size={22} />}
          action={
            <button className="pf-admin-button" type="button" onClick={() => openEditor()}>
              <Plus size={15} /> New package
            </button>
          }
        />
      ) : null}

      {!packageLoading && !packageError && !contentLoading && scopedPackageCount ? (
        <section className="pf-package-library" aria-label="Package library">
          <div className="pf-package-toolbar">
            <label className="pf-admin-search-field">
              <Search size={16} aria-hidden="true" />
              <span className="pf-admin-sr-only">Search packages</span>
              <input className="pf-admin-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search packages" />
            </label>
            <label className="pf-admin-field pf-package-status-filter">
              <span>Status</span>
              <select className="pf-admin-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | PackageStatus)}>
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <p>{filteredPackages.length} of {scopedPackageCount} packages</p>
          </div>

          {!filteredPackages.length ? (
            <AdminEmptyState compact title="No matching packages" description="Try a different search or status filter." icon={<Search size={18} />} />
          ) : (
            <motion.div className="pf-package-grid" layout>
              <AnimatePresence initial={false}>
                {filteredPackages.map((item) => {
                  const summary = summarizeSelection(item.items.map((reference) => reference.contentItemId), contentItems);
                  const courseItem = courses.find((c) => c.id === item.courseId);
                  return (
                    <motion.article className="pf-package-card" key={item.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.2, ease }}>
                      <header>
                        <div className="pf-package-card__header-left">
                          <span className="pf-package-card__icon"><Layers3 size={17} /></span>
                          {courseItem ? <span className="pf-package-card__course-tag">{courseItem.code}</span> : null}
                        </div>
                        <AdminStatusBadge tone={statusTone(item.status)}>{item.status}</AdminStatusBadge>
                      </header>
                      <div className="pf-package-card__copy">
                        <h2>{item.title}</h2>
                        <p>{item.description || 'A curated package from the Content Library.'}</p>
                      </div>
                      <div className="pf-package-card__meta-row">
                        <strong className="pf-package-card__price">{formatCurrency(item.price)}</strong>
                        <span className="pf-package-card__date">Updated {formatDate(item.updatedAt)}</span>
                      </div>
                      <dl className="pf-package-card__stats">
                        <div><dt><Files size={13} /> Files</dt><dd>{summary.files}</dd></div>
                        <div><dt><Folder size={13} /> Folders</dt><dd>{summary.folders}</dd></div>
                      </dl>
                      {summary.missing ? <p className="pf-package-card__warning">{summary.missing} source item{summary.missing === 1 ? '' : 's'} unavailable</p> : null}
                      <footer>
                        <button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={() => { setDetailsPackage(item); setExpandedFolders(new Set()); }}><Eye size={14} /> Details</button>
                        <button className="pf-admin-button pf-admin-button--secondary" type="button" onClick={() => openEditor(item)}><Pencil size={14} /> Edit</button>
                        <button className="pf-admin-icon-button pf-package-delete-button" type="button" onClick={() => setDeletePackage(item)} aria-label={`Delete ${item.title}`}><Trash2 size={15} /></button>
                      </footer>
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </section>
      ) : null}

      <AdminDialog
        open={editorOpen}
        onClose={closeEditor}
        title={editorStep === 'picker' ? 'Select content' : editorPackage ? 'Edit package' : 'New package'}
        description={editorStep === 'picker' ? 'Choose files or folders from the existing Content Library.' : 'Set the package details, then attach reusable content references.'}
        size="large"
        footer={editorStep === 'picker' ? (
          <>
            <span className="pf-package-picker-footer-copy">{pickerSummary.selected} selected · {pickerSummary.files} files · {pickerSummary.folders} folders</span>
            <button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={() => setEditorStep('form')}>Cancel</button>
            <button className="pf-admin-button" type="button" onClick={() => { setForm((current) => ({ ...current, contentItemIds: pickerSelection })); setEditorStep('form'); }} disabled={!pickerSelection.length}>Add selected ({pickerSelection.length})</button>
          </>
        ) : (
          <>
            <button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={closeEditor}>Cancel</button>
            <button className="pf-admin-button" type="button" onClick={() => handleFormSubmit()} disabled={saving}>
              {saving ? 'Saving…' : editorPackage ? `Save changes · ${formSummary.selected} items` : `Create package · ${formSummary.selected} items`}
            </button>
          </>
        )}
      >
        {editorStep === 'form' ? (
          <div className="pf-package-form">
            <div className="pf-package-course-locked-card">
              <div className="pf-package-course-locked-card__info">
                <span className="pf-package-course-locked-card__tag">LOCKED TO COURSE</span>
                <strong>{currentCourse ? `${currentCourse.name} (${currentCourse.code})` : 'Selected Course'}</strong>
                <small>Packages created here belong strictly to this course's Content Library.</small>
              </div>
              <LockKeyhole size={18} className="pf-package-course-locked-card__icon" />
            </div>

            <div className="pf-package-form__grid">
              <label className="pf-admin-field"><span>Title</span><input className="pf-admin-input" autoFocus value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. CA Intermediate Revision Library" maxLength={140} /></label>
              <label className="pf-admin-field"><span>Price (₹)</span><input className="pf-admin-input" inputMode="decimal" type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} placeholder="e.g. 999" /></label>
              <label className="pf-admin-field pf-package-form__wide"><span>Description <small>Optional</small></span><textarea className="pf-admin-textarea" rows={3} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Explain what the learner receives." /></label>
              <label className="pf-admin-field"><span>Status <small>Draft is safe default</small></span><select className="pf-admin-select" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as PackageStatus }))}><option value="draft">Draft (Safe Default)</option><option value="published">Published (Store Visible)</option><option value="archived">Archived</option></select></label>
            </div>

            <section className="pf-package-selected-section">
              <header>
                <div><h3>Included content</h3><p>{formSummary.selected} references · {formSummary.files} files · {formSummary.folders} folders · {formatBytes(formSummary.totalBytes)}</p></div>
                <button className="pf-admin-button pf-admin-button--secondary" type="button" onClick={() => void openPicker()}><Plus size={16} /> {form.contentItemIds.length ? 'Add more content' : 'Select content'}</button>
              </header>
              {!form.contentItemIds.length ? (
                <div className="pf-package-selected-empty"><FolderOpen size={25} /><p>No content selected yet. Browse the Content Library to add files or complete folders.</p></div>
              ) : (
                <ul className="pf-package-selected-list">
                  {form.contentItemIds.map((id, index) => {
                    const content = byId.get(id);
                    return (
                      <li key={id} className={!content ? 'is-missing' : ''}>
                        <div className="pf-package-selected-item__main">
                          <ContentIcon item={content} />
                          <div><strong>{content?.name ?? 'Content no longer available'}</strong><small>{content ? pathForItem(content, byId).map((crumb) => crumb.name).join(' / ') : id}</small></div>
                        </div>
                        <div className="pf-package-selected-item__meta">
                          {content?.kind === 'file' ? <span className="pf-package-selected-item__size">{formatBytes(content.size)}</span> : null}
                          <span className={`pf-package-selected-item__access pf-package-selected-item__access--${content?.accessType === 'PAID' ? 'paid' : 'free'}`}>
                            {content?.accessType === 'PAID' ? 'PAID' : 'FREE'}
                          </span>
                          <div className="pf-package-selected-item__order-buttons">
                            <button type="button" onClick={() => moveFormItem(index, -1)} disabled={index === 0} aria-label="Move item up">
                              <ArrowUp size={14} />
                            </button>
                            <button type="button" onClick={() => moveFormItem(index, 1)} disabled={index === form.contentItemIds.length - 1} aria-label="Move item down">
                              <ArrowDown size={14} />
                            </button>
                          </div>
                          <button type="button" className="pf-package-selected-item__remove" onClick={() => setForm((current) => ({ ...current, contentItemIds: current.contentItemIds.filter((itemId) => itemId !== id) }))} aria-label={`Remove ${content?.name ?? 'content'}`}><X size={16} /></button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* PACKAGE SUMMARY CARD */}
            <div className="pf-package-builder-summary">
              <header>
                <PackagePlus size={16} />
                <strong>PACKAGE SUMMARY</strong>
              </header>
              <div className="pf-package-builder-summary__body">
                <div className="pf-package-builder-summary__row">
                  <div>
                    <span className="pf-package-builder-summary__label">Package Title</span>
                    <h4 className="pf-package-builder-summary__title">{form.title.trim() || 'Untitled Package'}</h4>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="pf-package-builder-summary__label">Listed Price</span>
                    <strong className="pf-package-builder-summary__price">
                      {form.price && !isNaN(Number(form.price)) && Number(form.price) > 0 ? formatCurrency(Number(form.price)) : 'Free'}
                    </strong>
                  </div>
                </div>
                <div className="pf-package-builder-summary__pills">
                  <span><strong>{formSummary.selected}</strong> resources ({formSummary.files} files · {formSummary.folders} folders)</span>
                  <span><strong>{formatBytes(formSummary.totalBytes)}</strong> total size</span>
                  <span>Access: <strong>{isPaid ? 'Paid' : 'Free'}</strong></span>
                  <span>Status: <AdminStatusBadge tone={statusTone(form.status)}>{form.status}</AdminStatusBadge></span>
                </div>
              </div>
            </div>

            {formError ? <p className="pf-package-form-error" role="alert"><AlertCircle size={15} /> {formError}</p> : null}
          </div>
        ) : (
          <div className="pf-package-picker">
            <div className="pf-package-picker__toolbar">
              <div className="pf-package-picker__history">
                <button type="button" onClick={() => void goPickerBack()} disabled={!pickerBackStack.length} aria-label="Go back"><ArrowLeft size={18} /></button>
                <button type="button" onClick={() => void goPickerForward()} disabled={!pickerForwardStack.length} aria-label="Go forward"><ArrowRight size={18} /></button>
              </div>
              <label className="pf-admin-search-field"><Search size={17} /><span className="pf-admin-sr-only">Search the Content Library</span><input className="pf-admin-input" value={pickerQuery} onChange={(event) => setPickerQuery(event.target.value)} placeholder="Search files and folders" /></label>
              <button className="pf-admin-button pf-admin-button--secondary" type="button" onClick={selectAllVisible} disabled={!visiblePickerEntries.length}><Check size={16} /> Select all</button>
            </div>

            {!pickerQuery.trim() ? (
              <nav className="pf-package-picker__breadcrumbs" aria-label="Content Library path">
                {pickerBreadcrumbs.map((crumb, index) => <React.Fragment key={crumb.id ?? 'root'}><button type="button" onClick={() => void loadPickerFolder(crumb.id, 'push')} aria-current={index === pickerBreadcrumbs.length - 1 ? 'page' : undefined}>{crumb.name}</button>{index < pickerBreadcrumbs.length - 1 ? <ChevronRight size={14} /> : null}</React.Fragment>)}
              </nav>
            ) : <p className="pf-package-picker__result-title">Search results across the Content Library</p>}

            {pickerMessage ? <p className="pf-package-picker__message" role="status">{pickerMessage}</p> : null}
            {pickerLoading || pickerSearching ? <AdminSkeleton rows={3} label="Loading Content Library" /> : null}
            {!pickerLoading && !pickerSearching && !visiblePickerEntries.length ? <AdminEmptyState compact title="Nothing here" description={pickerQuery ? 'No content matches this search.' : 'This folder is empty.'} icon={<FolderOpen />} /> : null}
            {!pickerLoading && !pickerSearching && visiblePickerEntries.length ? (
              <ul className="pf-package-picker__list">
                {visiblePickerEntries.map(({ item, path }) => {
                  const selected = pickerSelection.includes(item.id);
                  const includedByAncestor = !selected && ancestorIds(item, byId).some((id) => pickerSelection.includes(id));
                  return (
                    <li key={item.id} className={`${selected ? 'is-selected' : ''}${includedByAncestor ? ' is-included' : ''}`}>
                      <button className="pf-package-picker__check" type="button" onClick={() => togglePickerItem(item)} aria-pressed={selected} aria-label={`${selected ? 'Remove' : 'Select'} ${item.name}`}><span>{selected || includedByAncestor ? <Check size={15} /> : null}</span></button>
                      <span className="pf-package-picker__icon"><ContentIcon item={item} size={21} /></span>
                      <button className="pf-package-picker__name" type="button" onClick={() => item.kind === 'folder' ? void loadPickerFolder(item.id, 'push') : togglePickerItem(item)}>
                        <strong>{item.name}</strong>
                        <small>{path.map((crumb) => crumb.name).join(' / ') || 'My Flow'}{includedByAncestor ? ' · Included by selected folder' : ''}</small>
                      </button>
                      <span className={`pf-package-selected-item__access pf-package-selected-item__access--${item.accessType === 'PAID' ? 'paid' : 'free'}`}>
                        {item.accessType === 'PAID' ? 'PAID' : 'FREE'}
                      </span>
                      <span className="pf-package-picker__kind">{item.kind}</span>
                      {item.kind === 'folder' ? <button className="pf-package-picker__open" type="button" onClick={() => void loadPickerFolder(item.id, 'push')} aria-label={`Open ${item.name}`}><ChevronRight size={18} /></button> : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        )}
      </AdminDialog>

      {/* PUBLISH CONFIRMATION WARNING MODAL */}
      <AdminDialog
        open={publishConfirmOpen}
        onClose={() => setPublishConfirmOpen(false)}
        title="Publish package?"
        description="This package will become available for purchase in the Parallax Flow Store."
        size="small"
        footer={
          <>
            <button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={() => setPublishConfirmOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button className="pf-admin-button" type="button" onClick={() => void executeSavePackage(true)} disabled={saving}>
              {saving ? 'Publishing…' : 'Publish package'}
            </button>
          </>
        }
      >
        <div className="pf-package-publish-warning">
          <p>Please review before publishing to the Store:</p>
          <dl>
            <div><dt>Package</dt><dd><strong>{form.title.trim() || 'Untitled package'}</strong></dd></div>
            <div><dt>Course</dt><dd>{currentCourse?.name ?? 'Selected Course'}</dd></div>
            <div><dt>Listed Price</dt><dd><strong>{Number(form.price) > 0 ? formatCurrency(Number(form.price)) : 'Free'}</strong></dd></div>
            <div><dt>Included</dt><dd>{formSummary.selected} resources ({formSummary.files} files · {formSummary.folders} folders)</dd></div>
            <div><dt>Total Size</dt><dd>{formatBytes(formSummary.totalBytes)}</dd></div>
          </dl>
        </div>
      </AdminDialog>

      <AdminDialog
        open={Boolean(detailsPackage)}
        onClose={() => setDetailsPackage(null)}
        title={detailsPackage?.title ?? 'Package details'}
        description="Package metadata and the Content Library references it includes."
        size="large"
        footer={<><button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={() => setDetailsPackage(null)}>Close</button>{detailsPackage ? <button className="pf-admin-button" type="button" onClick={() => { const target = detailsPackage; setDetailsPackage(null); openEditor(target); }}><Pencil size={16} /> Edit package</button> : null}</>}
      >
        {detailsPackage ? (
          <PackageDetails item={detailsPackage} contentItems={contentItems} expandedFolders={expandedFolders} onToggleFolder={toggleDetailsFolder} />
        ) : null}
      </AdminDialog>

      <AdminDialog
        open={Boolean(deletePackage)}
        onClose={() => { if (!deleting) setDeletePackage(null); }}
        title="Delete package?"
        description="Only the package record will be deleted. Original files and folders remain safely in Content."
        size="small"
        footer={<><button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={() => setDeletePackage(null)} disabled={deleting}>Cancel</button><button className="pf-admin-button pf-admin-button--danger" type="button" onClick={() => void confirmDelete()} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete package'}</button></>}
      >
        <div className="pf-package-delete-confirm"><Trash2 size={22} /><p><strong>{deletePackage?.title}</strong> will no longer be available as a package. This cannot be undone in the current mock environment.</p></div>
      </AdminDialog>

      <AdminToast toast={toast} onDismiss={() => setToast(null)} />
    </motion.main>
  );
};

const PackageDetails: React.FC<{
  item: LearningPackage;
  contentItems: ContentItem[];
  expandedFolders: Set<string>;
  onToggleFolder: (folderId: string) => void;
}> = ({ item, contentItems, expandedFolders, onToggleFolder }) => {
  const byId = itemMap(contentItems);
  const summary = summarizeSelection(item.items.map((reference) => reference.contentItemId), contentItems);
  return (
    <div className="pf-package-details">
      <dl className="pf-package-details__meta">
        <div><dt>Status</dt><dd><AdminStatusBadge tone={statusTone(item.status)}>{item.status}</AdminStatusBadge></dd></div>
        <div><dt>Price</dt><dd>{formatCurrency(item.price)}</dd></div>
        <div><dt>Files included</dt><dd>{summary.files}</dd></div>
        <div><dt>Folders included</dt><dd>{summary.folders}</dd></div>
        <div><dt>Created</dt><dd>{formatDate(item.createdAt)}</dd></div>
        <div><dt>Last updated</dt><dd>{formatDate(item.updatedAt)}</dd></div>
      </dl>
      {item.description ? <section className="pf-package-details__description"><h3>Description</h3><p>{item.description}</p></section> : null}
      <section className="pf-package-details__content">
        <h3>Included content</h3>
        <ul>
          {item.items.map((reference) => {
            const content = byId.get(reference.contentItemId);
            if (!content) return <li className="is-missing" key={reference.contentItemId}><span><FileIcon /></span><div><strong>Content no longer available</strong><small>{reference.contentItemId}</small></div></li>;
            const expanded = content.kind === 'folder' && expandedFolders.has(content.id);
            return (
              <li key={reference.contentItemId}>
                <button className="pf-package-details__row" type="button" onClick={() => content.kind === 'folder' && onToggleFolder(content.id)} aria-expanded={content.kind === 'folder' ? expanded : undefined}>
                  <span><ContentIcon item={content} /></span>
                  <div><strong>{content.name}</strong><small>{pathForItem(content, byId).map((crumb) => crumb.name).join(' / ')}</small></div>
                  <em>{content.kind}</em>
                  {content.kind === 'folder' ? expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} /> : null}
                </button>
                <AnimatePresence initial={false}>
                  {expanded ? <FolderContents folderId={content.id} items={contentItems} depth={0} /> : null}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
};

const FolderContents: React.FC<{ folderId: string; items: ContentItem[]; depth: number }> = ({ folderId, items, depth }) => {
  const children = items.filter((item) => item.parentId === folderId).sort((a, b) => a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'folder' ? -1 : 1);
  return (
    <motion.ul className="pf-package-folder-tree" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2, ease }}>
      {children.map((child) => <li key={child.id} style={{ '--tree-depth': depth } as React.CSSProperties}><span><ContentIcon item={child} size={16} /></span><div><strong>{child.name}</strong><small>{child.kind}</small></div>{child.kind === 'folder' ? <FolderContents folderId={child.id} items={items} depth={depth + 1} /> : null}</li>)}
    </motion.ul>
  );
};

export default PackagesPage;
