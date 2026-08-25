import { CheckCircle2, Crown } from 'lucide-react';
import { QUESTION_KIND_LABELS, type QuestionClassification, type QuestionRecord, type QuestionTaxonomy } from '../types/question';

const pathName = (classification: QuestionClassification | null, taxonomy: QuestionTaxonomy) => {
  if (!classification) return 'Classification incomplete';
  return [
    taxonomy.courses.find((entry) => entry.id === classification.courseId)?.name,
    taxonomy.subjects.find((entry) => entry.id === classification.subjectId)?.name,
    taxonomy.chapters.find((entry) => entry.id === classification.chapterId)?.name,
    taxonomy.lessons.find((entry) => entry.id === classification.lessonId)?.name,
    taxonomy.topics.find((entry) => entry.id === classification.topicId)?.name,
  ].filter(Boolean).join(' · ');
};

const formattedDate = (value: string) => new Intl.DateTimeFormat('en-IN', {
  day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
}).format(new Date(value));

export function QuestionPreview({ question, taxonomy, adminDetails = false }: { question: QuestionRecord; taxonomy: QuestionTaxonomy; adminDetails?: boolean }) {
  const entries = question.kind.startsWith('CASE_') ? question.subQuestions : [{
    id: question.id,
    questionHtml: question.questionHtml,
    options: question.options,
    correctOptionId: question.correctOptionId,
    answerHtml: question.answerHtml,
    correctExplanationHtml: question.correctExplanationHtml,
    premiumWrongOptionsExplanationHtml: question.premiumWrongOptionsExplanationHtml,
    classification: question.classification,
  }];

  return <article className="pf-question-preview">
    <header><span>{QUESTION_KIND_LABELS[question.kind]}</span><span>{question.difficulty}</span>{adminDetails ? <span>{question.status}</span> : null}</header>
    <p className="pf-question-preview__path">{question.classificationMode === 'INDIVIDUAL_SUB_QUESTIONS' ? 'Classification is assigned per sub-question' : pathName(question.classification, taxonomy)}</p>
    {adminDetails ? <dl className="pf-question-preview__metadata">
      <div><dt>Question ID</dt><dd>{question.id}</dd></div>
      {question.caseId ? <div><dt>Case ID</dt><dd>{question.caseId}</dd></div> : null}
      <div><dt>Created</dt><dd>{formattedDate(question.createdAt)}</dd></div>
      <div><dt>Updated</dt><dd>{formattedDate(question.updatedAt)}</dd></div>
    </dl> : null}
    {question.kind.startsWith('CASE_') ? <div className="pf-question-preview__case" dangerouslySetInnerHTML={{ __html: question.caseHtml }} /> : null}
    {entries.map((entry, index) => <section key={entry.id}>
      {question.kind.startsWith('CASE_') ? <small>Question {index + 1}</small> : null}
      {question.classificationMode === 'INDIVIDUAL_SUB_QUESTIONS' ? <p className="pf-question-preview__path">{pathName(entry.classification, taxonomy)}</p> : null}
      <div className="pf-question-preview__prompt" dangerouslySetInnerHTML={{ __html: entry.questionHtml }} />
      {entry.options?.length ? <div className="pf-question-preview__options">{entry.options.map((option) => <div className={entry.correctOptionId === option.id ? 'is-correct' : ''} key={option.id}><strong>{option.id}</strong><span dangerouslySetInnerHTML={{ __html: option.html }} />{entry.correctOptionId === option.id ? <CheckCircle2 size={16} /> : null}</div>)}</div> : <div className="pf-question-preview__answer" dangerouslySetInnerHTML={{ __html: entry.answerHtml }} />}
      {adminDetails && entry.correctExplanationHtml ? <div className="pf-question-preview__explanation"><strong>Correct-answer explanation</strong><div dangerouslySetInnerHTML={{ __html: entry.correctExplanationHtml }} /></div> : null}
      {adminDetails && entry.premiumWrongOptionsExplanationHtml ? <div className="pf-question-preview__explanation is-premium"><strong><Crown size={15} /> Premium wrong-options explanation</strong><div dangerouslySetInnerHTML={{ __html: entry.premiumWrongOptionsExplanationHtml }} /></div> : null}
    </section>)}
  </article>;
}
