import React, { useEffect, useId, useMemo, useState } from 'react';
import { BookOpen, Boxes, Check, CheckCircle2, Database, Gift, Search } from 'lucide-react';
import { AppSelect } from '@/components/ui/AppSelect';
import { getReadOnlyErrorCopy } from '@/components/ReadOnlyQueryState';
import { AdminDialog, AdminToast } from '@/features/admin/AdminUi';
import { AdminDatePicker } from '@/features/admin/AdminDatePicker';
import {
  type AdminGrantAccessResourceDto,
  type GrantAccessCategory,
  useAdminGrantAccessCatalog,
  useGrantStudentAccess,
} from './adminReadOnlyApi';

type SelectionState = Record<GrantAccessCategory, string[]>;
type SearchState = Record<GrantAccessCategory, string>;

const EMPTY_SELECTIONS: SelectionState = { notes: [], questionBanks: [], bundles: [], subscriptions: [] };
const EMPTY_SEARCH: SearchState = { notes: '', questionBanks: '', bundles: '', subscriptions: '' };

const CATEGORY_CONFIG: Array<{ key: GrantAccessCategory; label: string; empty: string; icon: React.ReactNode }> = [
  { key: 'notes', label: 'Notes', empty: 'No paid notes are available for this course.', icon: <BookOpen size={16} /> },
  { key: 'questionBanks', label: 'Question Banks', empty: 'No paid Question Banks are available for this course.', icon: <Database size={16} /> },
  { key: 'bundles', label: 'Bundles', empty: 'No paid bundles are available for this course.', icon: <Boxes size={16} /> },
  { key: 'subscriptions', label: 'Subscriptions', empty: 'No subscriptions are currently available.', icon: <Gift size={16} /> },
];

const localDateValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const tomorrowValue = () => {
  const tomorrow = new Date();
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return localDateValue(tomorrow);
};

const CategoryCard: React.FC<{
  category: (typeof CATEGORY_CONFIG)[number];
  items: AdminGrantAccessResourceDto[];
  selectedIds: string[];
  activeIds: string[];
  search: string;
  onSearch: (value: string) => void;
  onToggle: (id: string) => void;
  onSetVisible: (ids: string[], selected: boolean) => void;
}> = ({ category, items, selectedIds, activeIds, search, onSearch, onToggle, onSetVisible }) => {
  const searchId = useId();
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => `${item.title} ${item.subtitle}`.toLowerCase().includes(query));
  }, [items, search]);
  const selectableFilteredIds = filtered.filter((item) => !activeIds.includes(item.id)).map((item) => item.id);
  const allVisibleSelected = selectableFilteredIds.length > 0 && selectableFilteredIds.every((id) => selectedIds.includes(id));

  return (
    <section className="pf-grant-category" aria-labelledby={`${searchId}-title`}>
      <header className="pf-grant-category__header">
        <div className="pf-grant-category__title">
          <span className="pf-grant-category__icon" aria-hidden="true">{category.icon}</span>
          <div><h3 id={`${searchId}-title`}>{category.label}</h3><span>{selectedIds.length} selected</span></div>
        </div>
        {items.length ? (
          <button type="button" className="pf-grant-category__all" onClick={() => onSetVisible(selectableFilteredIds, !allVisibleSelected)} disabled={!selectableFilteredIds.length}>
            {allVisibleSelected ? 'Deselect all' : 'Select all'}
          </button>
        ) : null}
      </header>
      <label className="pf-grant-search" htmlFor={searchId}>
        <Search size={14} aria-hidden="true" />
        <input id={searchId} value={search} onChange={(event) => onSearch(event.target.value)} placeholder={`Search ${category.label.toLowerCase()}`} disabled={!items.length} />
      </label>
      <div className="pf-grant-category__list">
        {!items.length ? <p className="pf-grant-category__empty">{category.empty}</p> : !filtered.length ? <p className="pf-grant-category__empty">No matching resources.</p> : filtered.map((item) => {
          const checked = selectedIds.includes(item.id);
          const alreadyActive = activeIds.includes(item.id);
          return (
            <label key={item.id} className={`pf-grant-option${checked ? ' pf-grant-option--selected' : ''}${alreadyActive ? ' pf-grant-option--active' : ''}`}>
              <input type="checkbox" checked={checked} disabled={alreadyActive} onChange={() => onToggle(item.id)} />
              <span className="pf-grant-option__check" aria-hidden="true">{checked ? <Check size={13} /> : null}</span>
              <span className="pf-grant-option__copy"><strong>{item.title}</strong><small>{alreadyActive ? 'Already granted · Active' : item.subtitle}</small></span>
            </label>
          );
        })}
      </div>
    </section>
  );
};

