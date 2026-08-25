import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, Reorder, motion } from 'framer-motion';
import { ArrowLeft, Copy, Eye, GripVertical, Plus, Save, Send, Trash2, X } from 'lucide-react';
import { AdminDialog } from '../../AdminUi';
import { emptyQuestion, emptySubQuestion, QUESTION_KIND_LABELS, type CaseSubQuestion, type QuestionKind, type QuestionRecord, type QuestionTaxonomy } from '../types/question';
import { validateQuestion } from '../api/questionRepository';
import { RichTextEditor } from './RichTextEditor';
import { TaxonomySelector } from './TaxonomySelector';
import { QuestionPreview } from './QuestionPreview';

interface Props { initial?: QuestionRecord | null; taxonomy: QuestionTaxonomy; onSave: (question: QuestionRecord, publish: boolean) => Promise<void>; onClose: () => void; }
type PickerStep = 'category' | 'mcq' | 'case' | 'editor';
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const sessionKey = 'pf_question_editor_draft';

export function QuestionEditor({ initial, taxonomy, onSave, onClose }: Props) {
  const [question, setQuestion] = useState<QuestionRecord>(() => clone(initial ?? emptyQuestion()));
  const baseline = useRef(JSON.stringify(question));
  const [pickerStep, setPickerStep] = useState<PickerStep>(initial?.id ? 'editor' : 'category');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState(false); const [saving, setSaving] = useState(false); const [confirmClose, setConfirmClose] = useState(false); const [saveError, setSaveError] = useState('');
  const dirty = JSON.stringify(question) !== baseline.current;
  useEffect(() => { window.sessionStorage.setItem(sessionKey, JSON.stringify(question)); }, [question]);
  useEffect(() => { const guard = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); }; window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard); }, [dirty]);
  const changeKind = (kind: QuestionKind) => { setQuestion(emptyQuestion(kind)); setErrors({}); setPickerStep('editor'); };
  const commit = async (publish: boolean) => {
    const next = { ...question, status: publish ? 'PUBLISHED' as const : question.status === 'PUBLISHED' ? 'PUBLISHED' as const : 'DRAFT' as const };
    const nextErrors = validateQuestion(next, publish ? 'publish' : 'draft'); setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaving(true); setSaveError('');
    try { await onSave(next, publish); window.sessionStorage.removeItem(sessionKey); }
    catch (caught) { setSaveError(caught instanceof Error ? caught.message : 'The question could not be saved.'); }
    finally { setSaving(false); }
  };
  const updateSub = (id: string, update: Partial<CaseSubQuestion>) => setQuestion((state) => ({ ...state, subQuestions: state.subQuestions.map((entry) => entry.id === id ? { ...entry, ...update } : entry) }));
  const duplicateSub = (entry: CaseSubQuestion) => setQuestion((state) => ({ ...state, subQuestions: [...state.subQuestions, { ...clone(entry), id: emptySubQuestion(state.kind).id }] }));
  const close = () => dirty ? setConfirmClose(true) : onClose();

  return <motion.section className="pf-question-workspace" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
    <header className="pf-question-workspace__header"><div><button type="button" className="pf-admin-icon-button" onClick={close} aria-label="Close editor"><X /></button><div><small>{initial?.id ? 'EDIT QUESTION' : 'NEW QUESTION'}</small><h2>{pickerStep === 'editor' ? QUESTION_KIND_LABELS[question.kind] : 'Choose a question type'}</h2></div></div><div>{pickerStep === 'editor' ? <button className="pf-admin-button pf-admin-button--secondary" type="button" onClick={() => setPreview(true)}><Eye size={17} /> Preview</button> : null}</div></header>
    {!initial?.id && pickerStep !== 'editor' ? <div className="pf-question-kind-flow">
      {pickerStep !== 'category' ? <button type="button" className="pf-question-kind-back" onClick={() => setPickerStep('category')}><ArrowLeft size={16} /> Back to question types</button> : null}
      <div className="pf-question-kind-picker" role="group" aria-label={pickerStep === 'category' ? 'Question category' : 'Question subtype'}>
        {pickerStep === 'category' ? <>
          <button type="button" onClick={() => setPickerStep('mcq')}><strong>MCQ</strong><span>Multiple-choice question with four options and answer explanations.</span></button>
          <button type="button" onClick={() => setPickerStep('case')}><strong>Case-based</strong><span>A shared scenario containing one or more reorderable questions.</span></button>
          <button type="button" onClick={() => changeKind('NORMAL_DESCRIPTIVE')}><strong>Normal / Descriptive</strong><span>An open-ended question with a structured answer and keyword highlighting.</span></button>
        </> : null}
        {pickerStep === 'mcq' ? <>
          <button type="button" onClick={() => changeKind('NORMAL_MCQ')}><strong>Normal MCQ</strong><span>One prompt, four options, one correct answer, and separate explanations.</span></button>
          <button type="button" onClick={() => changeKind('CASE_MCQ')}><strong>Case-based MCQ</strong><span>A shared case with independently managed multiple-choice sub-questions.</span></button>
        </> : null}
        {pickerStep === 'case' ? <>
          <button type="button" onClick={() => changeKind('CASE_MCQ')}><strong>Case-based MCQ</strong><span>A case followed by one or more four-option questions.</span></button>
          <button type="button" onClick={() => changeKind('CASE_DESCRIPTIVE')}><strong>Case-based descriptive</strong><span>A case followed by open-ended answers with keyword highlighting.</span></button>
        </> : null}
      </div>
    </div> : null}
    {pickerStep === 'editor' ? <>
    <div className="pf-question-workspace__body">
      <div className="pf-question-editor-main">
        <section className="pf-question-form-card"><header><span>01</span><div><h3>Question content</h3><p>Build the learner-facing content and answer logic.</p></div></header>
          {question.kind.startsWith('CASE_') ? <><RichTextEditor label="Case passage" value={question.caseHtml} onChange={(caseHtml) => setQuestion({ ...question, caseHtml })} error={errors.caseHtml} placeholder="Write the case, facts, or shared scenario…" /><div className="pf-question-editor__row"><label className="pf-admin-field"><span>Case ID</span><input className="pf-admin-input" value={question.caseId ?? ''} onChange={(event) => setQuestion({ ...question, caseId: event.target.value })} placeholder="CASE-AUD-001" /></label><label className="pf-admin-field"><span>Classification</span><select className="pf-admin-select" value={question.classificationMode} onChange={(event) => setQuestion({ ...question, classificationMode: event.target.value as QuestionRecord['classificationMode'] })}><option value="ENTIRE_CASE">Entire case</option><option value="INDIVIDUAL_SUB_QUESTIONS">Each sub-question</option></select></label></div></> : <RichTextEditor label="Question" value={question.questionHtml} onChange={(questionHtml) => setQuestion({ ...question, questionHtml })} error={errors.questionHtml} placeholder="Write the question…" />}
          {question.kind === 'NORMAL_MCQ' ? <McqFields question={question} errors={errors} onChange={setQuestion} /> : null}
          {question.kind === 'NORMAL_DESCRIPTIVE' ? <RichTextEditor label="Model answer" value={question.answerHtml} onChange={(answerHtml) => setQuestion({ ...question, answerHtml })} error={errors.answerHtml} placeholder="Write the model answer and highlight required keywords…" /> : null}
        </section>
        {question.kind.startsWith('CASE_') ? <section className="pf-question-form-card"><header><span>02</span><div><h3>Sub-questions</h3><p>Drag to reorder. Duplicate or remove any entry.</p></div><button type="button" className="pf-admin-button pf-admin-button--secondary" onClick={() => setQuestion({ ...question, subQuestions: [...question.subQuestions, emptySubQuestion(question.kind)] })}><Plus size={16} /> Add</button></header>
          <Reorder.Group className="pf-case-list" axis="y" values={question.subQuestions} onReorder={(subQuestions) => setQuestion({ ...question, subQuestions })}>{question.subQuestions.map((entry, index) => <Reorder.Item key={entry.id} value={entry} className="pf-case-subquestion"><header><GripVertical /><strong>Question {index + 1}</strong><span /><button type="button" onClick={() => duplicateSub(entry)} aria-label="Duplicate sub-question"><Copy size={16} /></button><button type="button" onClick={() => setQuestion({ ...question, subQuestions: question.subQuestions.filter((item) => item.id !== entry.id) })} aria-label="Delete sub-question"><Trash2 size={16} /></button></header><RichTextEditor compact label="Prompt" value={entry.questionHtml} onChange={(questionHtml) => updateSub(entry.id, { questionHtml })} error={errors[`subQuestions.${index}.questionHtml`]} />{question.kind === 'CASE_MCQ' ? <McqFields question={{ ...question, options: entry.options, correctOptionId: entry.correctOptionId, correctExplanationHtml: entry.correctExplanationHtml, premiumWrongOptionsExplanationHtml: entry.premiumWrongOptionsExplanationHtml }} prefix={`subQuestions.${index}.`} errors={errors} onChange={(next) => updateSub(entry.id, { options: next.options, correctOptionId: next.correctOptionId, correctExplanationHtml: next.correctExplanationHtml, premiumWrongOptionsExplanationHtml: next.premiumWrongOptionsExplanationHtml })} /> : <RichTextEditor compact label="Model answer" value={entry.answerHtml} onChange={(answerHtml) => updateSub(entry.id, { answerHtml })} error={errors[`subQuestions.${index}.answerHtml`]} />}{question.classificationMode === 'INDIVIDUAL_SUB_QUESTIONS' ? <TaxonomySelector taxonomy={taxonomy} value={entry.classification} onChange={(classification) => updateSub(entry.id, { classification })} errors={errors} prefix={`subQuestions.${index}.`} /> : null}</Reorder.Item>)}</Reorder.Group>{errors.subQuestions ? <p className="pf-question-field-error">{errors.subQuestions}</p> : null}
        </section> : null}
      </div>
      <aside className="pf-question-editor-side"><section className="pf-question-form-card"><header><span>{question.kind.startsWith('CASE_') ? '03' : '02'}</span><div><h3>Classification</h3><p>Use the existing academic hierarchy.</p></div></header>{question.classificationMode === 'ENTIRE_CASE' || !question.kind.startsWith('CASE_') ? <TaxonomySelector taxonomy={taxonomy} value={question.classification} onChange={(classification) => setQuestion({ ...question, classification })} errors={errors} /> : <p className="pf-question-muted">Classification is configured inside each sub-question.</p>}</section><section className="pf-question-form-card"><label className="pf-admin-field"><span>Difficulty</span><select className="pf-admin-select" value={question.difficulty} onChange={(event) => setQuestion({ ...question, difficulty: event.target.value as QuestionRecord['difficulty'] })}><option value="FOUNDATION">Foundation</option><option value="INTERMEDIATE">Intermediate</option><option value="ADVANCED">Advanced</option></select></label><p className="pf-question-autosave"><Save size={15} /> Temporary editor state is preserved in this browser.</p></section></aside>
    </div>
    {saveError ? <p className="pf-question-save-error" role="alert">{saveError}</p> : null}
    <footer className="pf-question-workspace__actions"><button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={close}>Cancel</button><button className="pf-admin-button pf-admin-button--secondary" disabled={saving} type="button" onClick={() => void commit(false)}><Save size={17} /> Save draft</button><button className="pf-admin-button" disabled={saving} type="button" onClick={() => void commit(true)}><Send size={17} /> {question.status === 'PUBLISHED' ? 'Update published' : 'Publish'}</button></footer>
    </> : null}
    <AdminDialog open={preview} onClose={() => setPreview(false)} title="Learner preview" description="Review the question before publishing."><QuestionPreview question={question} taxonomy={taxonomy} /></AdminDialog>
    <AdminDialog open={confirmClose} onClose={() => setConfirmClose(false)} title="Discard unsaved changes?" description="Your saved Question Bank will not be changed."><div className="pf-question-confirm"><button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={() => setConfirmClose(false)}>Keep editing</button><button className="pf-admin-button pf-admin-button--danger" type="button" onClick={onClose}>Discard changes</button></div></AdminDialog>
  </motion.section>;
}

