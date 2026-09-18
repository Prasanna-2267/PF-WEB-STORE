import { AppSelect } from '@/components/ui/AppSelect';
import React, { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Archive,
  BookMarked,
  Eye,
  FileText,
  Layers,
  LibraryBig,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UsersRound,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useAcademyTenantStore } from '@/app/store/useAcademyTenantStore';
import { buildAcademyCourseContentPath, buildAcademyStudentPath, ROUTES } from '@/config/routes';
import {
  AdminDialog,
  AdminEmptyState,
  AdminPageHeader,
  AdminSkeleton,
  AdminStatusBadge,
  AdminToast,
  type AdminStatusTone,
  type AdminToastData,
} from '@/features/admin/AdminUi';
import { ReadOnlyPagination } from '@/components/ReadOnlyPagination';
import { ReadOnlyQueryState } from '@/components/ReadOnlyQueryState';
import {
  archiveAcademyCourse,
  createAcademyCourse,
  restoreAcademyCourse,
  updateAcademyCourse,
  useAcademyCourseReadOnly,
  useAcademyCoursesReadOnly,
  type AcademyCourseInput,
  type AcademyCourseViewModel,
  type CourseStatus,
} from './academyReadOnlyApi';
import '@/features/admin/admin-pages.css';
import '@/features/admin/courses/courses.css';
import './academy-courses.css';

const PAGE_LIMIT = 10;
type CourseForm = Required<Pick<AcademyCourseInput, 'name' | 'code' | 'status'>> & Pick<AcademyCourseInput, 'description'>;

const emptyCourse = (): CourseForm => ({ name: '', code: '', description: '', status: 'ACTIVE' });
const formatDate = (value: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
const tone = (status: CourseStatus): AdminStatusTone => status === 'ACTIVE' ? 'success' : status === 'INACTIVE' ? 'warning' : 'neutral';
const plainText = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

const MetricCard: React.FC<{ icon: React.ReactNode; label: string; value: number | string; color: string; background: string }> = ({ icon, label, value, color, background }) => (
  <div style={{ padding: 16, backgroundColor: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 14 }}>
    <div style={{ padding: 12, borderRadius: 10, backgroundColor: background, color }}>{icon}</div>
    <div><div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div><div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>{value}</div></div>
  </div>
);

const CourseEditorFields: React.FC<{ value: CourseForm; onChange: (value: CourseForm) => void }> = ({ value, onChange }) => (
  <div className="pf-course-editor">
    <div className="pf-course-editor__grid">
      <label className="pf-admin-field"><span>Course name</span><input autoFocus className="pf-admin-input" maxLength={120} required value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} placeholder="Chartered Accountancy" /></label>
      <label className="pf-admin-field"><span>Course code</span><input className="pf-admin-input" maxLength={16} required value={value.code} onChange={(event) => onChange({ ...value, code: event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })} placeholder="CA-101" /></label>
    </div>
    <label className="pf-admin-field"><span>Description</span><textarea className="pf-admin-textarea" rows={4} maxLength={2000} value={value.description ?? ''} onChange={(event) => onChange({ ...value, description: event.target.value })} placeholder="Professional accounting and finance education." /></label>
    <label className="pf-admin-field"><span>Status</span><AppSelect className="pf-admin-select" value={value.status} onChange={(event) => onChange({ ...value, status: event.target.value as CourseForm['status'] })}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="ARCHIVED">Archived</option></AppSelect></label>
  </div>
);

