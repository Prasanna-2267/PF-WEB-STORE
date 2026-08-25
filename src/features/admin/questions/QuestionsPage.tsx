import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Archive, BadgeHelp, Copy, Edit3, Eye, FileUp, Filter, MoreHorizontal, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { useQuestionStore } from '@/app/store/useQuestionStore';
import { useAcademyQuestionStore } from '@/features/academy/questions/academyQuestionStore';
import { academyTaxonomyRepository } from '@/features/academy/questions/academyTaxonomyRepository';
import { useQueryClient } from '@tanstack/react-query';
import { AdminDialog, AdminEmptyState, AdminPageHeader, AdminSkeleton, AdminStatusBadge, AdminToast, type AdminToastData } from '../AdminUi';
import { QUESTION_KIND_LABELS, type QuestionFilters, type QuestionRecord, type QuestionStatus } from './types/question';
import { questionPlainText } from './api/questionRepository';
import { QuestionEditor } from './components/QuestionEditor';
import { QuestionPreview } from './components/QuestionPreview';
import { ImportQuestions } from './components/ImportQuestions';
import { TaxonomyManager } from './components/TaxonomyManager';
import './questions.css';

type Tab = 'bank' | 'editor' | 'import' | 'taxonomy' | 'trash';
const defaultFilters: QuestionFilters = { search: '', courseId: '', subjectId: '', chapterId: '', lessonId: '', topicId: '', kind: 'ALL', status: 'ALL', difficulty: 'ALL', sort: 'updated-desc' };
const statusTone = (status: QuestionStatus) => status === 'PUBLISHED' ? 'success' : status === 'ARCHIVED' ? 'neutral' : 'warning';
const date = (value: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));

export interface QuestionsPageProps {
  scope?: 'platform' | 'academy';
  academyId?: string | null;
  academyName?: string;
}