function McqFields({ question, onChange, errors, prefix = '' }: { question: QuestionRecord; onChange: (value: QuestionRecord) => void; errors: Record<string, string>; prefix?: string }) {
  return <div className="pf-question-mcq"><div className="pf-question-options">{question.options.map((option) => <div className="pf-question-option" key={option.id}><label className="pf-question-option__choice"><input type="radio" name={`correct-${prefix}`} checked={question.correctOptionId === option.id} onChange={() => onChange({ ...question, correctOptionId: option.id })} /><span>{option.id}</span></label><RichTextEditor compact label={`Option ${option.id}`} value={option.html} onChange={(html) => onChange({ ...question, options: question.options.map((item) => item.id === option.id ? { ...item, html } : item) })} error={errors[`${prefix}option.${option.id}`]} /></div>)}</div>{errors[`${prefix}correctOptionId`] ? <p className="pf-question-field-error">{errors[`${prefix}correctOptionId`]}</p> : null}<RichTextEditor compact label="Correct-answer explanation" value={question.correctExplanationHtml} onChange={(correctExplanationHtml) => onChange({ ...question, correctExplanationHtml })} /><RichTextEditor compact label="Premium wrong-options explanation" value={question.premiumWrongOptionsExplanationHtml} onChange={(premiumWrongOptionsExplanationHtml) => onChange({ ...question, premiumWrongOptionsExplanationHtml })} /></div>;
}