const CourseDetailsBody: React.FC<{ course: AcademyCourseViewModel }> = ({ course }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
    <section style={{ padding: 18, backgroundColor: 'var(--admin-bg, #f8fafc)', borderRadius: 12, border: '1px solid var(--admin-line, #e2e8f0)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}><h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#0f172a' }}>1. Course Overview</h4><AdminStatusBadge tone={tone(course.status)}>{course.status}</AdminStatusBadge></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        <div><div className="pf-academy-course-detail-label">Course Name</div><strong>{course.name}</strong></div>
        <div><div className="pf-academy-course-detail-label">Code</div><strong style={{ color: '#2563eb' }}>{course.code}</strong></div>
        <div><div className="pf-academy-course-detail-label">Created</div><span>{formatDate(course.createdAt)}</span></div>
        <div><div className="pf-academy-course-detail-label">Updated</div><span>{formatDate(course.updatedAt)}</span></div>
      </div>
      {course.description ? <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}><div className="pf-academy-course-detail-label">Description</div><p style={{ margin: '4px 0 0', color: '#334155' }}>{course.description}</p></div> : null}
    </section>
    <section className="pf-academy-course-metrics">
      <div><strong>{course.enrollmentCount}</strong><span>Enrolled Students</span></div><div><strong>{course.contentCount}</strong><span>Content Items</span></div><div><strong>{course.questionCount}</strong><span>Questions</span></div>
    </section>
    <section className="pf-academy-course-linked"><h4>2. Linked Content ({course.contentCount})</h4>{course.contentItems?.length ? course.contentItems.map((item) => <div key={item.id}><span><LibraryBig size={15} /><strong>{item.name}</strong></span><AdminStatusBadge tone={item.status === 'PUBLISHED' ? 'success' : 'neutral'}>{item.kind}</AdminStatusBadge></div>) : <p>No content belongs to this Academy course yet.</p>}</section>
    <section className="pf-academy-course-linked"><h4>3. Linked Questions ({course.questionCount})</h4>{course.questions?.length ? course.questions.map((question) => <div key={question.id}><span><FileText size={15} /><strong>{plainText(question.questionHtml) || 'Untitled question'}</strong></span><small>{question.kind.replaceAll('_', ' ')}</small></div>) : <p>No questions belong to this Academy course yet.</p>}</section>
    <section className="pf-academy-course-linked"><h4>4. Enrolled Students ({course.enrollmentCount})</h4>{course.enrollments?.length ? course.enrollments.map((enrollment) => <div key={enrollment.id}><span><UsersRound size={15} /><span><Link to={buildAcademyStudentPath(enrollment.student.id)}>{enrollment.student.fullName}</Link><small>{enrollment.student.email}</small></span></span><AdminStatusBadge tone="success">{enrollment.status}</AdminStatusBadge></div>) : <p>No active students are enrolled in this Academy course.</p>}</section>
  </div>
);

const CourseDetailsDialog: React.FC<{ courseId: string; onClose: () => void }> = ({ courseId, onClose }) => {
  const academyId = useAcademyTenantStore((state) => state.activeAcademyId);
  const query = useAcademyCourseReadOnly(academyId, courseId);
  return <AdminDialog open onClose={onClose} title={query.data?.name ?? 'Course Details'} description={query.data ? `Course Code: ${query.data.code}` : 'Detailed Academy course information'} size="large" footer={<button className="pf-admin-button pf-admin-button--secondary" type="button" onClick={onClose}>Close</button>}>
    {query.isPending ? <AdminSkeleton label="Loading course details" rows={6} variant="detail" /> : query.isError || !query.data ? <ReadOnlyQueryState error={query.error ?? new Error('Course not found')} onRetry={() => void query.refetch()} resource="Academy course" /> : <CourseDetailsBody course={query.data} />}
  </AdminDialog>;
};

