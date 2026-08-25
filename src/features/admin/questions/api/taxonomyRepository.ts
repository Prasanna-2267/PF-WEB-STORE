import { courseRepository } from '@/features/admin/courses/courseRepository';
import { apiRequest } from '@/lib/api/client';
import type {
  QuestionClassification,
  QuestionTaxonomy,
  TaxonomyLevel,
  TaxonomyPathNames,
} from '../types/question';

const STORAGE_KEY = 'pf_admin_question_taxonomy_v1';
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
const wait = (ms = 35) => new Promise((resolve) => window.setTimeout(resolve, ms));
const normalized = (value: string) => value.trim().replace(/\s+/g, ' ');
const sameName = (left: string, right: string) => normalized(left).localeCompare(normalized(right), undefined, { sensitivity: 'accent' }) === 0;

const fixture: Omit<QuestionTaxonomy, 'courses'> = {
  subjects: [
    { id: 'subject-ca-audit', courseId: 'course-chartered-accountancy', name: 'Auditing' },
    { id: 'subject-ca-accounting', courseId: 'course-chartered-accountancy', name: 'Advanced Accounting' },
    { id: 'subject-ca-law', courseId: 'course-chartered-accountancy', name: 'Corporate and Other Laws' },
    { id: 'subject-jee-physics', courseId: 'course-jee', name: 'Physics' },
    { id: 'subject-jee-mathematics', courseId: 'course-jee', name: 'Mathematics' },
    { id: 'subject-neet-biology', courseId: 'course-neet', name: 'Biology' },
    { id: 'subject-upsc-polity', courseId: 'course-upsc', name: 'Indian Polity' },
  ],
  chapters: [
    { id: 'chapter-audit-evidence', subjectId: 'subject-ca-audit', name: 'Audit Evidence' },
    { id: 'chapter-audit-planning', subjectId: 'subject-ca-audit', name: 'Audit Planning' },
    { id: 'chapter-accounting-standards', subjectId: 'subject-ca-accounting', name: 'Accounting Standards' },
    { id: 'chapter-company-law', subjectId: 'subject-ca-law', name: 'Company Law' },
    { id: 'chapter-jee-mechanics', subjectId: 'subject-jee-physics', name: 'Mechanics' },
    { id: 'chapter-jee-calculus', subjectId: 'subject-jee-mathematics', name: 'Calculus' },
    { id: 'chapter-neet-genetics', subjectId: 'subject-neet-biology', name: 'Genetics' },
    { id: 'chapter-upsc-constitution', subjectId: 'subject-upsc-polity', name: 'Constitution' },
  ],
  lessons: [
    { id: 'lesson-audit-documentation', chapterId: 'chapter-audit-evidence', name: 'Audit Documentation' },
    { id: 'lesson-audit-procedures', chapterId: 'chapter-audit-evidence', name: 'Audit Procedures' },
    { id: 'lesson-materiality', chapterId: 'chapter-audit-planning', name: 'Materiality and Risk' },
    { id: 'lesson-as-29', chapterId: 'chapter-accounting-standards', name: 'AS 29' },
    { id: 'lesson-directors', chapterId: 'chapter-company-law', name: 'Directors' },
    { id: 'lesson-projectile', chapterId: 'chapter-jee-mechanics', name: 'Projectile Motion' },
    { id: 'lesson-differentiation', chapterId: 'chapter-jee-calculus', name: 'Differentiation' },
    { id: 'lesson-inheritance', chapterId: 'chapter-neet-genetics', name: 'Mendelian Inheritance' },
    { id: 'lesson-fundamental-rights', chapterId: 'chapter-upsc-constitution', name: 'Fundamental Rights' },
  ],
  topics: [
    { id: 'topic-working-papers', lessonId: 'lesson-audit-documentation', name: 'Working Papers' },
    { id: 'topic-sufficient-evidence', lessonId: 'lesson-audit-procedures', name: 'Sufficient Appropriate Evidence' },
    { id: 'topic-audit-risk', lessonId: 'lesson-materiality', name: 'Audit Risk' },
    { id: 'topic-provisions', lessonId: 'lesson-as-29', name: 'Provisions and Contingencies' },
    { id: 'topic-director-duties', lessonId: 'lesson-directors', name: 'Duties of Directors' },
    { id: 'topic-projectile-equations', lessonId: 'lesson-projectile', name: 'Projectile Equations' },
    { id: 'topic-derivatives', lessonId: 'lesson-differentiation', name: 'Derivatives' },
    { id: 'topic-monohybrid', lessonId: 'lesson-inheritance', name: 'Monohybrid Cross' },
    { id: 'topic-article-19', lessonId: 'lesson-fundamental-rights', name: 'Article 19' },
  ],
};

