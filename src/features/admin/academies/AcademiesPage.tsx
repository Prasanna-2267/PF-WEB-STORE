import React, { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Archive,
  ArrowLeft,
  BookOpen,
  Building2,
  Check,
  ChevronRight,
  Clipboard,
  Clock3,
  ExternalLink,
  FileText,
  HelpCircle,
  Mail,
  Megaphone,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  UserRoundCog,
  UsersRound,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/app/store/useAuthStore';
import { buildAdminAcademyPath, ROUTES } from '@/config/routes';
import { ReadOnlyPagination } from '@/components/ReadOnlyPagination';
import { ReadOnlyQueryState } from '@/components/ReadOnlyQueryState';
import {
  type AdminAcademyDetailDto,
  type AdminAcademyDetailResource,
  type AdminAcademyDto,
  type AdminAcademyStatus,
  type CreateAcademyInput,
  useAcademyLifecycle,
  useAdminAcademiesReadOnly,
  useAdminAcademyReadOnly,
  useAdminAcademyDetailResource,
  useCreateAdminAcademy,
  useUpdateAdminAcademy,
} from '../readOnly/adminReadOnlyApi';
import {
  AdminDialog,
  AdminEmptyState,
  AdminPageHeader,
  AdminSkeleton,
  AdminStatusBadge,
  AdminToast,
  type AdminToastData,
} from '../AdminUi';
import './academies.css';

const ADMIN_EASE = [0.22, 1, 0.36, 1] as const;
type AcademySort = 'newest' | 'oldest' | 'name-asc' | 'name-desc' | 'students' | 'courses';
type AcademyDetailTab = 'overview' | 'students' | 'courses' | 'content' | 'questions' | 'broadcasts' | 'audit';

const blankInput = (): CreateAcademyInput => ({
  name: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  country: 'India',
  postalCode: '',
  website: '',
  description: '',
  adminName: '',
  adminEmail: '',
  adminPhone: '',
});

const academyToInput = (academy: AdminAcademyDto): CreateAcademyInput => ({
  name: academy.name,
  email: academy.email,
  phone: academy.phone,
  address: academy.address,
  city: academy.city,
  state: academy.state,
  country: academy.country,
  postalCode: academy.postalCode,
  website: academy.website || '',
  description: academy.description || '',
  adminName: academy.adminName,
  adminEmail: academy.adminEmail,
  adminPhone: academy.adminPhone || '',
});

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[+\d][\d\s()-]{6,20}$/;

const statusTone = (status: AdminAcademyStatus): 'success' | 'warning' | 'danger' | 'info' => {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'PENDING':
      return 'warning';
    case 'SUSPENDED':
      return 'danger';
    case 'ARCHIVED':
      return 'info';
    default:
      return 'info';
  }
};

const formatDate = (value?: string | null, includeTime = false) => {
  if (!value) return 'Unavailable';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(new Date(value));
};

const formatDateParts = (value?: string | null) => {
  if (!value) return { date: 'Unavailable', time: '' };
  const date = new Date(value);
  return {
    date: new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(date),
    time: new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(date),
  };
};