export default function QuestionsPage({ scope = 'platform', academyId, academyName }: QuestionsPageProps) {
  const platformStore = useQuestionStore();
  const academyStore = useAcademyQuestionStore();
  const store = scope === 'academy' ? academyStore : platformStore;
  const queryClient = useQueryClient();
  const requestedScopeKey = scope === 'academy' ? `academy:${academyId ?? 'missing'}` : 'platform';
  const { error, initialize, save, saveMany, duplicate, trash, restore, permanentDelete, setStatus, createTaxonomy } = store;
  const scopeReady = store.scopeKey === requestedScopeKey;
  const questions = scopeReady ? store.questions : [];
  const taxonomy = scopeReady ? store.taxonomy : null;
  const loading = store.loading || !scopeReady;
  const [tab, setTab] = useState<Tab>('bank'); const [filters, setFilters] = useState(defaultFilters); const [editing, setEditing] = useState<QuestionRecord | null>(null); const [viewing, setViewing] = useState<QuestionRecord | null>(null); const [confirm, setConfirm] = useState<{ type: 'trash' | 'delete'; question: QuestionRecord } | null>(null); const [toast, setToast] = useState<AdminToastData | null>(null); const [page, setPage] = useState(1);
  useEffect(() => { if (scope !== 'academy' || academyId) void initialize(requestedScopeKey); }, [academyId, initialize, requestedScopeKey, scope]);
  const active = questions.filter((entry) => !entry.deletedAt); const deleted = questions.filter((entry) => entry.deletedAt);
  const subjects = taxonomy?.subjects.filter((entry) => !filters.courseId || entry.courseId === filters.courseId) ?? [];
  const chapters = taxonomy?.chapters.filter((entry) => !filters.subjectId || entry.subjectId === filters.subjectId) ?? [];
  const lessons = taxonomy?.lessons.filter((entry) => !filters.chapterId || entry.chapterId === filters.chapterId) ?? [];
  const topics = taxonomy?.topics.filter((entry) => !filters.lessonId || entry.lessonId === filters.lessonId) ?? [];
  const classificationPath = (value: QuestionRecord['classification']) => {
    if (!value || !taxonomy) return 'Unclassified';
    return [taxonomy.courses.find((x) => x.id === value.courseId)?.name, taxonomy.subjects.find((x) => x.id === value.subjectId)?.name, taxonomy.chapters.find((x) => x.id === value.chapterId)?.name, taxonomy.lessons.find((x) => x.id === value.lessonId)?.name, taxonomy.topics.find((x) => x.id === value.topicId)?.name].filter(Boolean).join(' › ');
  };
  const classificationsFor = (entry: QuestionRecord) => entry.classificationMode === 'INDIVIDUAL_SUB_QUESTIONS' && entry.kind.startsWith('CASE_')
    ? entry.subQuestions.map((subQuestion) => subQuestion.classification).filter(Boolean)
    : [entry.classification].filter(Boolean);
  const pathText = (entry: QuestionRecord) => [...new Set(classificationsFor(entry).map(classificationPath))].join(' • ') || 'Unclassified';
  const visible = useMemo(() => {
    const term = filters.search.trim().toLocaleLowerCase();
    const values = active.filter((entry) => {
      const classifications = classificationsFor(entry);
      const searchable = [entry.id, entry.caseId ?? '', questionPlainText(entry.questionHtml), questionPlainText(entry.caseHtml), ...entry.subQuestions.map((subQuestion) => questionPlainText(subQuestion.questionHtml)), pathText(entry)].join(' ').toLocaleLowerCase();
      const taxonomyMatches = (key: 'courseId' | 'subjectId' | 'chapterId' | 'lessonId' | 'topicId', expected: string) => !expected || classifications.some((classification) => classification?.[key] === expected);
      return (!term || searchable.includes(term)) && taxonomyMatches('courseId', filters.courseId) && taxonomyMatches('subjectId', filters.subjectId) && taxonomyMatches('chapterId', filters.chapterId) && taxonomyMatches('lessonId', filters.lessonId) && taxonomyMatches('topicId', filters.topicId) && (filters.kind === 'ALL' || entry.kind === filters.kind) && (filters.status === 'ALL' || entry.status === filters.status) && (filters.difficulty === 'ALL' || entry.difficulty === filters.difficulty);
    });
    return values.sort((a, b) => filters.sort === 'updated-asc' ? a.updatedAt.localeCompare(b.updatedAt) : filters.sort === 'created-desc' ? b.createdAt.localeCompare(a.createdAt) : filters.sort === 'question-asc' ? questionPlainText(a.questionHtml || a.caseHtml).localeCompare(questionPlainText(b.questionHtml || b.caseHtml)) : b.updatedAt.localeCompare(a.updatedAt));
  }, [active, filters]);
  const pageItems = visible.slice((page - 1) * 20, page * 20); const pages = Math.max(1, Math.ceil(visible.length / 20));
  useEffect(() => setPage(1), [filters]);
  const notify = (title: string, message: string, tone: AdminToastData['tone'] = 'success') => setToast({ id: `${Date.now()}`, title, message, tone });
  const invalidateScope = async () => {
    if (scope !== 'academy' || !academyId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['academy', academyId, 'questions'] }),
      queryClient.invalidateQueries({ queryKey: ['academy', academyId, 'courses'] }),
      queryClient.invalidateQueries({ queryKey: ['academy', academyId, 'overview'] }),
    ]);
  };
  const openNew = () => { setEditing(null); setTab('editor'); };
  const saveEditor = async (question: QuestionRecord, publish: boolean) => { await save(question); await invalidateScope(); notify(publish ? 'Question published' : 'Draft saved', 'The Question Bank is now up to date.'); setTab('bank'); setEditing(null); };
  const action = async (type: string, entry: QuestionRecord) => {
    try {
      if (type === 'edit') { setEditing(entry); setTab('editor'); }
      else if (type === 'view') setViewing(entry);
      else if (type === 'duplicate') { await duplicate(entry.id); await invalidateScope(); notify('Question duplicated', 'A new draft copy was created.'); }
      else if (type === 'archive') { await setStatus(entry.id, 'ARCHIVED'); await invalidateScope(); notify('Question archived', 'It remains available for future editing.'); }
      else if (type === 'publish') { await setStatus(entry.id, 'PUBLISHED'); await invalidateScope(); notify('Question published', 'Learners can now receive this question.'); }
      else if (type === 'trash') setConfirm({ type: 'trash', question: entry });
    } catch (caught) {
      notify('Action could not be completed', caught instanceof Error ? caught.message : 'Please review the question and try again.', 'error');
    }
  };

  return <motion.main className="pf-admin-page pf-questions-page" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
    <AdminPageHeader title="Questions" description={scope === 'academy' ? `Create and manage the private question bank for ${academyName ?? 'your Academy'}.` : 'Direct Parallax Flow question bank. Academy question banks remain in their Academy details page.'} actions={<><button className="pf-admin-button pf-admin-button--secondary" type="button" onClick={() => setTab('import')}><FileUp size={17} /> Import questions</button><button className="pf-admin-button" type="button" onClick={openNew}><Plus size={17} /> Add new question</button></>} />
    <nav className="pf-question-tabs" aria-label="Questions workspace">{([['bank', 'Question Bank'], ['editor', 'Add Question'], ['import', 'Excel Import'], ['taxonomy', 'Taxonomy'], ['trash', `Trash (${deleted.length})`]] as Array<[Tab, string]>).map(([id, label]) => <button key={id} type="button" className={tab === id ? 'is-active' : ''} onClick={() => { setTab(id); if (id === 'editor') setEditing(null); }}>{label}</button>)}</nav>
    {error ? <div className="pf-question-alert">{error}</div> : null}
    <AnimatePresence mode="wait">{loading && !taxonomy ? <AdminSkeleton key="loading" rows={7} /> : taxonomy ? <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: .18 }}>
      {tab === 'bank' ? <section className="pf-question-bank"><div className="pf-question-filterbar">
        <label className="pf-admin-search-field"><Search size={18} /><input className="pf-admin-input" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Search questions or Case ID" /></label>
        <span className="pf-question-filter-label"><Filter size={16} /> Filters</span>
        <select aria-label="Filter by course" className="pf-admin-select" value={filters.courseId} onChange={(event) => setFilters({ ...filters, courseId: event.target.value, subjectId: '', chapterId: '', lessonId: '', topicId: '' })}><option value="">All courses</option>{taxonomy.courses.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <select aria-label="Filter by subject" className="pf-admin-select" value={filters.subjectId} onChange={(event) => setFilters({ ...filters, subjectId: event.target.value, chapterId: '', lessonId: '', topicId: '' })}><option value="">All subjects</option>{subjects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <select aria-label="Filter by chapter" className="pf-admin-select" value={filters.chapterId} onChange={(event) => setFilters({ ...filters, chapterId: event.target.value, lessonId: '', topicId: '' })}><option value="">All chapters</option>{chapters.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <select aria-label="Filter by lesson" className="pf-admin-select" value={filters.lessonId} onChange={(event) => setFilters({ ...filters, lessonId: event.target.value, topicId: '' })}><option value="">All lessons</option>{lessons.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <select aria-label="Filter by topic" className="pf-admin-select" value={filters.topicId} onChange={(event) => setFilters({ ...filters, topicId: event.target.value })}><option value="">All topics</option>{topics.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <select aria-label="Filter by question type" className="pf-admin-select" value={filters.kind} onChange={(event) => setFilters({ ...filters, kind: event.target.value as QuestionFilters['kind'] })}><option value="ALL">All types</option>{Object.entries(QUESTION_KIND_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
        <select aria-label="Filter by difficulty" className="pf-admin-select" value={filters.difficulty} onChange={(event) => setFilters({ ...filters, difficulty: event.target.value as QuestionFilters['difficulty'] })}><option value="ALL">All difficulties</option><option value="FOUNDATION">Foundation</option><option value="INTERMEDIATE">Intermediate</option><option value="ADVANCED">Advanced</option></select>
        <select aria-label="Filter by status" className="pf-admin-select" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value as QuestionFilters['status'] })}><option value="ALL">All statuses</option><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option></select>
        <select aria-label="Sort questions" className="pf-admin-select" value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value as QuestionFilters['sort'] })}><option value="updated-desc">Recently updated</option><option value="updated-asc">Oldest updated</option><option value="created-desc">Recently created</option><option value="question-asc">Question A–Z</option></select>
        <button className="pf-admin-button pf-admin-button--quiet pf-question-reset-filters" type="button" onClick={() => setFilters(defaultFilters)}>Reset</button>
      </div>
        {pageItems.length ? <><div className="pf-question-table-wrap"><table className="pf-admin-table pf-question-table"><thead><tr><th>Question</th><th>Classification</th><th>Type</th><th>Difficulty</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead><tbody>{pageItems.map((entry) => <tr key={entry.id}><td><button type="button" className="pf-question-title-button" onClick={() => setViewing(entry)}><strong>{questionPlainText(entry.questionHtml || entry.caseHtml) || 'Untitled question'}</strong>{entry.caseId ? <small>{entry.caseId} · {entry.subQuestions.length} sub-questions</small> : null}</button></td><td><span className="pf-question-path">{pathText(entry)}</span></td><td>{QUESTION_KIND_LABELS[entry.kind]}</td><td>{entry.difficulty}</td><td><AdminStatusBadge tone={statusTone(entry.status)}>{entry.status}</AdminStatusBadge></td><td>{date(entry.updatedAt)}</td><td><div className="pf-question-row-actions"><button onClick={() => void action('view', entry)} aria-label="View"><Eye /></button><button onClick={() => void action('edit', entry)} aria-label="Edit"><Edit3 /></button><button onClick={() => void action('duplicate', entry)} aria-label="Duplicate"><Copy /></button><details><summary aria-label="More actions"><MoreHorizontal /></summary><div>{entry.status !== 'PUBLISHED' ? <button onClick={() => void action('publish', entry)}>Publish</button> : null}{entry.status !== 'ARCHIVED' ? <button onClick={() => void action('archive', entry)}>Archive</button> : null}<button className="is-danger" onClick={() => void action('trash', entry)}>Move to trash</button></div></details></div></td></tr>)}</tbody></table></div><footer className="pf-question-pagination"><span>{visible.length} question{visible.length === 1 ? '' : 's'}</span><div><button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {pages}</span><button type="button" disabled={page === pages} onClick={() => setPage(page + 1)}>Next</button></div></footer></> : <AdminEmptyState icon={<BadgeHelp />} title="No questions found" description="Adjust the filters or create the first question in this classification." action={<button className="pf-admin-button" type="button" onClick={openNew}><Plus size={17} /> Add question</button>} />}
      </section> : null}
      {tab === 'editor' ? <QuestionEditor initial={editing} taxonomy={taxonomy} onSave={saveEditor} onClose={() => { setTab('bank'); setEditing(null); }} /> : null}
      {tab === 'import' ? <ImportQuestions taxonomyRepository={scope === 'academy' ? academyTaxonomyRepository : undefined} onImport={async (records, created) => { await saveMany(records); await invalidateScope(); notify('Import complete', `${records.length} question records imported.${created.length ? ` ${created.length} taxonomy entries were created.` : ''}`); setTab('bank'); }} /> : null}
      {tab === 'taxonomy' ? <TaxonomyManager taxonomy={taxonomy} onCreate={async (level, parentId, name) => { await createTaxonomy(level, parentId, name); await invalidateScope(); notify(`${level} created`, `${name} is now available in question classification.`); }} /> : null}
      {tab === 'trash' ? <section className="pf-question-trash">{deleted.length ? deleted.map((entry) => <article key={entry.id}><Trash2 /><div><strong>{questionPlainText(entry.questionHtml || entry.caseHtml)}</strong><span>Deleted {date(entry.deletedAt!)}</span></div><button className="pf-admin-button pf-admin-button--secondary" type="button" onClick={() => void restore(entry.id).then(async () => { await invalidateScope(); notify('Question restored', 'It is back in the Question Bank.'); })}><RotateCcw size={16} /> Restore</button><button className="pf-admin-button pf-admin-button--danger" type="button" onClick={() => setConfirm({ type: 'delete', question: entry })}>Delete forever</button></article>) : <AdminEmptyState icon={<Trash2 />} title="Trash is empty" description="Deleted questions remain recoverable here until permanently removed." />}</section> : null}
    </motion.div> : null}</AnimatePresence>
    <AdminDialog open={Boolean(viewing)} onClose={() => setViewing(null)} title="Question details" description={viewing ? `${QUESTION_KIND_LABELS[viewing.kind]} · ${viewing.status}` : ''} size="large">{viewing ? <><QuestionPreview question={viewing} taxonomy={taxonomy!} adminDetails /><footer className="pf-question-details-actions"><button className="pf-admin-button pf-admin-button--secondary" onClick={() => { setEditing(viewing); setViewing(null); setTab('editor'); }}><Edit3 size={16} /> Edit</button></footer></> : null}</AdminDialog>
    <AdminDialog open={Boolean(confirm)} onClose={() => setConfirm(null)} title={confirm?.type === 'delete' ? 'Delete question permanently?' : 'Move question to trash?'} description={confirm?.type === 'delete' ? 'This action cannot be undone.' : 'You can restore it later from Trash.'}><div className="pf-question-confirm"><button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={() => setConfirm(null)}>Cancel</button><button className="pf-admin-button pf-admin-button--danger" type="button" onClick={() => { if (!confirm) return; const task = confirm.type === 'delete' ? permanentDelete(confirm.question.id) : trash(confirm.question.id); void task.then(async () => { await invalidateScope(); notify(confirm.type === 'delete' ? 'Question deleted' : 'Moved to trash', confirm.type === 'delete' ? 'The record was permanently removed.' : 'The question can be restored from Trash.'); setConfirm(null); }); }}>{confirm?.type === 'delete' ? 'Delete forever' : 'Move to trash'}</button></div></AdminDialog>
    <AdminToast toast={toast} onDismiss={() => setToast(null)} />
  </motion.main>;
}
