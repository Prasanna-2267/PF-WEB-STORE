import { AppSelect } from '@/components/ui/AppSelect';
import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CalendarDays,
  Check,
  Copy,
  Eye,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Search,
  TicketPercent,
  Trash2,
} from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { AdminDatePicker } from '../AdminDatePicker';
import { useCouponStore } from '@/app/store/useCouponStore';
import { usePackageStore } from '@/app/store/usePackageStore';
import { contentRepository } from '@/app/store/useContentStore';
import type { ContentItem } from '@/features/admin/content/types/content';
import type {
  Coupon,
  CouponDiscountType,
  CouponInput,
  CouponScope,
  CouponStatus,
} from './types/coupon';
import { getCouponStatus, normalizeCouponCode } from './types/coupon';
import {
  AdminDialog,
  AdminEmptyState,
  AdminPageHeader,
  AdminSkeleton,
  AdminStatusBadge,
  AdminToast,
  type AdminStatusTone,
  type AdminToastData,
} from '../AdminUi';
import './coupons.css';

const PAGE_SIZE = 8;
const EASE = [0.22, 1, 0.36, 1] as const;

type CouponSort = 'newest' | 'oldest' | 'code-asc' | 'value-high' | 'value-low';
type EditorState = { mode: 'create'; coupon: null } | { mode: 'edit'; coupon: Coupon };
type ConfirmState = { action: 'delete' | 'toggle'; coupon: Coupon };

interface FormState {
  code: string;
  discountType: CouponDiscountType;
  discountValue: string;
  scope: CouponScope;
  targetIds: string[];
  usageMode: 'unlimited' | 'limited';
  maxUses: string;
  expiryMode: 'none' | 'date';
  expiresAt: string;
  enabled: boolean;
}

const emptyForm = (): FormState => ({
  code: '',
  discountType: 'PERCENT',
  discountValue: '',
  scope: 'ALL',
  targetIds: [],
  usageMode: 'unlimited',
  maxUses: '',
  expiryMode: 'none',
  expiresAt: '',
  enabled: true,
});

const formFromCoupon = (coupon: Coupon): FormState => ({
  code: coupon.code,
  discountType: coupon.discountType,
  discountValue: String(coupon.discountValue),
  scope: coupon.scope,
  targetIds: [...coupon.targetIds],
  usageMode: coupon.maxUses === null ? 'unlimited' : 'limited',
  maxUses: coupon.maxUses === null ? '' : String(coupon.maxUses),
  expiryMode: coupon.expiresAt ? 'date' : 'none',
  expiresAt: coupon.expiresAt?.slice(0, 10) ?? '',
  enabled: coupon.enabled,
});

const formatDate = (value: string | null): string => value
  ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
  : 'No expiry';

const formatDiscount = (coupon: Pick<Coupon, 'discountType' | 'discountValue'>): string => (
  coupon.discountType === 'PERCENT'
    ? `${coupon.discountValue}% off`
    : `${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(coupon.discountValue)} off`
);

const scopeLabel = (scope: CouponScope): string => ({
  ALL: 'Everything',
  PACKAGES: 'Selected packages',
  SUBJECTS: 'Selected subjects',
}[scope]);

const statusMeta: Record<CouponStatus, { label: string; tone: AdminStatusTone }> = {
  ACTIVE: { label: 'Active', tone: 'success' },
  EXPIRED: { label: 'Expired', tone: 'warning' },
  EXHAUSTED: { label: 'Exhausted', tone: 'danger' },
  DISABLED: { label: 'Disabled', tone: 'neutral' },
};

const buildInput = (form: FormState): CouponInput => ({
  code: form.code,
  discountType: form.discountType,
  discountValue: Number(form.discountValue),
  scope: form.scope,
  targetIds: form.scope === 'ALL' ? [] : form.targetIds,
  maxUses: form.usageMode === 'limited' ? Number(form.maxUses) : null,
  expiresAt: form.expiryMode === 'date' && form.expiresAt
    ? new Date(`${form.expiresAt}T23:59:59.999Z`).toISOString()
    : null,
  enabled: form.enabled,
});