export const GrantAccessDialog: React.FC<{
  open: boolean;
  userId: string | null;
  student: { id: string; name: string; email: string };
  onClose: () => void;
  onGranted: () => void;
  scope?: 'admin' | 'academy';
}> = ({ open, userId, student, onClose, onGranted, scope = 'admin' }) => {
  const [courseId, setCourseId] = useState('');
  const [selections, setSelections] = useState<SelectionState>(EMPTY_SELECTIONS);
  const [searches, setSearches] = useState<SearchState>(EMPTY_SEARCH);
  const [expiryMode, setExpiryMode] = useState<'NONE' | 'DATE'>('NONE');
  const [expiryDate, setExpiryDate] = useState('');
  const [success, setSuccess] = useState('');
  const catalogQuery = useAdminGrantAccessCatalog(userId, student.id, courseId || undefined, open, scope);
  const grantMutation = useGrantStudentAccess(userId, student.id, scope);
  const catalog = catalogQuery.data;
  const resources = catalog?.resources;
  const activeManualGrantIds = catalog?.activeManualGrantIds;

  useEffect(() => {
    if (!open) return;
    setCourseId('');
    setSelections(EMPTY_SELECTIONS);
    setSearches(EMPTY_SEARCH);
    setExpiryMode('NONE');
    setExpiryDate('');
    setSuccess('');
    grantMutation.reset();
  // Reset only when a fresh dialog is opened.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selectedCount = Object.values(selections).reduce((total, ids) => total + ids.length, 0);
  const selectedCourse = catalog?.courses.find((course) => course.id === courseId);
  const invalidExpiry = expiryMode === 'DATE' && (!expiryDate || expiryDate < tomorrowValue());
  const canGrant = Boolean(courseId && resources && selectedCount && !invalidExpiry && !catalogQuery.isError && !grantMutation.isPending);

  const updateCourse = (nextCourseId: string) => {
    setCourseId(nextCourseId);
    setSelections(EMPTY_SELECTIONS);
    setSearches(EMPTY_SEARCH);
    setSuccess('');
    grantMutation.reset();
  };
  const toggle = (category: GrantAccessCategory, id: string) => setSelections((current) => ({ ...current, [category]: current[category].includes(id) ? current[category].filter((item) => item !== id) : [...current[category], id] }));
  const setVisible = (category: GrantAccessCategory, ids: string[], selected: boolean) => setSelections((current) => ({ ...current, [category]: selected ? [...new Set([...current[category], ...ids])] : current[category].filter((id) => !ids.includes(id)) }));

  const selectedItems = (category: GrantAccessCategory) => (resources?.[category] ?? []).filter((item) => selections[category].includes(item.id));
  const submit = async () => {
    if (!canGrant) return;
    try {
      const result = await grantMutation.mutateAsync({
        courseId,
        selections,
        expiresAt: expiryMode === 'DATE' ? new Date(`${expiryDate}T23:59:59.999`).toISOString() : null,
      });
      setSuccess(result.grantedCount
        ? `${result.grantedCount} ${result.grantedCount === 1 ? 'resource was' : 'resources were'} granted successfully.${result.alreadyActiveCount ? ` ${result.alreadyActiveCount} already-active ${result.alreadyActiveCount === 1 ? 'item was' : 'items were'} unchanged.` : ''}`
        : 'The selected access was already active; no duplicate grant was created.');
      setSelections(EMPTY_SELECTIONS);
      onGranted();
      await catalogQuery.refetch();
    } catch {
      // The mutation error is rendered in context below.
    }
  };
  const errorCopy = catalogQuery.error ? getReadOnlyErrorCopy(catalogQuery.error, 'Grant access catalog') : grantMutation.error ? getReadOnlyErrorCopy(grantMutation.error, 'Grant access') : null;

  return <>
    <AdminDialog
      open={open}
      onClose={() => { if (!grantMutation.isPending) onClose(); }}
      title="Grant Access"
      description={`Select paid learning resources for ${student.name}. Store purchases remain independent.`}
      size="wide"
      bodyClassName="pf-grant-dialog__body"
      footer={<div className="pf-grant-actions"><button className="pf-admin-button pf-admin-button--secondary" type="button" onClick={onClose} disabled={grantMutation.isPending}>Cancel</button><button className="pf-admin-button pf-admin-button--primary" type="button" onClick={() => void submit()} disabled={!canGrant}>{grantMutation.isPending ? 'Granting…' : <><CheckCircle2 size={16} /> Grant Access</>}</button></div>}
    >
      <div className="pf-grant-workflow">
        {errorCopy ? <div className="pf-admin-mutation-error" role="alert"><strong>{errorCopy.title}</strong><span>{errorCopy.description}</span><button type="button" onClick={() => { grantMutation.reset(); void catalogQuery.refetch(); }}>Try again</button></div> : null}

        <section className="pf-grant-course">
          <div><span className="pf-grant-step">1</span><div><h3>Select course</h3><p>Only courses already connected to this student are available.</p></div></div>
          <AppSelect className="pf-admin-select" value={courseId} onChange={(event) => updateCourse(event.target.value)} disabled={catalogQuery.isPending || !catalog?.courses.length}>
            <option value="">{catalogQuery.isPending ? 'Loading student courses…' : catalog?.courses.length ? 'Choose a course' : 'No enrolled courses'}</option>
            {catalog?.courses.map((course) => <option key={course.id} value={course.id}>{course.name} ({course.code})</option>)}
          </AppSelect>
        </section>

        {catalogQuery.isSuccess && catalog && !catalog.courses.length ? <div className="pf-grant-empty-state"><strong>This student has no courses.</strong><span>Enroll the student in a course or restore valid course access before granting materials.</span></div> : null}

        {courseId ? (
          <>
            <div className="pf-grant-section-heading"><span className="pf-grant-step">2</span><div><h3>Select materials</h3><p>Choose any combination. At least one resource is required.</p></div></div>
            {catalogQuery.isPending ? <div className="pf-grant-empty-state"><strong>Loading paid resources…</strong></div> : resources ? (
              <div className="pf-grant-categories">
                {CATEGORY_CONFIG.map((category) => <CategoryCard key={category.key} category={category} items={resources[category.key]} selectedIds={selections[category.key]} activeIds={activeManualGrantIds?.[category.key] ?? []} search={searches[category.key]} onSearch={(value) => setSearches((current) => ({ ...current, [category.key]: value }))} onToggle={(id) => toggle(category.key, id)} onSetVisible={(ids, selected) => setVisible(category.key, ids, selected)} />)}
              </div>
            ) : null}

            <section className="pf-grant-expiry">
              <div className="pf-grant-section-heading"><span className="pf-grant-step">3</span><div><h3>Access expiry</h3><p>Expired records remain in access history.</p></div></div>
              <div className="pf-grant-expiry__controls">
                <label className={expiryMode === 'NONE' ? 'is-selected' : ''}><input type="radio" name="grant-expiry" checked={expiryMode === 'NONE'} onChange={() => { setExpiryMode('NONE'); setExpiryDate(''); }} /> No expiry</label>
                <label className={expiryMode === 'DATE' ? 'is-selected' : ''}><input type="radio" name="grant-expiry" checked={expiryMode === 'DATE'} onChange={() => setExpiryMode('DATE')} /> Set expiry date</label>
                {expiryMode === 'DATE' ? <AdminDatePicker min={tomorrowValue()} value={expiryDate} onChange={setExpiryDate} placeholder="Choose expiry date" ariaInvalid={invalidExpiry} /> : null}
              </div>
              {invalidExpiry ? <p className="pf-grant-field-error">Choose a valid future date.</p> : null}
            </section>

            <section className="pf-grant-review">
              <div className="pf-grant-section-heading"><span className="pf-grant-step">4</span><div><h3>Review</h3><p>Confirm the access that will be granted.</p></div></div>
              <dl className="pf-grant-review__grid">
                <div><dt>Student</dt><dd>{student.name}<small>{student.email}</small></dd></div>
                <div><dt>Course</dt><dd>{selectedCourse?.name ?? '—'}</dd></div>
                {CATEGORY_CONFIG.map((category) => <div key={category.key}><dt>{category.label}</dt><dd>{selectedItems(category.key).length ? selectedItems(category.key).map((item) => item.title).join(', ') : 'None'}</dd></div>)}
                <div><dt>Expiry</dt><dd>{expiryMode === 'DATE' && expiryDate ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${expiryDate}T12:00:00`)) : 'No expiry'}</dd></div>
              </dl>
              {!selectedCount ? <p className="pf-grant-review__hint">Select at least one resource to enable Grant Access.</p> : null}
            </section>
          </>
        ) : null}
      </div>
    </AdminDialog>
    <AdminToast
      toast={success ? { id: 'grant-access-success', title: 'Access updated', message: success, tone: 'success' } : null}
      onDismiss={() => setSuccess('')}
    />
  </>;
};
