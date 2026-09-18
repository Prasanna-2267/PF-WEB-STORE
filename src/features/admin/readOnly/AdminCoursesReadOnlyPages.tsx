import { AppSelect } from '@/components/ui/AppSelect';
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { buildAdminStudentPath } from '@/config/routes';
import {
  BookMarked,
  Layers,
  UsersRound,
  Package as PackageIcon,
  Search,
  Plus,
  Pencil,
  Trash2,
  Eye,
  CheckCircle2,
  Archive,
} from 'lucide-react';
import { useAuthStore } from '@/app/store/useAuthStore';
import { AdminDialog, AdminEmptyState, AdminPageHeader, AdminSkeleton, AdminStatusBadge, AdminStatusTone } from '../AdminUi';
import { ReadOnlyPagination } from '@/components/ReadOnlyPagination';
import { ReadOnlyQueryState } from '@/components/ReadOnlyQueryState';
import {
  useAdminCoursesReadOnly,
  useAdminCourseReadOnly,
  useCreateAdminCourse,
  useUpdateAdminCourse,
  useDeleteAdminCourse,
  AdminCourseItem,
  AdminCourseInput,
} from './adminCoursesReadOnlyApi';
import type { CourseStatus } from '@/features/admin/types/admin';
import '@/features/admin/admin-pages.css';
import '../courses/courses.css';

const tone = (status: CourseStatus): AdminStatusTone =>
  status === 'ACTIVE' ? 'success' : status === 'INACTIVE' ? 'warning' : 'neutral';

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));