const validateForm = (form: FormState, coupons: Coupon[], editingId?: string): Record<string, string> => {
  const errors: Record<string, string> = {};
  if (!form.code) errors.code = 'Enter a coupon code.';
  else if (form.code.length < 3) errors.code = 'Use at least 3 characters.';
  else if (coupons.some((coupon) => coupon.id !== editingId && coupon.code === form.code)) errors.code = 'This coupon code already exists.';
  const value = Number(form.discountValue);
  if (!Number.isFinite(value) || value <= 0) errors.discountValue = 'Enter a value greater than zero.';
  else if (form.discountType === 'PERCENT' && value > 100) errors.discountValue = 'Percentage cannot exceed 100.';
  if (form.scope !== 'ALL' && form.targetIds.length === 0) errors.targetIds = `Select at least one ${form.scope === 'PACKAGES' ? 'package' : 'subject'}.`;
  if (form.usageMode === 'limited') {
    const max = Number(form.maxUses);
    if (!Number.isInteger(max) || max <= 0) errors.maxUses = 'Enter a positive whole number.';
  }
  if (form.expiryMode === 'date') {
    if (!form.expiresAt) errors.expiresAt = 'Choose an expiry date.';
    else if (Number.isNaN(new Date(form.expiresAt).getTime())) errors.expiresAt = 'Choose a valid expiry date.';
  }
  return errors;
};