export const AcademyCoursesReadOnlyPage: React.FC = () => {
  const { activeAcademyId, activeAcademy } = useAcademyTenantStore();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<CourseStatus | ''>('');
  const [detailCourseId, setDetailCourseId] = useState<string | null>(null);
  const [editingCourse, setEditingCourse] = useState<AcademyCourseViewModel | null | undefined>(undefined);
  const [archivingCourse, setArchivingCourse] = useState<AcademyCourseViewModel | null>(null);
  const [draft, setDraft] = useState<CourseForm>(emptyCourse);
  const [toast, setToast] = useState<AdminToastData | null>(null);
  const filters = useMemo(() => ({ page, limit: PAGE_LIMIT, includeArchived: true, search: search.trim() || undefined, status: status || undefined, sort: 'newest' as const }), [page, search, status]);
  const query = useAcademyCoursesReadOnly(activeAcademyId, filters);
  const metricsPending = !query.data && query.isPending;
  const invalidate = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['academy', activeAcademyId, 'courses'] }),
    queryClient.invalidateQueries({ queryKey: ['academy', activeAcademyId, 'overview'] }),
  ]);

  const saveMutation = useMutation({
    mutationFn: () => editingCourse ? updateAcademyCourse(editingCourse.id, { name: draft.name.trim(), code: draft.code.trim(), description: draft.description?.trim(), status: draft.status }) : createAcademyCourse({ name: draft.name.trim(), code: draft.code.trim(), description: draft.description?.trim(), status: draft.status }),
    onSuccess: async () => { await invalidate(); setEditingCourse(undefined); setDraft(emptyCourse()); setToast({ id: Date.now(), tone: 'success', title: editingCourse ? 'Course updated' : 'Course created', message: `The course is available only inside ${activeAcademy?.name ?? 'this Academy'}.` }); },
    onError: (error) => setToast({ id: Date.now(), tone: 'error', title: 'Course could not be saved', message: error instanceof Error ? error.message : 'The backend rejected the course.' }),
  });
  const archiveMutation = useMutation({
    mutationFn: (course: AcademyCourseViewModel) => course.status === 'ARCHIVED' ? restoreAcademyCourse(course.id) : archiveAcademyCourse(course.id),
    onSuccess: async (_, course) => { await invalidate(); setArchivingCourse(null); setToast({ id: Date.now(), tone: 'success', title: course.status === 'ARCHIVED' ? 'Course restored' : 'Course archived', message: 'The server confirmed the Academy-scoped lifecycle change.' }); },
    onError: (error) => setToast({ id: Date.now(), tone: 'error', title: 'Course change failed', message: error instanceof Error ? error.message : 'The backend rejected the lifecycle change.' }),
  });
  const openCreate = () => { setDraft(emptyCourse()); setEditingCourse(null); };
  const openEdit = (course: AcademyCourseViewModel) => { setDraft({ name: course.name, code: course.code, description: course.description, status: course.status }); setEditingCourse(course); };
  const courses = query.data?.items ?? [];
  const summary = query.data?.summary;

  return <motion.div className="pf-admin-page pf-academy-courses" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }}>
    <AdminPageHeader title="Courses" description={`Courses created and managed exclusively by ${activeAcademy?.name ?? 'this Academy'}.`} actions={<button className="pf-admin-button pf-admin-button--primary" type="button" onClick={openCreate}><Plus size={16} /> New course</button>} />
    <section className="pf-admin-summary-grid pf-academy-course-summary">
      <MetricCard icon={<BookMarked size={22} />} label="Total Courses" value={metricsPending ? '—' : (summary?.totalCourses ?? 0)} color="#2563eb" background="#eff6ff" />
      <MetricCard icon={<Layers size={22} />} label="Active Courses" value={metricsPending ? '—' : (summary?.activeCourses ?? 0)} color="#16a34a" background="#f0fdf4" />
      <MetricCard icon={<UsersRound size={22} />} label="Enrolled Students" value={metricsPending ? '—' : (summary?.totalEnrolledStudents ?? 0)} color="#9333ea" background="#faf5ff" />
      <MetricCard icon={<LibraryBig size={22} />} label="Content Items" value={metricsPending ? '—' : (summary?.totalContentItems ?? 0)} color="#ea580c" background="#fff7ed" />
    </section>
    <section className="pf-admin-table-card">
      <div className="pf-admin-table-card__header pf-academy-course-toolbar"><label className="pf-admin-search-field"><Search size={17} /><span className="pf-admin-sr-only">Search Academy courses</span><input className="pf-admin-input" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search courses by name, code, or description…" /></label><AppSelect className="pf-admin-select" value={status} onChange={(event) => { setStatus(event.target.value as CourseStatus | ''); setPage(1); }}><option value="">All Statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="ARCHIVED">Archived</option></AppSelect></div>
      {query.isPending ? <AdminSkeleton rows={6} variant="table" label="Loading Academy courses" /> : query.isError ? <ReadOnlyQueryState error={query.error} onRetry={() => void query.refetch()} resource="Academy courses" /> : courses.length ? <><div className="pf-admin-table-scroll"><table className="pf-admin-table"><thead><tr><th>Course</th><th>Code</th><th>Status</th><th>Enrolled Students</th><th>Content</th><th>Created</th><th>Actions</th></tr></thead><tbody>{courses.map((course) => <tr key={course.id}><td><strong>{course.name}</strong><small className="pf-course-table__description">{course.description || 'No description'}</small></td><td><code className="pf-academy-course-code">{course.code}</code></td><td><AdminStatusBadge tone={tone(course.status)}>{course.status}</AdminStatusBadge></td><td><strong>{course.enrollmentCount} Students</strong></td><td><strong>{course.contentCount} Items</strong></td><td>{formatDate(course.createdAt)}</td><td><span className="pf-course-actions"><button className="pf-admin-button pf-admin-button--secondary" type="button" onClick={() => setDetailCourseId(course.id)}><Eye size={14} /> Details</button><button className="pf-admin-button pf-admin-button--secondary" type="button" disabled={course.status === 'ARCHIVED'} onClick={() => openEdit(course)}><Pencil size={14} /> Edit</button><button className="pf-admin-icon-button" type="button" aria-label={`${course.status === 'ARCHIVED' ? 'Restore' : 'Archive'} ${course.name}`} onClick={() => setArchivingCourse(course)}>{course.status === 'ARCHIVED' ? <RotateCcw size={16} /> : <Trash2 size={16} />}</button></span></td></tr>)}</tbody></table></div><ReadOnlyPagination page={query.data!.pagination.page} totalPages={query.data!.pagination.totalPages} total={query.data!.pagination.total} onPageChange={setPage} /></> : <AdminEmptyState icon={<Archive size={22} />} title={search || status ? 'No matching courses' : 'No courses available'} description={search || status ? 'Try clearing or adjusting your search filters.' : 'Create the first course for this Academy.'} action={<button className="pf-admin-button" type="button" onClick={openCreate}><Plus size={16} /> New course</button>} />}
    </section>
    {detailCourseId ? <CourseDetailsDialog courseId={detailCourseId} onClose={() => setDetailCourseId(null)} /> : null}
    {editingCourse !== undefined ? <AdminDialog open onClose={() => !saveMutation.isPending && setEditingCourse(undefined)} title={editingCourse ? 'Edit course' : 'New course'} description={editingCourse ? 'Update this Academy course without changing its tenant ownership.' : `Create a course exclusively for ${activeAcademy?.name ?? 'this Academy'}.`} footer={<><button className="pf-admin-button pf-admin-button--quiet" type="button" disabled={saveMutation.isPending} onClick={() => setEditingCourse(undefined)}>Cancel</button><button className="pf-admin-button pf-admin-button--primary" type="button" disabled={saveMutation.isPending || draft.name.trim().length < 2 || draft.code.trim().length < 2} onClick={() => saveMutation.mutate()}>{saveMutation.isPending ? 'Saving…' : editingCourse ? 'Save changes' : 'Create course'}</button></>}><CourseEditorFields value={draft} onChange={setDraft} /></AdminDialog> : null}
    {archivingCourse ? <AdminDialog open onClose={() => !archiveMutation.isPending && setArchivingCourse(null)} title={archivingCourse.status === 'ARCHIVED' ? 'Restore course?' : 'Archive course?'} description={archivingCourse.status === 'ARCHIVED' ? 'Return this course to the Academy workspace as inactive.' : 'Soft-delete this Academy course while preserving its historical relationships.'} footer={<><button className="pf-admin-button pf-admin-button--quiet" type="button" disabled={archiveMutation.isPending} onClick={() => setArchivingCourse(null)}>Cancel</button><button className={`pf-admin-button ${archivingCourse.status === 'ARCHIVED' ? 'pf-admin-button--primary' : 'pf-admin-button--danger'}`} type="button" disabled={archiveMutation.isPending} onClick={() => archiveMutation.mutate(archivingCourse)}>{archiveMutation.isPending ? 'Working…' : archivingCourse.status === 'ARCHIVED' ? 'Restore course' : 'Archive course'}</button></>}><p style={{ margin: 0 }}>Continue with <strong>{archivingCourse.name}</strong> ({archivingCourse.code})?</p></AdminDialog> : null}
    <AdminToast toast={toast} onDismiss={() => setToast(null)} />
  </motion.div>;
};

export const AcademyCourseReadOnlyDetailPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const academyId = useAcademyTenantStore((state) => state.activeAcademyId);
  const query = useAcademyCourseReadOnly(academyId, courseId);
  if (query.isPending) return <AdminSkeleton rows={7} variant="detail" label="Loading Academy course" />;
  if (query.isError || !query.data) return <div className="pf-admin-page"><ReadOnlyQueryState error={query.error ?? new Error('Course not found')} onRetry={() => void query.refetch()} resource="Academy course" /></div>;
  return <div className="pf-admin-page"><AdminPageHeader title={query.data.name} description="Academy-owned course details." breadcrumbs={[{ label: 'Courses', to: ROUTES.ACADEMY_COURSES }, { label: query.data.name }]} actions={query.data.status !== 'ARCHIVED' ? <Link className="pf-admin-button pf-admin-button--primary" to={buildAcademyCourseContentPath(query.data.id)}>Open course content</Link> : undefined} /><CourseDetailsBody course={query.data} /></div>;
};