export function AdminCoursesPage() {
  const user = useAuthStore((state: any) => state.user);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CourseStatus | ''>('');

  const [detailCourseId, setDetailCourseId] = useState<string | null>(null);
  const [editingCourse, setEditingCourse] = useState<AdminCourseItem | null | undefined>(undefined);
  const [deletingCourse, setDeletingCourse] = useState<AdminCourseItem | null>(null);

  const queryParams = useMemo(
    () => ({
      page,
      limit: 10,
      search: search.trim() || undefined,
      status: statusFilter || undefined,
    }),
    [page, search, statusFilter]
  );

  const query = useAdminCoursesReadOnly(user?.id ?? null, queryParams);
  const metricsPending = !query.data && query.isPending;
  const summary = query.data?.summary;
  const courses = query.data?.data ?? [];
  const meta = query.data?.meta ?? { page: 1, limit: 10, total: 0, totalPages: 1 };

  return (
    <motion.div className="pf-admin-page" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }}>
      <AdminPageHeader
        title="Courses"
        description="Direct Parallax Flow courses. Academy courses are managed from their Academy details page."
        actions={
          <button className="pf-admin-button" type="button" onClick={() => setEditingCourse(null)}>
            <Plus size={16} /> New course
          </button>
        }
      />

      {/* TOP METRIC SUMMARY CARDS */}
      <section className="pf-admin-order-summary pf-admin-course-summary" aria-label="Course summary">
        <article className="pf-admin-card">
          <BookMarked size={18} aria-hidden="true" />
          <div>
            <strong>{metricsPending ? '—' : (summary?.totalCourses ?? meta.total ?? 0)}</strong>
            <p>Total Courses</p>
          </div>
        </article>
        <article className="pf-admin-card">
          <Layers size={18} aria-hidden="true" />
          <div>
            <strong>{metricsPending ? '—' : (summary?.activeCourses ?? 0)}</strong>
            <p>Active Courses</p>
          </div>
        </article>
        <article className="pf-admin-card">
          <UsersRound size={18} aria-hidden="true" />
          <div>
            <strong>{metricsPending ? '—' : (summary?.totalEnrolledStudents ?? 0)}</strong>
            <p>Enrolled Students</p>
          </div>
        </article>
        <article className="pf-admin-card">
          <PackageIcon size={18} aria-hidden="true" />
          <div>
            <strong>{metricsPending ? '—' : (summary?.totalPackages ?? 0)}</strong>
            <p>Total Packages</p>
          </div>
        </article>
      </section>

      {/* TABLE & SEARCH CARD */}
      <section className="pf-admin-table-card">
        <div className="pf-admin-table-card__header" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <label className="pf-admin-search-field" style={{ flex: 1, minWidth: 240 }}>
            <Search size={17} />
            <span className="pf-admin-sr-only">Search courses</span>
            <input
              className="pf-admin-input"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search courses by name, code, or description…"
            />
          </label>

          <AppSelect
            className="pf-admin-select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as CourseStatus | '');
              setPage(1);
            }}
            style={{ width: 140 }}
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ARCHIVED">Archived</option>
          </AppSelect>
        </div>

        {query.isPending ? (
          <AdminSkeleton rows={6} variant="table" label="Loading courses" />
        ) : query.isError ? (
          <ReadOnlyQueryState error={query.error} onRetry={() => void query.refetch()} resource="Courses" />
        ) : courses.length ? (
          <>
            <div className="pf-admin-table-scroll">
              <table className="pf-admin-table">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Code</th>
                    <th>Status</th>
                    <th>Enrolled Students</th>
                    <th>Packages</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((course) => (
                    <tr key={course.id}>
                      <td>
                        <strong>{course.name}</strong>
                        <small className="pf-course-table__description" style={{ display: 'block', color: '#64748b' }}>
                          {course.description || 'No description'}
                        </small>
                      </td>
                      <td>
                        <code style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                          {course.code}
                        </code>
                      </td>
                      <td>
                        <AdminStatusBadge tone={tone(course.status)}>{course.status}</AdminStatusBadge>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#334155' }}>{course.studentsCount ?? 0} Students</span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#334155' }}>{course.packagesCount ?? 0} Packages</span>
                      </td>
                      <td>{formatDate(course.createdAt)}</td>
                      <td>
                        <span className="pf-course-actions" style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            className="pf-admin-button pf-admin-button--secondary"
                            type="button"
                            onClick={() => setDetailCourseId(course.id)}
                            title="View Course Details"
                          >
                            <Eye size={14} /> Details
                          </button>
                          <button
                            className="pf-admin-button pf-admin-button--secondary"
                            type="button"
                            onClick={() => setEditingCourse(course)}
                            title="Edit Course"
                          >
                            <Pencil size={14} /> Edit
                          </button>
                          <button
                            className="pf-admin-icon-button"
                            type="button"
                            aria-label={`Delete ${course.name}`}
                            onClick={() => setDeletingCourse(course)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ReadOnlyPagination
              page={meta.page}
              totalPages={meta.totalPages}
              total={meta.total}
              onPageChange={(p) => setPage(p)}
            />
          </>
        ) : (
          <AdminEmptyState
            icon={<Archive size={22} />}
            title={search || statusFilter ? 'No matching courses' : 'No courses available'}
            description={search || statusFilter ? 'Try clearing or adjusting your search filters.' : 'Create your first course to get started.'}
            action={
              <button className="pf-admin-button" type="button" onClick={() => setEditingCourse(null)}>
                <Plus size={16} /> New course
              </button>
            }
          />
        )}
      </section>

      {/* QUICK DETAIL MODAL */}
      {detailCourseId ? (
        <CourseQuickDetailModal courseId={detailCourseId} onClose={() => setDetailCourseId(null)} />
      ) : null}

      {/* CREATE / EDIT MODAL */}
      {editingCourse !== undefined ? (
        <CourseEditorModal course={editingCourse} onClose={() => setEditingCourse(undefined)} />
      ) : null}

      {/* DELETE MODAL */}
      {deletingCourse ? (
        <CourseDeleteModal course={deletingCourse} onClose={() => setDeletingCourse(null)} />
      ) : null}
    </motion.div>
  );
}

const CourseQuickDetailModal: React.FC<{ courseId: string; onClose: () => void }> = ({ courseId, onClose }) => {
  const user = useAuthStore((state: any) => state.user);
  const query = useAdminCourseReadOnly(user?.id ?? null, courseId);
  const course = query.data;

  return (
    <AdminDialog
      open={true}
      onClose={onClose}
      title={course ? course.name : 'Course Details'}
      description={course ? `Course Code: ${course.code} | Slug: ${course.slug}` : 'Detailed course information'}
      size="large"
      footer={
        <button className="pf-admin-button pf-admin-button--secondary" type="button" onClick={onClose}>
          Close
        </button>
      }
    >
      {query.isPending ? (
        <AdminSkeleton label="Loading course details" rows={6} variant="detail" />
      ) : query.isError || !course ? (
        <ReadOnlyQueryState error={query.error ?? new Error('Course not found')} onRetry={() => void query.refetch()} resource="Course" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* SECTION 1 — COURSE OVERVIEW */}
          <section style={{ padding: 18, backgroundColor: 'var(--admin-bg, #f8fafc)', borderRadius: 12, border: '1px solid var(--admin-line, #e2e8f0)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#0f172a' }}>1. Course Overview</h4>
              <AdminStatusBadge tone={tone(course.status)}>{course.status}</AdminStatusBadge>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              <div>
                <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Course Name</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>{course.name}</div>
              </div>
              <div>
                <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Code</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#2563eb', marginTop: 4 }}>{course.code}</div>
              </div>
              <div>
                <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Created</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#334155', marginTop: 4 }}>{formatDate(course.createdAt)}</div>
              </div>
              <div>
                <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Updated</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#334155', marginTop: 4 }}>{formatDate(course.updatedAt)}</div>
              </div>
            </div>
            {course.description ? (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
                <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</div>
                <div style={{ fontSize: 13, color: '#334155', marginTop: 4 }}>{course.description}</div>
              </div>
            ) : null}
          </section>

          {/* SECTION 2 — COURSE METRICS */}
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
            <div style={{ padding: 12, backgroundColor: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#2563eb' }}>{course.studentsCount ?? 0}</div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Enrolled Students</div>
            </div>
            <div style={{ padding: 12, backgroundColor: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#16a34a' }}>{course.packagesCount ?? 0}</div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Packages</div>
            </div>
            <div style={{ padding: 12, backgroundColor: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#9333ea' }}>{course.contentCount ?? 0}</div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Content Items</div>
            </div>
            <div style={{ padding: 12, backgroundColor: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#ea580c' }}>{course.questionsCount ?? 0}</div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Questions</div>
            </div>
          </section>

          {/* SECTION 3 — LINKED PACKAGES */}
          <section style={{ padding: 16, borderRadius: 12, border: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: '#0f172a' }}>3. Linked Packages ({course.packagesCount ?? 0})</h4>
            {course.packages?.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {course.packages.map((pkg) => (
                  <div key={pkg.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, backgroundColor: '#f8fafc', borderRadius: 8, fontSize: 13 }}>
                    <strong>{pkg.title}</strong>
                    <span>{pkg.currency} {pkg.price} — <span style={{ fontWeight: 600, color: pkg.status === 'PUBLISHED' ? '#16a34a' : '#64748b' }}>{pkg.status}</span></span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>No packages linked to this course yet.</p>
            )}
          </section>

          {/* SECTION 4 — LINKED CONTENT */}
          <section style={{ padding: 16, borderRadius: 12, border: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: '#0f172a' }}>4. Linked Content Items ({course.contentCount ?? 0})</h4>
            {course.contentItems?.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {course.contentItems.map((item) => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, backgroundColor: '#f8fafc', borderRadius: 8, fontSize: 13 }}>
                    <div>
                      <strong>{item.name}</strong>
                      <span style={{ marginLeft: 8, fontSize: 11, background: '#e2e8f0', padding: '2px 6px', borderRadius: 4 }}>{item.kind}</span>
                    </div>
                    <span style={{ fontWeight: 600, color: item.isPublished ? '#16a34a' : '#64748b' }}>
                      {item.accessType} — {item.isPublished ? 'Published' : 'Draft'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>No content items linked to this course yet.</p>
            )}
          </section>

          {/* SECTION 5 — LINKED QUESTIONS */}
          <section style={{ padding: 16, borderRadius: 12, border: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: '#0f172a' }}>5. Linked Questions ({course.questionsCount ?? 0})</h4>
            {course.questions?.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {course.questions.map((q) => (
                  <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, backgroundColor: '#f8fafc', borderRadius: 8, fontSize: 13 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}><strong>{q.title}</strong></span>
                    <span style={{ fontSize: 12, color: '#64748b' }}>{q.type} ({q.difficulty})</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>No questions linked to this course taxonomy yet.</p>
            )}
          </section>

          {/* SECTION 6 — ENROLLED STUDENTS */}
          <section style={{ padding: 16, borderRadius: 12, border: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: '#0f172a' }}>6. Enrolled Students ({course.studentsCount ?? 0})</h4>
            {course.students?.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {course.students.map((st) => (
                  <div key={st.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, backgroundColor: '#f8fafc', borderRadius: 8, fontSize: 13 }}>
                    <div>
                      <Link to={buildAdminStudentPath(st.userId)} style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
                        {st.studentName}
                      </Link>
                      <small style={{ display: 'block', color: '#64748b' }}>{st.studentEmail}</small>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <AdminStatusBadge tone={st.status === 'ACTIVE' ? 'success' : 'neutral'}>{st.status}</AdminStatusBadge>
                      <small style={{ display: 'block', color: '#64748b', marginTop: 2 }}>{formatDate(st.grantedAt)}</small>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>No active student enrollments for this course yet.</p>
            )}
          </section>
        </div>
      )}
    </AdminDialog>
  );
};

const CourseEditorModal: React.FC<{ course: AdminCourseItem | null; onClose: () => void }> = ({ course, onClose }) => {
  const user = useAuthStore((state: any) => state.user);
  const createMutation = useCreateAdminCourse(user?.id ?? null);
  const updateMutation = useUpdateAdminCourse(user?.id ?? null);

  const [form, setForm] = useState<AdminCourseInput>({
    name: course?.name ?? '',
    code: course?.code ?? '',
    description: course?.description ?? '',
    status: course?.status ?? 'ACTIVE',
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const error = createMutation.error || updateMutation.error;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (course) {
        await updateMutation.mutateAsync({ courseId: course.id, input: form });
      } else {
        await createMutation.mutateAsync(form);
      }
      onClose();
    } catch {
      // Handled by mutation state
    }
  };

  return (
    <AdminDialog
      open={true}
      onClose={onClose}
      title={course ? 'Edit course' : 'New course'}
      description={course ? 'Update course information.' : 'Create a new course workspace.'}
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="pf-course-editor">
        <div className="pf-course-editor__grid">
          <label className="pf-admin-field">
            <span>Course name</span>
            <input
              className="pf-admin-input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Chartered Accountancy"
              required
            />
          </label>
          <label className="pf-admin-field">
            <span>Course code (Optional)</span>
            <input
              className="pf-admin-input"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="CA (Auto-generated if empty)"
              maxLength={16}
            />
          </label>
        </div>

        <label className="pf-admin-field">
          <span>Description</span>
          <textarea
            className="pf-admin-textarea"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Professional accounting and finance education."
          />
        </label>

        <label className="pf-admin-field">
          <span>Status</span>
          <AppSelect
            className="pf-admin-select"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as CourseStatus })}
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ARCHIVED">Archived</option>
          </AppSelect>
        </label>

        {error ? (
          <p className="pf-course-editor__error" role="alert" style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>
            {error instanceof Error ? error.message : 'Failed to save course.'}
          </p>
        ) : null}

        <div className="pf-course-editor__actions" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button
            className="pf-admin-button pf-admin-button--primary"
            type="submit"
            disabled={isSaving}
            style={{ background: '#2563eb', color: '#ffffff', fontWeight: 600, minWidth: 120 }}
          >
            {isSaving ? 'Saving…' : course ? 'Save changes' : 'Create course'}
          </button>
        </div>
      </form>
    </AdminDialog>
  );
};

const CourseDeleteModal: React.FC<{ course: AdminCourseItem; onClose: () => void }> = ({ course, onClose }) => {
  const user = useAuthStore((state: any) => state.user);
  const deleteMutation = useDeleteAdminCourse(user?.id ?? null);

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(course.id);
      onClose();
    } catch {
      // Handled by mutation state
    }
  };

  return (
    <AdminDialog
      open={true}
      onClose={onClose}
      title="Archive course?"
      description="Soft delete and archive this course record."
      footer={
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', width: '100%' }}>
          <button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={onClose} disabled={deleteMutation.isPending}>
            Cancel
          </button>
          <button
            className="pf-admin-button pf-admin-button--danger"
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Archiving…' : 'Archive course'}
          </button>
        </div>
      }
    >
      <p style={{ margin: 0, fontSize: 14, color: '#334155' }}>
        Are you sure you want to archive <strong>{course.name}</strong> (<code>{course.code}</code>)? Its related students, orders, packages, and content will remain intact.
      </p>
      {deleteMutation.error ? (
        <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>
          {deleteMutation.error instanceof Error ? deleteMutation.error.message : 'Could not archive course.'}
        </p>
      ) : null}
    </AdminDialog>
  );
};