const CouponEditor: React.FC<{
  editor: EditorState | null;
  coupons: Coupon[];
  packages: ReturnType<typeof usePackageStore.getState>['packages'];
  subjects: ContentItem[];
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: CouponInput) => Promise<void>;
}> = ({ editor, coupons, packages, subjects, pending, onClose, onSubmit }) => {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    setForm(editor?.coupon ? formFromCoupon(editor.coupon) : emptyForm());
    setSubmitted(false);
    setSubmitError('');
  }, [editor]);

  const errors = validateForm(form, coupons, editor?.coupon?.id);
  const targets = form.scope === 'PACKAGES' ? packages : subjects;
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const toggleTarget = (id: string) => update('targetIds', form.targetIds.includes(id)
    ? form.targetIds.filter((targetId) => targetId !== id)
    : [...form.targetIds, id]);

  return (
    <AdminDialog
      open={Boolean(editor)}
      onClose={() => { if (!pending) onClose(); }}
      title={editor?.mode === 'edit' ? 'Edit coupon' : 'New coupon'}
      description={editor?.mode === 'edit' ? 'Update discount rules while keeping the coupon code unchanged.' : 'Create a controlled discount for the Parallax Flow Store.'}
      size="large"
      footer={
        <>
          <button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={onClose} disabled={pending}>Cancel</button>
          <button
            className="pf-admin-button"
            type="submit"
            form="pf-coupon-form"
            disabled={pending || Object.keys(errors).length > 0}
          >
            {pending ? 'Saving…' : editor?.mode === 'edit' ? 'Save changes' : 'Create coupon'}
          </button>
        </>
      }
    >
      <form
        id="pf-coupon-form"
        className="pf-coupon-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setSubmitted(true);
          setSubmitError('');
          if (Object.keys(errors).length) return;
          try { await onSubmit(buildInput(form)); } catch (error) { setSubmitError(error instanceof Error ? error.message : 'Coupon could not be saved.'); }
        }}
      >
        <div className="pf-coupon-form__grid">
          <label className="pf-admin-field">
            <span>Coupon code</span>
            <input
              className="pf-admin-input"
              value={form.code}
              onChange={(event) => update('code', normalizeCouponCode(event.target.value))}
              placeholder="e.g. SAVE20"
              maxLength={32}
              readOnly={editor?.mode === 'edit'}
              autoComplete="off"
            />
            {editor?.mode === 'edit' ? <small>Coupon codes cannot be changed after creation.</small> : null}
            {submitted && errors.code ? <em className="pf-coupon-field-error">{errors.code}</em> : null}
          </label>
          <label className="pf-admin-field">
            <span>Discount value</span>
            <input
              className="pf-admin-input"
              inputMode="decimal"
              value={form.discountValue}
              onChange={(event) => update('discountValue', event.target.value)}
              placeholder={form.discountType === 'PERCENT' ? 'e.g. 20' : 'e.g. 250'}
            />
            {submitted && errors.discountValue ? <em className="pf-coupon-field-error">{errors.discountValue}</em> : null}
          </label>
        </div>

        <fieldset className="pf-coupon-fieldset">
          <legend>Discount type</legend>
          <div className="pf-coupon-segments">
            {(['PERCENT', 'FLAT'] as CouponDiscountType[]).map((type) => (
              <button key={type} type="button" className={form.discountType === type ? 'is-active' : ''} onClick={() => update('discountType', type)}>
                {type === 'PERCENT' ? 'Percentage' : 'Flat amount'}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="pf-coupon-fieldset">
          <legend>Applies to</legend>
          <div className="pf-coupon-scope-grid">
            {(['ALL', 'PACKAGES', 'SUBJECTS'] as CouponScope[]).map((scope) => (
              <button
                key={scope}
                type="button"
                className={form.scope === scope ? 'is-active' : ''}
                onClick={() => setForm((current) => ({ ...current, scope, targetIds: [] }))}
              >
                <strong>{scopeLabel(scope)}</strong>
                <span>{scope === 'ALL' ? 'Every eligible Store resource' : scope === 'PACKAGES' ? 'One or more learning packages' : 'One or more subject libraries'}</span>
              </button>
            ))}
          </div>
          {form.scope !== 'ALL' ? (
            <div className="pf-coupon-target-list" role="group" aria-label={`Choose ${form.scope.toLowerCase()}`}>
              {targets.length ? targets.map((target) => (
                <label key={target.id}>
                  <input type="checkbox" checked={form.targetIds.includes(target.id)} onChange={() => toggleTarget(target.id)} />
                  <span><Check size={13} aria-hidden="true" /></span>
                  <strong>{'title' in target ? target.title : target.name}</strong>
                </label>
              )) : <p>No {form.scope === 'PACKAGES' ? 'packages' : 'subjects'} are available yet.</p>}
            </div>
          ) : null}
          {submitted && errors.targetIds ? <em className="pf-coupon-field-error">{errors.targetIds}</em> : null}
        </fieldset>

        <div className="pf-coupon-form__grid">
          <fieldset className="pf-coupon-fieldset">
            <legend>Maximum uses</legend>
            <div className="pf-coupon-segments">
              <button type="button" className={form.usageMode === 'unlimited' ? 'is-active' : ''} onClick={() => update('usageMode', 'unlimited')}>Unlimited</button>
              <button type="button" className={form.usageMode === 'limited' ? 'is-active' : ''} onClick={() => update('usageMode', 'limited')}>Limited</button>
            </div>
            {form.usageMode === 'limited' ? <input className="pf-admin-input" inputMode="numeric" value={form.maxUses} onChange={(event) => update('maxUses', event.target.value)} placeholder="Number of redemptions" /> : null}
            {submitted && errors.maxUses ? <em className="pf-coupon-field-error">{errors.maxUses}</em> : null}
          </fieldset>
          <fieldset className="pf-coupon-fieldset">
            <legend>Expiry</legend>
            <div className="pf-coupon-segments">
              <button type="button" className={form.expiryMode === 'none' ? 'is-active' : ''} onClick={() => update('expiryMode', 'none')}>No expiry</button>
              <button type="button" className={form.expiryMode === 'date' ? 'is-active' : ''} onClick={() => update('expiryMode', 'date')}>Choose date</button>
            </div>
            {form.expiryMode === 'date' ? <AdminDatePicker value={form.expiresAt} onChange={(value) => update('expiresAt', value)} min={new Date().toISOString().slice(0, 10)} placeholder="Choose expiry date" /> : null}
            {submitted && errors.expiresAt ? <em className="pf-coupon-field-error">{errors.expiresAt}</em> : null}
          </fieldset>
        </div>

        <label className="pf-coupon-switch-row">
          <span><strong>Enable coupon</strong><small>Customers can redeem it immediately when all other rules allow.</small></span>
          <input type="checkbox" checked={form.enabled} onChange={(event) => update('enabled', event.target.checked)} />
        </label>
        {submitError ? <p className="pf-coupon-submit-error" role="alert">{submitError}</p> : null}
      </form>
    </AdminDialog>
  );
};

const CouponsPage: React.FC = () => {
  const { status, error, coupons, pendingId, initialize, refresh, createCoupon, updateCoupon, setCouponEnabled, deleteCoupon } = useCouponStore();
  const { packages, initialize: initializePackages } = usePackageStore();
  const [subjects, setSubjects] = useState<ContentItem[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | CouponStatus>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | CouponDiscountType>('ALL');
  const [scopeFilter, setScopeFilter] = useState<'ALL_FILTER' | CouponScope>('ALL_FILTER');
  const [sort, setSort] = useState<CouponSort>('newest');
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [details, setDetails] = useState<Coupon | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [toast, setToast] = useState<AdminToastData | null>(null);

  useEffect(() => {
    void initialize();
    void initializePackages();
    void contentRepository.getFolders().then((items) => setSubjects(items.filter((item) => item.entityType === 'subject'))).catch(() => setSubjects([]));
  }, [initialize, initializePackages]);

  const targetNames = useMemo(() => new Map([
    ...packages.map((item) => [item.id, item.title] as const),
    ...subjects.map((item) => [item.id, item.name] as const),
  ]), [packages, subjects]);

  const filtered = useMemo(() => coupons
    .filter((coupon) => coupon.code.toLowerCase().includes(search.trim().toLowerCase()))
    .filter((coupon) => statusFilter === 'ALL' || getCouponStatus(coupon) === statusFilter)
    .filter((coupon) => typeFilter === 'ALL' || coupon.discountType === typeFilter)
    .filter((coupon) => scopeFilter === 'ALL_FILTER' || coupon.scope === scopeFilter)
    .sort((left, right) => {
      if (sort === 'newest') return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      if (sort === 'oldest') return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
      if (sort === 'code-asc') return left.code.localeCompare(right.code);
      if (sort === 'value-high') return right.discountValue - left.discountValue;
      return left.discountValue - right.discountValue;
    }), [coupons, search, statusFilter, typeFilter, scopeFilter, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleCoupons = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => setPage(1), [search, statusFilter, typeFilter, scopeFilter, sort]);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const showToast = (next: Omit<AdminToastData, 'id'>) => setToast({ ...next, id: Date.now() });
  const resetFilters = () => { setSearch(''); setStatusFilter('ALL'); setTypeFilter('ALL'); setScopeFilter('ALL_FILTER'); setSort('newest'); };
  const openEdit = (coupon: Coupon) => { setMenuId(null); setEditor({ mode: 'edit', coupon }); };

  const couponTargets = (coupon: Coupon) => coupon.scope === 'ALL'
    ? 'All eligible resources'
    : coupon.targetIds.map((id) => targetNames.get(id) ?? 'Unavailable item').join(', ');

  return (
    <motion.main className="pf-admin-page pf-coupons-page" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: EASE }}>
      <AdminPageHeader
        breadcrumbs={[{ label: 'Admin', to: ROUTES.ADMIN_OVERVIEW }, { label: 'Coupons' }]}
        title="Coupons"
        description="Percent or flat discounts, scoped to everything, specific packages or subjects."
        actions={<button className="pf-admin-button" type="button" onClick={() => setEditor({ mode: 'create', coupon: null })}><Plus size={16} /> New coupon</button>}
      />

      <section className="pf-coupon-library" aria-label="Coupon management">
        <div className="pf-coupon-toolbar">
          <label className="pf-admin-search-field">
            <Search aria-hidden="true" />
            <span className="pf-admin-sr-only">Search coupon code</span>
            <input className="pf-admin-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search coupon code" />
          </label>
          <label className="pf-admin-field"><span>Status</span><AppSelect className="pf-admin-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="EXPIRED">Expired</option><option value="EXHAUSTED">Exhausted</option><option value="DISABLED">Disabled</option></AppSelect></label>
          <label className="pf-admin-field"><span>Type</span><AppSelect className="pf-admin-select" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}><option value="ALL">All types</option><option value="PERCENT">Percentage</option><option value="FLAT">Flat amount</option></AppSelect></label>
          <label className="pf-admin-field"><span>Scope</span><AppSelect className="pf-admin-select" value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value as typeof scopeFilter)}><option value="ALL_FILTER">All scopes</option><option value="ALL">Everything</option><option value="PACKAGES">Packages</option><option value="SUBJECTS">Subjects</option></AppSelect></label>
          <label className="pf-admin-field"><span>Sort</span><AppSelect className="pf-admin-select" value={sort} onChange={(event) => setSort(event.target.value as CouponSort)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="code-asc">Code A–Z</option><option value="value-high">Highest discount</option><option value="value-low">Lowest discount</option></AppSelect></label>
        </div>

        {status === 'loading' && !coupons.length ? <AdminSkeleton variant="table" rows={6} label="Loading coupons" /> : null}
        {status === 'error' && !coupons.length ? (
          <AdminEmptyState compact icon={<TicketPercent size={22} />} title="Coupons could not be loaded" description={error ?? 'Please try again.'} action={<button className="pf-admin-button" type="button" onClick={() => void refresh()}><RefreshCw size={15} /> Retry</button>} />
        ) : null}
        {status !== 'loading' && status !== 'error' && !coupons.length ? (
          <AdminEmptyState compact icon={<TicketPercent size={22} />} title="No coupons yet" description="Create a coupon to offer a controlled Store discount." action={<button className="pf-admin-button" type="button" onClick={() => setEditor({ mode: 'create', coupon: null })}><Plus size={15} /> New coupon</button>} />
        ) : null}
        {coupons.length && !visibleCoupons.length ? (
          <AdminEmptyState compact icon={<Search size={22} />} title="No matching coupons" description="Try changing the search or filters." action={<button className="pf-admin-button pf-admin-button--secondary" type="button" onClick={resetFilters}>Clear filters</button>} />
        ) : null}

        {visibleCoupons.length ? (
          <>
            <div className="pf-coupon-table-wrap">
              <table className="pf-coupon-table">
                <thead><tr><th>Code</th><th>Discount</th><th>Applies to</th><th>Usage</th><th>Expiry</th><th>Status</th><th>Created</th><th><span className="pf-admin-sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {visibleCoupons.map((coupon) => {
                    const meta = statusMeta[getCouponStatus(coupon)];
                    return (
                      <motion.tr key={coupon.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: EASE }}>
                        <td><button className="pf-coupon-code" type="button" onClick={() => { void navigator.clipboard?.writeText(coupon.code); showToast({ title: 'Code copied', message: coupon.code, tone: 'info' }); }}><strong>{coupon.code}</strong><Copy size={12} aria-hidden="true" /></button></td>
                        <td><strong>{formatDiscount(coupon)}</strong><small>{coupon.discountType === 'PERCENT' ? 'Percentage' : 'Flat amount'}</small></td>
                        <td title={couponTargets(coupon)}><strong>{scopeLabel(coupon.scope)}</strong><small>{coupon.scope === 'ALL' ? 'Store-wide' : `${coupon.targetIds.length} selected`}</small></td>
                        <td><strong>{coupon.usageCount}{coupon.maxUses === null ? '' : ` / ${coupon.maxUses}`}</strong><small>{coupon.maxUses === null ? 'Unlimited' : 'Redemptions'}</small></td>
                        <td><strong>{formatDate(coupon.expiresAt)}</strong><small>{coupon.expiresAt ? 'End of day' : 'Always available'}</small></td>
                        <td><AdminStatusBadge tone={meta.tone}>{meta.label}</AdminStatusBadge></td>
                        <td><strong>{formatDate(coupon.createdAt)}</strong></td>
                        <td className="pf-coupon-actions-cell">
                          <button className="pf-admin-icon-button" type="button" aria-label={`Actions for ${coupon.code}`} aria-expanded={menuId === coupon.id} onClick={() => setMenuId(menuId === coupon.id ? null : coupon.id)}><MoreHorizontal size={17} /></button>
                          <AnimatePresence>{menuId === coupon.id ? (
                            <motion.div className="pf-coupon-action-menu" initial={{ opacity: 0, y: -4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -3, scale: 0.99 }} transition={{ duration: 0.15 }}>
                              <button type="button" onClick={() => { setMenuId(null); setDetails(coupon); }}><Eye size={14} /> View details</button>
                              <button type="button" onClick={() => openEdit(coupon)}><Pencil size={14} /> Edit</button>
                              <button type="button" onClick={() => { setMenuId(null); setConfirm({ action: 'toggle', coupon }); }}><Power size={14} /> {coupon.enabled ? 'Disable' : 'Enable'}</button>
                              <button className="is-danger" type="button" onClick={() => { setMenuId(null); setConfirm({ action: 'delete', coupon }); }}><Trash2 size={14} /> Delete</button>
                            </motion.div>
                          ) : null}</AnimatePresence>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="pf-coupon-card-list">
              {visibleCoupons.map((coupon) => {
                const meta = statusMeta[getCouponStatus(coupon)];
                return (
                  <motion.article className="pf-coupon-card" key={coupon.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    <header><button className="pf-coupon-code" type="button" onClick={() => void navigator.clipboard?.writeText(coupon.code)}><strong>{coupon.code}</strong><Copy size={12} /></button><AdminStatusBadge tone={meta.tone}>{meta.label}</AdminStatusBadge></header>
                    <strong className="pf-coupon-card__value">{formatDiscount(coupon)}</strong>
                    <dl><div><dt>Applies to</dt><dd>{scopeLabel(coupon.scope)}</dd></div><div><dt>Usage</dt><dd>{coupon.usageCount}{coupon.maxUses === null ? ' / Unlimited' : ` / ${coupon.maxUses}`}</dd></div><div><dt>Expiry</dt><dd>{formatDate(coupon.expiresAt)}</dd></div><div><dt>Created</dt><dd>{formatDate(coupon.createdAt)}</dd></div></dl>
                    <footer><button type="button" onClick={() => setDetails(coupon)}><Eye size={15} /> Details</button><button type="button" onClick={() => openEdit(coupon)}><Pencil size={15} /> Edit</button><button type="button" onClick={() => setConfirm({ action: 'toggle', coupon })}><Power size={15} /> {coupon.enabled ? 'Disable' : 'Enable'}</button><button className="is-danger" type="button" onClick={() => setConfirm({ action: 'delete', coupon })} aria-label={`Delete ${coupon.code}`}><Trash2 size={15} /></button></footer>
                  </motion.article>
                );
              })}
            </div>

            <footer className="pf-coupon-pagination"><p>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</p><div><button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page} of {pageCount}</span><button type="button" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)}>Next</button></div></footer>
          </>
        ) : null}
      </section>

      <CouponEditor
        editor={editor}
        coupons={coupons}
        packages={packages}
        subjects={subjects}
        pending={pendingId === 'create' || pendingId === editor?.coupon?.id}
        onClose={() => setEditor(null)}
        onSubmit={async (input) => {
          if (editor?.mode === 'edit') {
            const { code: _code, ...updateInput } = input;
            await updateCoupon(editor.coupon.id, updateInput);
          } else await createCoupon(input);
          showToast({ title: editor?.mode === 'edit' ? 'Coupon updated' : 'Coupon created', message: `${input.code} is ready.`, tone: 'success' });
          setEditor(null);
        }}
      />

      <AdminDialog open={Boolean(details)} onClose={() => setDetails(null)} title={details?.code ?? 'Coupon details'} description="Complete discount rules and redemption activity." size="medium" footer={<><button className="pf-admin-button pf-admin-button--secondary" type="button" onClick={() => setDetails(null)}>Close</button>{details ? <button className="pf-admin-button" type="button" onClick={() => { const coupon = details; setDetails(null); openEdit(coupon); }}><Pencil size={15} /> Edit coupon</button> : null}</>}>
        {details ? <div className="pf-coupon-details"><div className="pf-coupon-details__hero"><TicketPercent size={22} /><div><strong>{formatDiscount(details)}</strong><AdminStatusBadge tone={statusMeta[getCouponStatus(details)].tone}>{statusMeta[getCouponStatus(details)].label}</AdminStatusBadge></div></div><dl><div><dt>Type</dt><dd>{details.discountType === 'PERCENT' ? 'Percentage' : 'Flat amount'}</dd></div><div><dt>Scope</dt><dd>{scopeLabel(details.scope)}</dd></div><div><dt>Targets</dt><dd>{couponTargets(details)}</dd></div><div><dt>Usage</dt><dd>{details.usageCount}{details.maxUses === null ? ' / Unlimited' : ` / ${details.maxUses}`}</dd></div><div><dt>Expires</dt><dd>{formatDate(details.expiresAt)}</dd></div><div><dt>Created</dt><dd>{formatDate(details.createdAt)}</dd></div></dl></div> : null}
      </AdminDialog>

      <AdminDialog open={Boolean(confirm)} onClose={() => { if (!pendingId) setConfirm(null); }} title={confirm?.action === 'delete' ? 'Delete coupon?' : `${confirm?.coupon.enabled ? 'Disable' : 'Enable'} coupon?`} description={confirm?.action === 'delete' ? 'This action cannot be undone.' : 'This changes whether customers can redeem this code.'} size="small" footer={<><button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={() => setConfirm(null)} disabled={Boolean(pendingId)}>Cancel</button><button className={`pf-admin-button${confirm?.action === 'delete' ? ' pf-admin-button--danger' : ''}`} type="button" disabled={Boolean(pendingId)} onClick={async () => { if (!confirm) return; const current = confirm; try { if (current.action === 'delete') await deleteCoupon(current.coupon.id); else await setCouponEnabled(current.coupon.id, !current.coupon.enabled); showToast({ title: current.action === 'delete' ? 'Coupon deleted' : `Coupon ${current.coupon.enabled ? 'disabled' : 'enabled'}`, message: current.coupon.code, tone: 'success' }); setConfirm(null); } catch (actionError) { showToast({ title: 'Action failed', message: actionError instanceof Error ? actionError.message : 'Please try again.', tone: 'error' }); } }}>{pendingId ? 'Working…' : confirm?.action === 'delete' ? 'Delete coupon' : confirm?.coupon.enabled ? 'Disable coupon' : 'Enable coupon'}</button></>}>
        <div className="pf-coupon-confirm"><TicketPercent size={22} /><p><strong>{confirm?.coupon.code}</strong><br />{confirm?.action === 'delete' ? 'Existing uses remain in order history, but this code will be permanently removed.' : `The coupon will become ${confirm?.coupon.enabled ? 'unavailable' : 'available'} in the Store.`}</p></div>
      </AdminDialog>

      <AdminToast toast={toast} onDismiss={() => setToast(null)} />
    </motion.main>
  );
};

export default CouponsPage;
