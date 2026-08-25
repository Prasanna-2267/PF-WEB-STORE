import { taxonomyRepository } from './taxonomyRepository';
import { emptyOptions, emptyQuestion, type ImportRowValues, type QuestionImportResult, type QuestionImportRow, type QuestionKind, type QuestionRecord, type QuestionStatus, type TaxonomyPathNames } from '../types/question';

const HEADERS: Array<[keyof ImportRowValues, string]> = [
  ['questionId', 'Question ID'], ['questionType', 'Question Type'], ['caseType', 'Case Type'], ['caseId', 'Case ID'], ['caseText', 'Case Text'],
  ['question', 'Question'], ['optionA', 'Option A'], ['optionB', 'Option B'], ['optionC', 'Option C'], ['optionD', 'Option D'],
  ['correctAnswer', 'Correct Answer'], ['correctExplanation', 'Correct Explanation'], ['wrongOptionsExplanation', 'Wrong Options Explanation'],
  ['answer', 'Answer'], ['keywords', 'Keywords'], ['classificationMode', 'Classification Mode'], ['course', 'Course'], ['subject', 'Subject'],
  ['chapter', 'Chapter'], ['lesson', 'Lesson'], ['topic', 'Topic'], ['status', 'Status'],
];

const normalizeHeader = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, '');
const valueText = (value: unknown) => String(value ?? '').trim();
const html = (value: string) => value ? `<p>${value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>` : '';
const kindFrom = (values: ImportRowValues): QuestionKind | null => {
  const questionType = values.questionType.toLocaleLowerCase().replace(/[^a-z]/g, '');
  const caseType = values.caseType.toLocaleLowerCase().replace(/[^a-z]/g, '');
  if (questionType.includes('case') || values.caseId || values.caseText) return caseType.includes('descriptive') || questionType.includes('descriptive') ? 'CASE_DESCRIPTIVE' : 'CASE_MCQ';
  if (questionType === 'mcq' || questionType.includes('multiplechoice')) return 'NORMAL_MCQ';
  if (questionType.includes('descriptive') || questionType.includes('normal')) return 'NORMAL_DESCRIPTIVE';
  return null;
};
const statusFrom = (value: string): QuestionStatus => {
  const status = value.trim().toLocaleUpperCase();
  return status === 'PUBLISHED' || status === 'ARCHIVED' ? status : 'DRAFT';
};
const stateFor = (errors: string[], warnings: string[]) => errors.length ? 'ERROR' as const : warnings.length ? 'WARNING' as const : 'VALID' as const;

const parseCsv = (text: string): string[][] => {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]; const next = text[index + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell); if (row.some((entry) => entry.trim())) rows.push(row); row = []; cell = '';
    } else cell += char;
  }
  row.push(cell); if (row.some((entry) => entry.trim())) rows.push(row);
  return rows;
};

const rowsFromFile = async (file: File): Promise<unknown[][]> => {
  if (/\.csv$/i.test(file.name) || file.type === 'text/csv') return parseCsv(await file.text());
  if (!/\.xlsx$/i.test(file.name)) throw new Error('Unsupported file. Upload an .xlsx or .csv file.');
  try {
    const { readSheet } = await import('read-excel-file/browser');
    return await readSheet(file);
  } catch { throw new Error('This spreadsheet could not be read. Use the downloadable template and save it as .xlsx or .csv.'); }
};