const formatNumber = (value: number) => new Intl.NumberFormat('en-IN').format(value);
const formatFileSize = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const unit = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: unit ? 1 : 0 }).format(value / 1024 ** unit)} ${units[unit]}`;
};

const plainText = (value: string) => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

interface AcademyEditorProps {
  academy?: AdminAcademyDto | null;
  saving: boolean;
  error: string | null;
  onSubmit: (input: CreateAcademyInput) => Promise<void>;
}

const AcademyEditor: React.FC<AcademyEditorProps> = ({ academy, saving, error, onSubmit }) => {
  const [form, setForm] = useState<CreateAcademyInput>(() => (academy ? academyToInput(academy) : blankInput()));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setField = (field: keyof CreateAcademyInput, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = 'Academy name is required.';
    if (!form.email.trim()) next.email = 'Academy email is required.';
    else if (!emailPattern.test(form.email.trim())) next.email = 'Enter a valid academy email.';
    if (!form.phone.trim()) next.phone = 'Academy phone number is required.';
    else if (!phonePattern.test(form.phone.trim())) next.phone = 'Enter a valid phone number.';
    if (!form.address.trim()) next.address = 'Street address is required.';
    if (!form.city.trim()) next.city = 'City is required.';
    if (!form.state.trim()) next.state = 'State is required.';
    if (!form.postalCode.trim()) next.postalCode = 'Postal code is required.';

    if (!form.adminName.trim()) next.adminName = 'Admin name is required.';
    if (!form.adminEmail.trim()) next.adminEmail = 'Admin email is required.';
    else if (!emailPattern.test(form.adminEmail.trim())) next.adminEmail = 'Enter a valid admin email.';
    if (form.adminPhone?.trim() && !phonePattern.test(form.adminPhone.trim())) next.adminPhone = 'Enter a valid phone number.';

    if (form.website?.trim()) {
      try {
        new URL(form.website.trim());
      } catch {
        next.website = 'Use a complete URL, such as https://academy.example.com';
      }
    }
    setErrors(next);
    return !Object.keys(next).length;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (validate()) await onSubmit(form);
  };

  const field = (name: keyof CreateAcademyInput, label: string, placeholder: string, type = 'text', required = false) => (
    <label className="pf-admin-field">
      <span>
        {label}
        {required ? <b aria-hidden="true"> *</b> : null}
      </span>
      <input
        className="pf-admin-input"
        type={type}
        value={String(form[name] ?? '')}
        onChange={(event) => setField(name, event.target.value)}
        placeholder={placeholder}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? `academy-${name}-error` : undefined}
      />
      {errors[name] ? (
        <small className="pf-academy-field-error" id={`academy-${name}-error`}>
          {errors[name]}
        </small>
      ) : null}
    </label>
  );

  return (
    <form id="academy-editor-form" className="pf-academy-editor" onSubmit={submit} noValidate>
      <fieldset disabled={saving}>
        <legend>
          <Building2 size={16} className="pf-academy-editor__legend-icon" /> Organization information
        </legend>
        <div className="pf-academy-editor__grid">
          {field('name', 'Academy name', 'Ink Academy', 'text', true)}
          {field('email', 'Academy email', 'hello@academy.edu', 'email', true)}
          {field('phone', 'Academy phone number', '+91 98765 43210', 'tel', true)}
          {field('website', 'Website', 'https://academy.edu', 'url')}
          <label className="pf-admin-field pf-academy-editor__wide pf-admin-field--wide">
            <span>
              Address<b aria-hidden="true"> *</b>
            </span>
            <input
              className="pf-admin-input"
              value={form.address}
              onChange={(event) => setField('address', event.target.value)}
              placeholder="Street address"
              aria-invalid={Boolean(errors.address)}
            />
            {errors.address ? <small className="pf-academy-field-error">{errors.address}</small> : null}
          </label>
          {field('city', 'City', 'Bengaluru', 'text', true)}
          {field('state', 'State', 'Karnataka', 'text', true)}
          {field('country', 'Country', 'India')}
          {field('postalCode', 'Postal code', '560038', 'text', true)}
          <label className="pf-admin-field pf-academy-editor__wide pf-admin-field--wide">
            <span>Description</span>
            <textarea
              className="pf-admin-textarea"
              value={form.description ?? ''}
              onChange={(event) => setField('description', event.target.value)}
              placeholder="Briefly describe this academy and its learning focus."
            />
          </label>
        </div>
      </fieldset>
      <fieldset disabled={saving}>
        <legend>
          <UsersRound size={16} className="pf-academy-editor__legend-icon" /> Academy Administrator
        </legend>
        <p className="pf-academy-editor__hint">This primary identity will receive platform management access for this academy.</p>
        <div className="pf-academy-editor__grid">
          {field('adminName', 'Admin name', 'John Doe', 'text', true)}
          {field('adminEmail', 'Admin email', 'john@academy.edu', 'email', true)}
          {field('adminPhone', 'Admin phone', '+91 98450 11223', 'tel')}
        </div>
      </fieldset>
      {error ? (
        <p className="pf-academy-form-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
};

const AcademyEditorDialog: React.FC<{
  academy?: AdminAcademyDto | null;
  open: boolean;
  onClose: () => void;
  onSaved: (name: string) => void;
}> = ({ academy, open, onClose, onSaved }) => {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const createMutation = useCreateAdminAcademy(userId);
  const updateMutation = useUpdateAdminAcademy(userId);
  const saving = createMutation.isPending || updateMutation.isPending;
  const [error, setError] = useState<string | null>(null);

  const submit = async (input: CreateAcademyInput) => {
    setError(null);
    try {
      if (academy) {
        await updateMutation.mutateAsync({ academyId: academy.id, input });
      } else {
        await createMutation.mutateAsync(input);
      }
      onSaved(input.name);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Academy could not be saved.');
    }
  };

  return (
    <AdminDialog
      open={open}
      onClose={onClose}
      size="large"
      title={academy ? 'Edit Academy' : 'New Academy'}
      description={
        academy
          ? 'Update the organization details and primary administrator.'
          : 'Create an independent tenant organization on Parallax Flow.'
      }
      footer={
        <>
          <button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="pf-admin-button" type="submit" form="academy-editor-form" disabled={saving}>
            {saving ? 'Saving…' : academy ? 'Save changes' : 'Create Academy'}
          </button>
        </>
      }
    >
      <AcademyEditor academy={academy} saving={saving} error={error} onSubmit={submit} />
    </AdminDialog>
  );
};

const AcademyActions: React.FC<{
  academy: AdminAcademyDto;
  onEdit: () => void;
  onLifecycle: (action: 'activate' | 'suspend' | 'archive' | 'restore' | 'delete') => void;
  onCopied: () => void;
}> = ({ academy, onEdit, onLifecycle, onCopied }) => {
  const closeDetails = (event: React.MouseEvent) => {
    const details = event.currentTarget.closest('details');
    if (details) details.open = false;
  };

  return (
    <details className="pf-academy-actions" onClick={(event) => event.stopPropagation()}>
      <summary aria-label={`Actions for ${academy.name}`}>
        <MoreHorizontal size={17} />
      </summary>
      <div className="pf-academy-actions__menu">
        <Link to={buildAdminAcademyPath(academy.id)} onClick={closeDetails}>
          <Building2 size={14} /> View Details
        </Link>
        <button
          type="button"
          onClick={(e) => {
            closeDetails(e);
            onEdit();
          }}
        >
          <Pencil size={14} /> Edit Academy
        </button>
        <button
          type="button"
          onClick={(e) => {
            closeDetails(e);
            onCopied();
          }}
        >
          <Clipboard size={14} /> Copy Academy ID
        </button>
        {academy.status === 'SUSPENDED' || academy.status === 'PENDING' ? (
          <button
            type="button"
            onClick={(e) => {
              closeDetails(e);
              onLifecycle('activate');
            }}
          >
            <ShieldCheck size={14} /> Activate Academy
          </button>
        ) : academy.status === 'ACTIVE' ? (
          <button
            type="button"
            className="is-danger"
            onClick={(e) => {
              closeDetails(e);
              onLifecycle('suspend');
            }}
          >
            <ShieldCheck size={14} /> Suspend Academy
          </button>
        ) : null}
        {academy.status !== 'ARCHIVED' ? (
          <button
            type="button"
            className="is-danger"
            onClick={(e) => {
              closeDetails(e);
              onLifecycle('archive');
            }}
          >
            <Archive size={14} /> Archive Academy
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              closeDetails(e);
              onLifecycle('restore');
            }}
          >
            <RotateCcw size={14} /> Restore Academy
          </button>
        )}
      </div>
    </details>
  );
};

export const AcademiesPage: React.FC = () => {
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.user?.id ?? null);

  const [page, setPage] = useState(1);
  const [queryInput, setQueryInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AdminAcademyStatus | 'ALL' | ''>('ALL');
  const [sort, setSort] = useState<AcademySort>('newest');

  const [editor, setEditor] = useState<AdminAcademyDto | null | undefined>(undefined);
  const [lifecycleTarget, setLifecycleTarget] = useState<{
    academy: AdminAcademyDto;
    action: 'activate' | 'suspend' | 'archive' | 'restore' | 'delete';
  } | null>(null);

  const [toast, setToast] = useState<AdminToastData | null>(null);

  const academiesQuery = useAdminAcademiesReadOnly(userId, {
    page,
    limit: 25,
    search: search || undefined,
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
    sort,
  });

  const lifecycleMutation = useAcademyLifecycle(userId);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(queryInput.trim());
  };

  const executeLifecycle = async () => {
    if (!lifecycleTarget) return;
    try {
      await lifecycleMutation.mutateAsync({ academyId: lifecycleTarget.academy.id, action: lifecycleTarget.action });
      setToast({
        id: Date.now(),
        title: `Academy ${lifecycleTarget.action}d`,
        message: `${lifecycleTarget.academy.name} has been ${lifecycleTarget.action}d successfully.`,
        tone: 'success',
      });
      setLifecycleTarget(null);
    } catch (reason) {
      setToast({
        id: Date.now(),
        title: 'Action failed',
        message: reason instanceof Error ? reason.message : 'Please try again.',
        tone: 'error',
      });
    }
  };

  const copyId = async (academy: AdminAcademyDto) => {
    try {
      await navigator.clipboard.writeText(academy.id);
      setToast({ id: Date.now(), title: 'Academy ID copied', message: academy.id, tone: 'success' });
    } catch {
      setToast({ id: Date.now(), title: 'Academy ID', message: academy.id, tone: 'info' });
    }
  };

  return (
    <motion.div
      className="pf-admin-page pf-academies-page"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: ADMIN_EASE }}
    >
      <AdminPageHeader
        title="Academies"
        description="Manage and oversee all academies on the platform."
      />

      <section className="pf-academy-list-card">
        <form className="pf-academy-toolbar" onSubmit={handleSearchSubmit}>
          <label className="pf-admin-search-field">
            <Search size={17} />
            <span className="pf-admin-sr-only">Search academies</span>
            <input
              className="pf-admin-input"
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Search name, admin, email, or city"
            />
          </label>
          <label className="pf-admin-field pf-academy-toolbar__select">
            <span className="pf-admin-sr-only">Status</span>
            <select
              className="pf-admin-select"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as AdminAcademyStatus | 'ALL');
                setPage(1);
              }}
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="PENDING">Pending</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </label>
          <label className="pf-admin-field pf-academy-toolbar__select">
            <span className="pf-admin-sr-only">Sort</span>
            <select
              className="pf-admin-select"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as AcademySort);
                setPage(1);
              }}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name-asc">Name A–Z</option>
              <option value="name-desc">Name Z–A</option>
              <option value="students">Most students</option>
              <option value="courses">Most courses</option>
            </select>
          </label>
          <button className="pf-admin-button pf-academy-toolbar__add" type="button" onClick={() => setEditor(null)}>
            <Plus size={16} /> Add Academy
          </button>
        </form>

        {academiesQuery.isPending ? (
          <AdminSkeleton rows={6} variant="table" label="Loading academies from database" />
        ) : academiesQuery.isError ? (
          <ReadOnlyQueryState error={academiesQuery.error} onRetry={() => void academiesQuery.refetch()} resource="Academies" />
        ) : academiesQuery.data.items.length ? (
          <>
            <div className="pf-academy-table-wrap">
              <table className="pf-academy-table">
                <thead>
                  <tr>
                    <th>Academy</th>
                    <th>Admin</th>
                    <th>Students</th>
                    <th>Courses</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {academiesQuery.data.items.map((academy) => (
                      <motion.tr
                        key={academy.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        onClick={() => navigate(buildAdminAcademyPath(academy.id))}
                      >
                        <td data-label="Academy">
                          <Link to={buildAdminAcademyPath(academy.id)} onClick={(event) => event.stopPropagation()}>
                            <span className="pf-academy-mark" aria-hidden="true">
                              {academy.name.charAt(0)}
                            </span>
                            <span className="pf-academy-identity__text">
                              <strong>{academy.name}</strong>
                              <small title={academy.email}>{academy.email}</small>
                            </span>
                          </Link>
                        </td>
                        <td data-label="Admin">
                          <span className="pf-academy-admin-summary">
                            <strong>{academy.adminName}</strong>
                            <small title={academy.adminEmail}>{academy.adminEmail}</small>
                          </span>
                        </td>
                        <td data-label="Students">
                          <span className="pf-academy-stat-pill">
                            <span><UsersRound size={15} /><strong>{formatNumber(academy.studentCount)}</strong></span>
                            <small>Students</small>
                          </span>
                        </td>
                        <td data-label="Courses">
                          <span className="pf-academy-stat-pill">
                            <span><BookOpen size={15} /><strong>{formatNumber(academy.courseCount)}</strong></span>
                            <small>Courses</small>
                          </span>
                        </td>
                        <td data-label="Status">
                          <AdminStatusBadge tone={statusTone(academy.status)}>{academy.status}</AdminStatusBadge>
                        </td>
                        <td data-label="Created">
                          <span className="pf-academy-created">
                            <strong>{formatDateParts(academy.createdAt).date}</strong>
                            <small>{formatDateParts(academy.createdAt).time}</small>
                          </span>
                        </td>
                        <td className="pf-academy-table__actions">
                          <AcademyActions
                            academy={academy}
                            onEdit={() => setEditor(academy)}
                            onCopied={() => void copyId(academy)}
                            onLifecycle={(action) => setLifecycleTarget({ academy, action })}
                          />
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
            <ReadOnlyPagination
              page={academiesQuery.data.pagination.page}
              totalPages={academiesQuery.data.pagination.totalPages}
              total={academiesQuery.data.pagination.total}
              onPageChange={setPage}
              pageSize={academiesQuery.data.pagination.limit}
              noun="academies"
              compact
            />
          </>
        ) : (
          <AdminEmptyState
            icon={<Building2 size={22} />}
            title="No academies found"
            description={
              search || statusFilter !== 'ALL'
                ? 'Try a broader search query or adjust status filter.'
                : 'Create your first Academy to start managing independent educational organizations.'
            }
            action={
              !search && statusFilter === 'ALL' ? (
                <button className="pf-admin-button" onClick={() => setEditor(null)}>
                  <Plus size={16} /> New Academy
                </button>
              ) : undefined
            }
          />
        )}
      </section>

      <AcademyEditorDialog
        key={editor?.id ?? 'new'}
        open={editor !== undefined}
        academy={editor}
        onClose={() => setEditor(undefined)}
        onSaved={(name) =>
          setToast({
            id: Date.now(),
            title: editor ? 'Academy updated' : 'Academy created',
            message: `${name} has been ${editor ? 'updated' : 'created'} in the database.`,
            tone: 'success',
          })
        }
      />

      <AdminDialog
        open={Boolean(lifecycleTarget)}
        onClose={() => setLifecycleTarget(null)}
        size="small"
        title={`${lifecycleTarget?.action ? lifecycleTarget.action.charAt(0).toUpperCase() + lifecycleTarget.action.slice(1) : 'Update'} ${
          lifecycleTarget?.academy.name ?? 'Academy'
        }?`}
        description={
          lifecycleTarget?.action === 'suspend'
            ? 'Access for this academy and its users will be restricted.'
            : lifecycleTarget?.action === 'archive'
            ? 'The academy will be hidden from main operational queries.'
            : 'The academy will return to active status on the platform.'
        }
        footer={
          <>
            <button
              className="pf-admin-button pf-admin-button--quiet"
              onClick={() => setLifecycleTarget(null)}
              disabled={lifecycleMutation.isPending}
            >
              Cancel
            </button>
            <button
              className={`pf-admin-button${
                lifecycleTarget?.action === 'suspend' || lifecycleTarget?.action === 'archive' ? ' pf-admin-button--danger' : ''
              }`}
              onClick={() => void executeLifecycle()}
              disabled={lifecycleMutation.isPending}
            >
              {lifecycleMutation.isPending ? 'Updating…' : 'Confirm'}
            </button>
          </>
        }
      >
        <div className="pf-academy-confirm">
          <ShieldCheck size={23} />
          <p>This state change will take effect immediately across all tenant systems.</p>
        </div>
      </AdminDialog>

      <AdminToast toast={toast} onDismiss={() => setToast(null)} />
    </motion.div>
  );
};

const DetailValue: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="pf-academy-detail-value">
    <span>{label}</span>
    <strong>{children || 'Not provided'}</strong>
  </div>
);

export const AcademyDetailsPage: React.FC = () => {
  const { academyId = '' } = useParams();
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.user?.id ?? null);

  const [editing, setEditing] = useState(false);
  const [lifecycleTarget, setLifecycleTarget] = useState<'activate' | 'suspend' | 'archive' | 'restore' | null>(null);
  const [toast, setToast] = useState<AdminToastData | null>(null);
  const [activeTab, setActiveTab] = useState<AcademyDetailTab>('overview');
  const [resourcePages, setResourcePages] = useState<Record<AdminAcademyDetailResource, number>>({
    students: 1,
    courses: 1,
    content: 1,
    questions: 1,
    broadcasts: 1,
    audit: 1,
  });

  const academyQuery = useAdminAcademyReadOnly(userId, academyId);
  const activeResource = activeTab === 'overview' ? undefined : activeTab;
  const activeResourcePage = activeResource ? resourcePages[activeResource] : 1;
  const academyResourceQuery = useAdminAcademyDetailResource(userId, academyId, activeResource, activeResourcePage);
  const lifecycleMutation = useAcademyLifecycle(userId);

  const changeLifecycle = async (action: 'activate' | 'suspend' | 'archive' | 'restore') => {
    if (!academyQuery.data) return;
    try {
      await lifecycleMutation.mutateAsync({ academyId, action });
      setToast({
        id: Date.now(),
        title: `Academy ${action}d`,
        message: `${academyQuery.data.name} is now ${action}d.`,
        tone: 'success',
      });
      setLifecycleTarget(null);
    } catch (reason) {
      setToast({
        id: Date.now(),
        title: 'Action failed',
        message: reason instanceof Error ? reason.message : 'Please try again.',
        tone: 'error',
      });
    }
  };

  if (academyQuery.isPending) return <AdminSkeleton rows={7} variant="detail" label="Loading Academy details from database" />;
  if (academyQuery.isError || !academyQuery.data)
    return (
      <div className="pf-admin-page">
        <AdminEmptyState
          icon={<Building2 size={22} />}
          title="Academy not found"
          description={academyQuery.error ? academyQuery.error.message : 'This academy record may no longer exist.'}
          action={
            <Link className="pf-admin-button" to={ROUTES.ADMIN_ACADEMIES}>
              <ArrowLeft size={15} /> Back to Academies
            </Link>
          }
        />
      </div>
    );

  const academy = academyQuery.data;
  const metrics = academy.metrics || {
    studentsCount: academy.studentCount,
    activeStudentsCount: academy.activeStudentCount,
    coursesCount: academy.courseCount,
    publishedCoursesCount: academy.activeCourseCount,
    contentCount: 0,
    publishedContentCount: 0,
    packagesCount: academy.packageCount,
    questionsCount: 0,
    broadcastCount: academy.broadcasts.length,
    activeBroadcastCount: academy.broadcasts.filter((broadcast) => broadcast.status === 'ACTIVE').length,
    ordersCount: academy.orderCount,
    revenue: Number(academy.revenue),
  };
  const academyStudents: AdminAcademyDetailDto['students'] = activeResource === 'students'
    ? (academyResourceQuery.data?.data ?? []) as AdminAcademyDetailDto['students']
    : [];
  const academyCourses: AdminAcademyDetailDto['tenantCourses'] = activeResource === 'courses'
    ? (academyResourceQuery.data?.data ?? []) as AdminAcademyDetailDto['tenantCourses']
    : [];
  const academyContent: AdminAcademyDetailDto['contentItems'] = activeResource === 'content'
    ? (academyResourceQuery.data?.data ?? []) as AdminAcademyDetailDto['contentItems']
    : [];
  const academyQuestions: AdminAcademyDetailDto['questions'] = activeResource === 'questions'
    ? (academyResourceQuery.data?.data ?? []) as AdminAcademyDetailDto['questions']
    : [];
  const academyBroadcasts: AdminAcademyDetailDto['broadcasts'] = activeResource === 'broadcasts'
    ? (academyResourceQuery.data?.data ?? []) as AdminAcademyDetailDto['broadcasts']
    : [];
  const academyAuditLogs: NonNullable<AdminAcademyDetailDto['systemAuditLogs']> = activeResource === 'audit'
    ? (academyResourceQuery.data?.data ?? []) as NonNullable<AdminAcademyDetailDto['systemAuditLogs']>
    : [];
  const resourcePagination = (noun: string) => (
    academyResourceQuery.data && activeResource ? (
      <ReadOnlyPagination
        page={academyResourceQuery.data.pagination.page}
        totalPages={academyResourceQuery.data.pagination.totalPages}
        total={academyResourceQuery.data.pagination.total}
        pageSize={academyResourceQuery.data.pagination.limit}
        noun={noun}
        compact
        onPageChange={(page) => setResourcePages((pages) => ({ ...pages, [activeResource]: page }))}
      />
    ) : null
  );
  const administrator = academy.administrator;
  const administratorIdentityLabel = administrator.identityStatus === 'ACTIVE' && administrator.membershipStatus === 'ACTIVE'
    ? 'Active Platform Admin Identity'
    : administrator.membershipStatus === 'INVITED'
      ? 'Administrator invitation pending'
      : `${administrator.membershipStatus.toLowerCase().replaceAll('_', ' ')} administrator identity`;

  const stats = [
    {
      label: 'Students',
      value: formatNumber(metrics.studentsCount),
      detail: `${formatNumber(metrics.activeStudentsCount)} active`,
      icon: UsersRound,
    },
    {
      label: 'Courses',
      value: formatNumber(metrics.coursesCount),
      detail: `${formatNumber(metrics.publishedCoursesCount)} published`,
      icon: BookOpen,
    },
    {
      label: 'Content',
      value: formatNumber(metrics.contentCount),
      detail: 'Files',
      icon: FileText,
    },
    {
      label: 'Questions',
      value: formatNumber(metrics.questionsCount),
      detail: 'Total',
      icon: HelpCircle,
    },
    {
      label: 'Broadcasts',
      value: formatNumber(metrics.broadcastCount),
      detail: `${formatNumber(metrics.activeBroadcastCount)} active`,
      icon: Megaphone,
    },
  ];

  return (
    <motion.div
      className="pf-admin-page pf-academy-detail"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: ADMIN_EASE }}
    >
      <AdminPageHeader
        title={academy.name}
        description={academy.description || 'Independent Academy registered on Parallax Flow platform.'}
        breadcrumbs={[
          { label: 'Admin', to: ROUTES.ADMIN_OVERVIEW },
          { label: 'Academies', to: ROUTES.ADMIN_ACADEMIES },
          { label: academy.name },
        ]}
        actions={
          <>
            <AdminStatusBadge tone={statusTone(academy.status)}>{academy.status}</AdminStatusBadge>
            <button className="pf-admin-button pf-admin-button--secondary" onClick={() => setEditing(true)}>
              <Pencil size={15} /> Edit Academy
            </button>
            {academy.status === 'SUSPENDED' || academy.status === 'PENDING' ? (
              <button className="pf-admin-button" onClick={() => setLifecycleTarget('activate')}>
                <ShieldCheck size={15} /> Activate Academy
              </button>
            ) : academy.status === 'ACTIVE' ? (
              <button className="pf-admin-button pf-admin-button--danger" onClick={() => setLifecycleTarget('suspend')}>
                <ShieldCheck size={15} /> Suspend Academy
              </button>
            ) : null}
          </>
        }
      />

      <section className="pf-academy-stats" aria-label="Academy statistics">
        {stats.map(({ label, value, detail, icon: Icon }) => (
          <article key={label}>
            <span>
              <Icon size={18} />
            </span>
            <div>
              <small>{label}</small>
              <strong>{value}</strong>
              <p>{detail}</p>
            </div>
          </article>
        ))}
      </section>

      {/* Navigation Tabs */}
      <div className="pf-academy-tabs" role="tablist" aria-label="Academy details">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'students', label: `Students (${formatNumber(metrics.studentsCount)})` },
          { key: 'courses', label: `Courses (${formatNumber(metrics.coursesCount)})` },
          { key: 'content', label: `Content (${formatNumber(metrics.contentCount)})` },
          { key: 'questions', label: `Questions (${formatNumber(metrics.questionsCount)})` },
          { key: 'broadcasts', label: `Broadcasts (${formatNumber(metrics.broadcastCount)})` },
          { key: 'audit', label: `Audit Log (${formatNumber(metrics.auditLogCount ?? academy.systemAuditLogs?.length ?? 0)})` },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`pf-academy-tab ${activeTab === tab.key ? 'is-active' : ''}`}
            onClick={() => setActiveTab(tab.key as AcademyDetailTab)}
            role="tab"
            aria-selected={activeTab === tab.key}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab Content */}
      {activeTab === 'overview' && (
        <div className="pf-academy-detail__grid">
          <section className="pf-academy-panel pf-academy-panel--information">
            <header>
              <div>
                <p>Organization</p>
                <h2>Academy Details</h2>
              </div>
              <Building2 size={20} />
            </header>
            <div className="pf-academy-information-grid">
              <DetailValue label="Academy Name">{academy.name}</DetailValue>
              <DetailValue label="Email">
                <a href={`mailto:${academy.email}`}>{academy.email}</a>
              </DetailValue>
              <DetailValue label="Phone">
                <a href={`tel:${academy.phone}`}>{academy.phone}</a>
              </DetailValue>
              <DetailValue label="Website">
                {academy.website ? (
                  <a href={academy.website} target="_blank" rel="noreferrer">
                    Visit website <ExternalLink size={12} />
                  </a>
                ) : (
                  'Not specified'
                )}
              </DetailValue>
              <DetailValue label="Address">{academy.address}</DetailValue>
              <DetailValue label="City">{academy.city}</DetailValue>
              <DetailValue label="State">{academy.state}</DetailValue>
              <DetailValue label="Country">{academy.country}</DetailValue>
              <DetailValue label="Postal Code">{academy.postalCode}</DetailValue>
              <DetailValue label="Academy ID">
                <code>{academy.id}</code>
              </DetailValue>
              <DetailValue label="Created At">{formatDate(academy.createdAt, true)}</DetailValue>
              <DetailValue label="Last Updated">{formatDate(academy.updatedAt, true)}</DetailValue>
            </div>
          </section>

          <aside className="pf-academy-detail__rail">
            <section className="pf-academy-panel pf-academy-admin-card">
              <header>
                <div>
                  <p>Assigned Administrator</p>
                  <h2>Primary Admin</h2>
                </div>
                <UserRoundCog size={20} />
              </header>
              <div className="pf-academy-admin-card__identity">
                <span aria-hidden="true">
                  {administrator.name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join('')}
                </span>
                <div>
                  <strong>{administrator.name}</strong>
                  <small>Manages {academy.name}</small>
                </div>
              </div>
              <ul>
                <li>
                  <Mail size={15} />
                  <a href={`mailto:${administrator.email}`}>{administrator.email}</a>
                </li>
                <li>
                  <Phone size={15} />
                  {administrator.phone || 'Phone not provided'}
                </li>
                <li>
                  <ShieldCheck size={15} />
                  {administratorIdentityLabel}
                </li>
              </ul>
            </section>

            <section className="pf-academy-panel pf-academy-status-card">
              <header>
                <div>
                  <p>Academy Status</p>
                  <h2>Operational State</h2>
                </div>
                <ShieldCheck size={20} />
              </header>
              <dl>
                <div>
                  <dt>Status</dt>
                  <dd><AdminStatusBadge tone={statusTone(academy.status)}>{academy.status}</AdminStatusBadge></dd>
                </div>
                <div>
                  <dt>Type</dt>
                  <dd>Independent Academy</dd>
                </div>
              </dl>
            </section>
          </aside>
        </div>
      )}

      {/* Students Tab */}
      {activeTab === 'students' && (
        <section className="pf-academy-panel">
          <header>
            <div>
              <p>Academy Members</p>
              <h2>Enrolled Students ({formatNumber(metrics.studentsCount)})</h2>
            </div>
            <UsersRound size={20} />
          </header>
          {academyResourceQuery.isPending ? <AdminSkeleton rows={3} label="Loading academy students" /> : academyResourceQuery.isError ? (
            <ReadOnlyQueryState error={academyResourceQuery.error} onRetry={() => void academyResourceQuery.refetch()} resource="Academy students" />
          ) : academyStudents.length ? (
            <ul className="pf-academy-overview-list">
              {academyStudents.map((st) => (
                <li key={st.id}>
                  <span>
                    <strong>{st.user.fullName}</strong>
                    <small>{st.user.email} · Joined {formatDate(st.joinedAt)}</small>
                  </span>
                  <AdminStatusBadge tone={st.status === 'ACTIVE' && st.user.status === 'ACTIVE' ? 'success' : 'danger'}>
                    {st.status === 'ACTIVE' ? st.user.status : st.status}
                  </AdminStatusBadge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="pf-academy-panel__empty">No students are currently enrolled in this academy.</p>
          )}
          {resourcePagination('students')}
        </section>
      )}

      {/* Courses Tab */}
      {activeTab === 'courses' && (
        <section className="pf-academy-panel">
          <header>
            <div>
              <p>Curriculum</p>
              <h2>Academy Courses ({formatNumber(metrics.coursesCount)})</h2>
            </div>
            <BookOpen size={20} />
          </header>
          {academyResourceQuery.isPending ? <AdminSkeleton rows={3} label="Loading academy courses" /> : academyResourceQuery.isError ? (
            <ReadOnlyQueryState error={academyResourceQuery.error} onRetry={() => void academyResourceQuery.refetch()} resource="Academy courses" />
          ) : academyCourses.length ? (
            <div className="pf-academy-table-wrap">
              <table className="pf-academy-table pf-academy-domain-table">
                <thead>
                  <tr>
                    <th>Course Code</th>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {academyCourses.map((c) => (
                    <tr key={c.id}>
                      <td data-label="Course Code"><code>{c.code}</code></td>
                      <td data-label="Title"><strong>{c.name}</strong></td>
                      <td data-label="Status">
                        <AdminStatusBadge tone={c.status === 'ACTIVE' || c.status === 'PUBLISHED' ? 'success' : 'warning'}>
                          {c.status}
                        </AdminStatusBadge>
                      </td>
                      <td data-label="Created">{formatDate(c.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="pf-academy-panel__empty">No courses created for this academy yet.</p>
          )}
          {resourcePagination('courses')}
        </section>
      )}

      {/* Content Tab */}
      {activeTab === 'content' && (
        <section className="pf-academy-panel">
          <header>
            <div>
              <p>Learning Library</p>
              <h2>Academy Content ({formatNumber(metrics.contentCount)})</h2>
            </div>
            <FileText size={20} />
          </header>
          {academyResourceQuery.isPending ? <AdminSkeleton rows={3} label="Loading academy content" /> : academyResourceQuery.isError ? (
            <ReadOnlyQueryState error={academyResourceQuery.error} onRetry={() => void academyResourceQuery.refetch()} resource="Academy content" />
          ) : academyContent.length ? (
            <div className="pf-academy-table-wrap">
              <table className="pf-academy-table pf-academy-domain-table">
                <thead>
                  <tr>
                    <th>Content</th>
                    <th>Course</th>
                    <th>Type &amp; Size</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {academyContent.map((item) => (
                    <tr key={item.id}>
                      <td data-label="Content"><strong>{item.name}</strong></td>
                      <td data-label="Course">{item.course.name}</td>
                      <td data-label="Type & Size">
                        <strong>{item.kind}</strong>
                        <small>{item.kind === 'FILE' ? formatFileSize(item.size) : 'Folder'}</small>
                      </td>
                      <td data-label="Status">
                        <AdminStatusBadge tone={item.status === 'PUBLISHED' ? 'success' : 'warning'}>
                          {item.status}
                        </AdminStatusBadge>
                      </td>
                      <td data-label="Created">{formatDate(item.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="pf-academy-panel__empty">No content has been added to this academy yet.</p>
          )}
          {resourcePagination('content')}
        </section>
      )}

      {/* Questions Tab */}
      {activeTab === 'questions' && (
        <section className="pf-academy-panel">
          <header>
            <div>
              <p>Question Bank</p>
              <h2>Academy Questions ({formatNumber(metrics.questionsCount)})</h2>
            </div>
            <HelpCircle size={20} />
          </header>
          {academyResourceQuery.isPending ? <AdminSkeleton rows={3} label="Loading academy questions" /> : academyResourceQuery.isError ? (
            <ReadOnlyQueryState error={academyResourceQuery.error} onRetry={() => void academyResourceQuery.refetch()} resource="Academy questions" />
          ) : academyQuestions.length ? (
            <div className="pf-academy-table-wrap">
              <table className="pf-academy-table pf-academy-domain-table">
                <thead>
                  <tr>
                    <th>Question</th>
                    <th>Course</th>
                    <th>Type</th>
                    <th>Difficulty</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {academyQuestions.map((question) => (
                    <tr key={question.id}>
                      <td data-label="Question"><strong>{plainText(question.questionHtml || question.caseHtml) || 'Untitled question'}</strong></td>
                      <td data-label="Course">{question.course?.name || 'Unclassified'}</td>
                      <td data-label="Type">{question.kind.replaceAll('_', ' ')}</td>
                      <td data-label="Difficulty">{question.difficulty}</td>
                      <td data-label="Status">
                        <AdminStatusBadge tone={question.status === 'PUBLISHED' ? 'success' : question.status === 'ARCHIVED' ? 'danger' : 'warning'}>
                          {question.status}
                        </AdminStatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="pf-academy-panel__empty">No questions have been created for this academy yet.</p>
          )}
          {resourcePagination('questions')}
        </section>
      )}

      {/* Broadcasts Tab */}
      {activeTab === 'broadcasts' && (
        <section className="pf-academy-panel">
          <header>
            <div>
              <p>Announcements</p>
              <h2>Broadcasts ({formatNumber(metrics.broadcastCount)})</h2>
            </div>
            <Megaphone size={20} />
          </header>
          {academyResourceQuery.isPending ? <AdminSkeleton rows={3} label="Loading academy broadcasts" /> : academyResourceQuery.isError ? (
            <ReadOnlyQueryState error={academyResourceQuery.error} onRetry={() => void academyResourceQuery.refetch()} resource="Academy broadcasts" />
          ) : academyBroadcasts.length ? (
            <ul className="pf-academy-overview-list">
              {academyBroadcasts.map((b) => (
                <li key={b.id}>
                  <span>
                    <strong>{b.title}</strong>
                    <small>Priority: {b.priority} · Published: {formatDate(b.publishedAt)}</small>
                  </span>
                  <AdminStatusBadge tone={b.status === 'ACTIVE' ? 'success' : b.status === 'ARCHIVED' || b.status === 'DISABLED' ? 'danger' : 'warning'}>
                    {b.status}
                  </AdminStatusBadge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="pf-academy-panel__empty">No broadcasts dispatched for this academy.</p>
          )}
          {resourcePagination('broadcasts')}
        </section>
      )}

      {/* Audit Log Tab */}
      {activeTab === 'audit' && (
        <section className="pf-academy-panel">
          <header>
            <div>
              <p>Activity History</p>
              <h2>System Audit Log</h2>
            </div>
            <Clock3 size={20} />
          </header>
          {academyResourceQuery.isPending ? <AdminSkeleton rows={3} label="Loading academy audit log" /> : academyResourceQuery.isError ? (
            <ReadOnlyQueryState error={academyResourceQuery.error} onRetry={() => void academyResourceQuery.refetch()} resource="Academy audit log" />
          ) : academyAuditLogs.length ? (
            <ol className="pf-academy-timeline">
              {academyAuditLogs.map((log) => (
                <li key={log.id}>
                  <span aria-hidden="true" />
                  <div>
                    <strong>{log.action}: {log.description}</strong>
                    <small>
                      {formatDate(log.occurredAt, true)}
                      {log.actor ? ` by ${log.actor.fullName} (${log.actor.email})` : ''}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="pf-academy-panel__empty">No audit logs recorded for this academy yet.</p>
          )}
          {resourcePagination('audit')}
        </section>
      )}

      <p className="pf-academy-back">
        <button type="button" onClick={() => navigate(ROUTES.ADMIN_ACADEMIES)}>
          <ArrowLeft size={14} /> Back to all Academies
        </button>
      </p>

      <AcademyEditorDialog
        key={academy.updatedAt}
        open={editing}
        academy={academy}
        onClose={() => setEditing(false)}
        onSaved={(name) =>
          setToast({
            id: Date.now(),
            title: 'Academy updated',
            message: `${name} has been updated in the database.`,
            tone: 'success',
          })
        }
      />

      <AdminDialog
        open={Boolean(lifecycleTarget)}
        onClose={() => setLifecycleTarget(null)}
        size="small"
        title={`${lifecycleTarget === 'suspend' ? 'Suspend' : 'Activate'} ${academy.name}?`}
        description={
          lifecycleTarget === 'suspend'
            ? 'Students and Academy Admin access will be restricted.'
            : 'The Academy will return to operational status.'
        }
        footer={
          <>
            <button
              className="pf-admin-button pf-admin-button--quiet"
              onClick={() => setLifecycleTarget(null)}
              disabled={lifecycleMutation.isPending}
            >
              Cancel
            </button>
            <button
              className={`pf-admin-button${lifecycleTarget === 'suspend' ? ' pf-admin-button--danger' : ''}`}
              onClick={() => lifecycleTarget && void changeLifecycle(lifecycleTarget)}
              disabled={lifecycleMutation.isPending}
            >
              {lifecycleMutation.isPending ? 'Updating…' : lifecycleTarget === 'suspend' ? 'Suspend Academy' : 'Activate Academy'}
            </button>
          </>
        }
      >
        <div className="pf-academy-confirm">
          <ShieldCheck size={23} />
          <p>No academy records, student accounts, courses, or learning content will be deleted.</p>
        </div>
      </AdminDialog>

      <AdminToast toast={toast} onDismiss={() => setToast(null)} />
    </motion.div>
  );
};

export default AcademiesPage;