const read = (): Omit<QuestionTaxonomy, 'courses'> => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<QuestionTaxonomy>) : null;
    if (parsed && Array.isArray(parsed.subjects) && Array.isArray(parsed.chapters) && Array.isArray(parsed.lessons) && Array.isArray(parsed.topics)) {
      return { subjects: parsed.subjects, chapters: parsed.chapters, lessons: parsed.lessons, topics: parsed.topics };
    }
  } catch {
    /* fallback */
  }
  return clone(fixture);
};

let data = typeof window === 'undefined' ? clone(fixture) : read();
const persist = () => window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...data }));

export interface TaxonomyRepository {
  getAll(): Promise<QuestionTaxonomy>;
  create(level: TaxonomyLevel, parentId: string, name: string): Promise<QuestionTaxonomy>;
  ensurePath(path: TaxonomyPathNames): Promise<{ classification: QuestionClassification; created: string[] }>;
  pathFor(classification: QuestionClassification | null): Promise<TaxonomyPathNames | null>;
}

export const taxonomyRepository: TaxonomyRepository = {
  async getAll() {
    const courses = (await courseRepository.list()).map(({ id, name }) => ({ id, name }));
    const allSubjects: any[] = [];
    const allChapters: any[] = [];
    const allLessons: any[] = [];
    const allTopics: any[] = [];

    for (const c of courses) {
      try {
        const backendCourse = await apiRequest<any>(`/api/admin/questions/taxonomy?courseId=${encodeURIComponent(c.id)}`);
        if (backendCourse && Array.isArray(backendCourse.subjects)) {
          for (const sub of backendCourse.subjects) {
            allSubjects.push({ id: sub.id, courseId: c.id, name: sub.name });
            if (Array.isArray(sub.taxonomyChapters)) {
              for (const ch of sub.taxonomyChapters) {
                allChapters.push({ id: ch.id, subjectId: sub.id, name: ch.name });
                if (Array.isArray(ch.lessons)) {
                  for (const l of ch.lessons) {
                    allLessons.push({ id: l.id, chapterId: ch.id, name: l.name });
                    if (Array.isArray(l.topics)) {
                      for (const t of l.topics) {
                        allTopics.push({ id: t.id, lessonId: l.id, name: t.name });
                      }
                    }
                  }
                }
              }
            }
          }
        }
      } catch {
        // Fall back to local storage data for this course
      }
    }

    if (allSubjects.length > 0) {
      data = { subjects: allSubjects, chapters: allChapters, lessons: allLessons, topics: allTopics };
      persist();
    }

    return clone({ courses, ...data });
  },

  async create(level, parentId, name) {
    const cleanName = normalized(name);
    if (!cleanName) throw new Error('A taxonomy name is required.');

    let courseId = '';
    if (level === 'subject') courseId = parentId;
    else if (level === 'chapter') {
      const parentSub = data.subjects.find((s) => s.id === parentId);
      if (parentSub) courseId = parentSub.courseId;
    } else if (level === 'lesson') {
      const parentCh = data.chapters.find((c) => c.id === parentId);
      const parentSub = parentCh && data.subjects.find((s) => s.id === parentCh.subjectId);
      if (parentSub) courseId = parentSub.courseId;
    } else if (level === 'topic') {
      const parentL = data.lessons.find((l) => l.id === parentId);
      const parentCh = parentL && data.chapters.find((c) => c.id === parentL.chapterId);
      const parentSub = parentCh && data.subjects.find((s) => s.id === parentCh.subjectId);
      if (parentSub) courseId = parentSub.courseId;
    }

    if (courseId) {
      try {
        await apiRequest(`/api/admin/questions/taxonomy/${encodeURIComponent(level)}`, {
          method: 'POST',
          body: { courseId, parentId, name: cleanName },
        });
        return this.getAll();
      } catch {
        // Local fallback
      }
    }

    if (level === 'subject') {
      if (data.subjects.some((entry) => entry.courseId === parentId && sameName(entry.name, cleanName))) throw new Error('This subject already exists in the selected course.');
      data.subjects.push({ id: makeId('subject'), courseId: parentId, name: cleanName });
    } else if (level === 'chapter') {
      if (data.chapters.some((entry) => entry.subjectId === parentId && sameName(entry.name, cleanName))) throw new Error('This chapter already exists in the selected subject.');
      data.chapters.push({ id: makeId('chapter'), subjectId: parentId, name: cleanName });
    } else if (level === 'lesson') {
      if (data.lessons.some((entry) => entry.chapterId === parentId && sameName(entry.name, cleanName))) throw new Error('This lesson already exists in the selected chapter.');
      data.lessons.push({ id: makeId('lesson'), chapterId: parentId, name: cleanName });
    } else {
      if (data.topics.some((entry) => entry.lessonId === parentId && sameName(entry.name, cleanName))) throw new Error('This topic already exists in the selected lesson.');
      data.topics.push({ id: makeId('topic'), lessonId: parentId, name: cleanName });
    }
    persist();
    return this.getAll();
  },

  async ensurePath(path) {
    const courses = await courseRepository.list();
    const created: string[] = [];
    const course = courses.find((entry) => sameName(entry.name, path.course) || sameName(entry.code, path.course));
    if (!course) throw new Error(`Course "${path.course}" does not exist. Create it in Courses before importing.`);

    let subject = data.subjects.find((entry) => entry.courseId === course.id && sameName(entry.name, path.subject));
    if (!subject) {
      try {
        const node: any = await apiRequest(`/api/admin/questions/taxonomy/subject`, {
          method: 'POST',
          body: { courseId: course.id, parentId: course.id, name: normalized(path.subject) },
        });
        subject = { id: node.id, courseId: course.id, name: normalized(path.subject) };
      } catch {
        subject = { id: makeId('subject'), courseId: course.id, name: normalized(path.subject) };
      }
      data.subjects.push(subject);
      created.push(`Subject: ${subject.name}`);
    }

    let chapter = data.chapters.find((entry) => entry.subjectId === subject.id && sameName(entry.name, path.chapter));
    if (!chapter) {
      try {
        const node: any = await apiRequest(`/api/admin/questions/taxonomy/chapter`, {
          method: 'POST',
          body: { courseId: course.id, parentId: subject.id, name: normalized(path.chapter) },
        });
        chapter = { id: node.id, subjectId: subject.id, name: normalized(path.chapter) };
      } catch {
        chapter = { id: makeId('chapter'), subjectId: subject.id, name: normalized(path.chapter) };
      }
      data.chapters.push(chapter);
      created.push(`Chapter: ${chapter.name}`);
    }

    let lesson = data.lessons.find((entry) => entry.chapterId === chapter.id && sameName(entry.name, path.lesson));
    if (!lesson) {
      try {
        const node: any = await apiRequest(`/api/admin/questions/taxonomy/lesson`, {
          method: 'POST',
          body: { courseId: course.id, parentId: chapter.id, name: normalized(path.lesson) },
        });
        lesson = { id: node.id, chapterId: chapter.id, name: normalized(path.lesson) };
      } catch {
        lesson = { id: makeId('lesson'), chapterId: chapter.id, name: normalized(path.lesson) };
      }
      data.lessons.push(lesson);
      created.push(`Lesson: ${lesson.name}`);
    }

    let topic = data.topics.find((entry) => entry.lessonId === lesson.id && sameName(entry.name, path.topic));
    if (!topic) {
      try {
        const node: any = await apiRequest(`/api/admin/questions/taxonomy/topic`, {
          method: 'POST',
          body: { courseId: course.id, parentId: lesson.id, name: normalized(path.topic) },
        });
        topic = { id: node.id, lessonId: lesson.id, name: normalized(path.topic) };
      } catch {
        topic = { id: makeId('topic'), lessonId: lesson.id, name: normalized(path.topic) };
      }
      data.topics.push(topic);
      created.push(`Topic: ${topic.name}`);
    }

    if (created.length) persist();
    return { classification: { courseId: course.id, subjectId: subject.id, chapterId: chapter.id, lessonId: lesson.id, topicId: topic.id }, created };
  },

  async pathFor(classification) {
    if (!classification) return null;
    const taxonomy = await this.getAll();
    const course = taxonomy.courses.find((entry) => entry.id === classification.courseId);
    const subject = taxonomy.subjects.find((entry) => entry.id === classification.subjectId);
    const chapter = taxonomy.chapters.find((entry) => entry.id === classification.chapterId);
    const lesson = taxonomy.lessons.find((entry) => entry.id === classification.lessonId);
    const topic = taxonomy.topics.find((entry) => entry.id === classification.topicId);
    if (!course || !subject || !chapter || !lesson || !topic) return null;
    return { course: course.name, subject: subject.name, chapter: chapter.name, lesson: lesson.name, topic: topic.name };
  },
};