const validateRows = async (fileName: string, fileSize: number, rows: unknown[][]): Promise<QuestionImportResult> => {
  if (rows.length < 2) throw new Error('The spreadsheet has no question rows.');
  const header = rows[0].map(normalizeHeader);
  const indexes = Object.fromEntries(HEADERS.map(([key, label]) => [key, header.indexOf(normalizeHeader(label))])) as Record<keyof ImportRowValues, number>;
  const requiredHeaders: Array<keyof ImportRowValues> = ['questionType', 'question', 'course', 'subject', 'chapter', 'lesson', 'topic'];
  const missing = requiredHeaders.filter((key) => indexes[key] < 0).map((key) => HEADERS.find(([entry]) => entry === key)?.[1] ?? key);
  if (missing.length) throw new Error(`Missing required column${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}.`);
  const taxonomy = await taxonomyRepository.getAll();
  const questionIds = new Set<string>(); const caseKinds = new Map<string, QuestionKind>();
  const output: QuestionImportRow[] = rows.slice(1).filter((row) => row.some((cell) => valueText(cell))).map((row, offset) => {
    const values = Object.fromEntries(HEADERS.map(([key]) => [key, indexes[key] >= 0 ? valueText(row[indexes[key]]) : ''])) as unknown as ImportRowValues;
    const errors: string[] = []; const warnings: string[] = []; const kind = kindFrom(values);
    if (!kind) errors.push('Invalid Question Type. Use MCQ, Descriptive, Case MCQ, or Case Descriptive.');
    if (!values.question) errors.push('Missing Question.');
    if (values.questionId) { if (questionIds.has(values.questionId.toLocaleLowerCase())) errors.push('Duplicate Question ID in this file.'); questionIds.add(values.questionId.toLocaleLowerCase()); }
    if (kind === 'NORMAL_MCQ' || kind === 'CASE_MCQ') {
      (['optionA', 'optionB', 'optionC', 'optionD'] as const).forEach((key) => { if (!values[key]) errors.push(`${HEADERS.find(([entry]) => entry === key)?.[1]} is required for an MCQ.`); });
      if (!['A', 'B', 'C', 'D'].includes(values.correctAnswer.toLocaleUpperCase())) errors.push('Correct Answer must be A, B, C, or D.');
    }
    if ((kind === 'NORMAL_DESCRIPTIVE' || kind === 'CASE_DESCRIPTIVE') && !values.answer) errors.push('Answer is required for a descriptive question.');
    if (kind?.startsWith('CASE_')) {
      if (!values.caseId) errors.push('Missing Case ID.');
      if (!values.caseText) errors.push('Missing Case Text.');
      if (values.caseId) {
        const priorKind = caseKinds.get(values.caseId.toLocaleLowerCase());
        if (priorKind && priorKind !== kind) errors.push('Case ID is used with inconsistent case types.'); else if (kind) caseKinds.set(values.caseId.toLocaleLowerCase(), kind);
      }
    }
    (['course', 'subject', 'chapter', 'lesson', 'topic'] as const).forEach((key) => { if (!values[key]) errors.push(`Missing ${key[0].toLocaleUpperCase()}${key.slice(1)}.`); });
    const course = taxonomy.courses.find((entry) => entry.name.localeCompare(values.course, undefined, { sensitivity: 'accent' }) === 0);
    if (!course && values.course) errors.push(`Course "${values.course}" does not exist.`);
    const subject = course && taxonomy.subjects.find((entry) => entry.courseId === course.id && entry.name.localeCompare(values.subject, undefined, { sensitivity: 'accent' }) === 0);
    const chapter = subject && taxonomy.chapters.find((entry) => entry.subjectId === subject.id && entry.name.localeCompare(values.chapter, undefined, { sensitivity: 'accent' }) === 0);
    const lesson = chapter && taxonomy.lessons.find((entry) => entry.chapterId === chapter.id && entry.name.localeCompare(values.lesson, undefined, { sensitivity: 'accent' }) === 0);
    const topic = lesson && taxonomy.topics.find((entry) => entry.lessonId === lesson.id && entry.name.localeCompare(values.topic, undefined, { sensitivity: 'accent' }) === 0);
    if (course && values.subject && !subject) warnings.push(`Subject "${values.subject}" will be created.`);
    if (course && values.chapter && !chapter) warnings.push(`Chapter "${values.chapter}" will be created.`);
    if (course && values.lesson && !lesson) warnings.push(`Lesson "${values.lesson}" will be created.`);
    if (course && values.topic && !topic) warnings.push(`Topic "${values.topic}" will be created.`);
    if (values.status && !['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(values.status.toLocaleUpperCase())) warnings.push('Invalid Status will default to Draft.');
    if (!values.status) warnings.push('Status is blank and will default to Draft.');
    return { rowNumber: offset + 2, values, state: stateFor(errors, warnings), errors, warnings };
  });
  return { fileName, fileSize, total: output.length, valid: output.filter((row) => row.state === 'VALID').length, warnings: output.filter((row) => row.state === 'WARNING').length, errors: output.filter((row) => row.state === 'ERROR').length, rows: output };
};

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const optionValue = (values: ImportRowValues, id: 'A' | 'B' | 'C' | 'D') => values[id === 'A' ? 'optionA' : id === 'B' ? 'optionB' : id === 'C' ? 'optionC' : 'optionD'];
const highlightKeywords = (answer: string, keywords: string) => {
  let result = escapeHtml(answer);
  keywords.split(/[;,|]/).map((entry) => entry.trim()).filter(Boolean).forEach((keyword) => {
    const safeKeyword = escapeHtml(keyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(safeKeyword, 'gi'), (match) => `<mark data-keyword="true">${match}</mark>`);
  });
  return result ? `<p>${result}</p>` : '';
};

export const questionImportRepository = {
  async parse(file: File) { return validateRows(file.name, file.size, await rowsFromFile(file)); },
  async buildRecords(result: QuestionImportResult, taxonomy = taxonomyRepository): Promise<{ records: QuestionRecord[]; taxonomyCreated: string[] }> {
    const eligible = result.rows.filter((row) => row.state !== 'ERROR'); const taxonomyCreated = new Set<string>();
    const resolved = new Map<number, Awaited<ReturnType<typeof taxonomyRepository.ensurePath>>>();
    for (const row of eligible) {
      const path: TaxonomyPathNames = { course: row.values.course, subject: row.values.subject, chapter: row.values.chapter, lesson: row.values.lesson, topic: row.values.topic };
      const pathResult = await taxonomy.ensurePath(path); resolved.set(row.rowNumber, pathResult); pathResult.created.forEach((entry) => taxonomyCreated.add(entry));
    }
    const records: QuestionRecord[] = []; const caseGroups = new Map<string, QuestionImportRow[]>();
    eligible.forEach((row) => {
      const kind = kindFrom(row.values); if (!kind) return;
      if (kind.startsWith('CASE_')) { const key = row.values.caseId.toLocaleLowerCase(); caseGroups.set(key, [...(caseGroups.get(key) ?? []), row]); return; }
      const record = emptyQuestion(kind); const classification = resolved.get(row.rowNumber)?.classification ?? null;
      record.id = ''; record.status = statusFrom(row.values.status); record.questionHtml = html(row.values.question); record.classification = classification;
      if (kind === 'NORMAL_MCQ') {
        record.options = emptyOptions().map((option) => ({ ...option, html: html(optionValue(row.values, option.id)) }));
        record.correctOptionId = row.values.correctAnswer.toLocaleUpperCase() as 'A' | 'B' | 'C' | 'D'; record.correctExplanationHtml = html(row.values.correctExplanation); record.premiumWrongOptionsExplanationHtml = html(row.values.wrongOptionsExplanation);
      } else record.answerHtml = highlightKeywords(row.values.answer, row.values.keywords);
      records.push(record);
    });
    caseGroups.forEach((group) => {
      const first = group[0]; const kind = kindFrom(first.values); if (!kind) return;
      const record = emptyQuestion(kind); record.id = ''; record.caseId = first.values.caseId; record.caseHtml = html(first.values.caseText); record.status = statusFrom(first.values.status);
      record.classificationMode = first.values.classificationMode.toLocaleLowerCase().includes('individual') ? 'INDIVIDUAL_SUB_QUESTIONS' : 'ENTIRE_CASE';
      record.classification = record.classificationMode === 'ENTIRE_CASE' ? resolved.get(first.rowNumber)?.classification ?? null : null;
      record.subQuestions = group.map((row) => ({
        id: `sub-import-${row.rowNumber}-${Date.now()}`, questionHtml: html(row.values.question),
        options: kind === 'CASE_MCQ' ? emptyOptions().map((option) => ({ ...option, html: html(optionValue(row.values, option.id)) })) : [],
        correctOptionId: kind === 'CASE_MCQ' ? row.values.correctAnswer.toLocaleUpperCase() as 'A' | 'B' | 'C' | 'D' : null,
        correctExplanationHtml: html(row.values.correctExplanation), premiumWrongOptionsExplanationHtml: html(row.values.wrongOptionsExplanation),
        answerHtml: kind === 'CASE_DESCRIPTIVE' ? highlightKeywords(row.values.answer, row.values.keywords) : '',
        classification: record.classificationMode === 'INDIVIDUAL_SUB_QUESTIONS' ? resolved.get(row.rowNumber)?.classification ?? null : null,
      })); records.push(record);
    });
    return { records, taxonomyCreated: [...taxonomyCreated] };
  },
  downloadTemplate() {
    const header = HEADERS.map(([, label]) => label);
    const example = ['Q-001', 'MCQ', '', '', '', 'Which evidence is most reliable?', 'Oral statement', 'Internal memo', 'External confirmation', 'Photocopy', 'C', 'External evidence is ordinarily more reliable.', 'Other sources are less independent.', '', '', 'Entire Case', 'Chartered Accountancy', 'Auditing', 'Audit Evidence', 'Audit Procedures', 'Sufficient Appropriate Evidence', 'DRAFT'];
    const csv = [header, example].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'parallax-flow-question-import-template.csv'; anchor.click(); URL.revokeObjectURL(url);
  },
};
