import { AppSelect } from '@/components/ui/AppSelect';
import type { QuestionClassification, QuestionTaxonomy } from '../types/question';

interface Props { taxonomy: QuestionTaxonomy; value: QuestionClassification | null; onChange: (value: QuestionClassification) => void; errors?: Record<string, string>; prefix?: string; }
const empty = (): QuestionClassification => ({ courseId: '', subjectId: '', chapterId: '', lessonId: '', topicId: '' });

export function TaxonomySelector({ taxonomy, value, onChange, errors = {}, prefix = '' }: Props) {
  const current = value ?? empty();
  const subjects = taxonomy.subjects.filter((entry) => entry.courseId === current.courseId);
  const chapters = taxonomy.chapters.filter((entry) => entry.subjectId === current.subjectId);
  const lessons = taxonomy.lessons.filter((entry) => entry.chapterId === current.chapterId);
  const topics = taxonomy.topics.filter((entry) => entry.lessonId === current.lessonId);
  const field = (label: string, key: keyof QuestionClassification, options: Array<{ id: string; name: string }>, disabled: boolean, reset: Partial<QuestionClassification>) => <label className="pf-admin-field"><span>{label}</span><AppSelect className={`pf-admin-select ${errors[`${prefix}${key}`] ? 'is-invalid' : ''}`} value={current[key]} disabled={disabled} onChange={(event) => onChange({ ...current, ...reset, [key]: event.target.value })}><option value="">Select {label.toLocaleLowerCase()}</option>{options.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</AppSelect>{errors[`${prefix}${key}`] ? <small className="pf-question-field-error">{errors[`${prefix}${key}`]}</small> : null}</label>;
  return <div className="pf-question-taxonomy" aria-label="Question classification">
    {field('Course', 'courseId', taxonomy.courses, false, { subjectId: '', chapterId: '', lessonId: '', topicId: '' })}
    {field('Subject', 'subjectId', subjects, !current.courseId, { chapterId: '', lessonId: '', topicId: '' })}
    {field('Chapter', 'chapterId', chapters, !current.subjectId, { lessonId: '', topicId: '' })}
    {field('Lesson', 'lessonId', lessons, !current.chapterId, { topicId: '' })}
    {field('Topic', 'topicId', topics, !current.lessonId, {})}
  </div>;
}
