import { courseRepository } from '@/features/admin/courses/courseRepository';
import { apiRequest } from '@/lib/api/client';
import type { QuestionClassification, QuestionTaxonomy, TaxonomyLevel, TaxonomyPathNames } from '../types/question';

const normalized = (value: string) => value.trim().replace(/\s+/g, ' ');
const sameName = (left: string, right: string) => normalized(left).localeCompare(normalized(right), undefined, { sensitivity: 'accent' }) === 0;

interface BackendNode {
  id: string;
  name: string;
  taxonomyChapters?: BackendNode[];
  lessons?: BackendNode[];
  topics?: BackendNode[];
}

export interface TaxonomyRepository {
  getAll(): Promise<QuestionTaxonomy>;
  create(level: TaxonomyLevel, parentId: string, name: string): Promise<QuestionTaxonomy>;
  ensurePath(path: TaxonomyPathNames): Promise<{ classification: QuestionClassification; created: string[] }>;
  pathFor(classification: QuestionClassification | null): Promise<TaxonomyPathNames | null>;
}

async function loadTaxonomy(): Promise<QuestionTaxonomy> {
  const courses = (await courseRepository.list()).map(({ id, name }) => ({ id, name }));
  const subjects: QuestionTaxonomy['subjects'] = [];
  const chapters: QuestionTaxonomy['chapters'] = [];
  const lessons: QuestionTaxonomy['lessons'] = [];
  const topics: QuestionTaxonomy['topics'] = [];

  await Promise.all(courses.map(async (course) => {
    const response = await apiRequest<{ subjects?: BackendNode[] }>(`/api/admin/questions/taxonomy?courseId=${encodeURIComponent(course.id)}`);
    (response.subjects ?? []).forEach((subject) => {
      subjects.push({ id: subject.id, courseId: course.id, name: subject.name });
      (subject.taxonomyChapters ?? []).forEach((chapter) => {
        chapters.push({ id: chapter.id, subjectId: subject.id, name: chapter.name });
        (chapter.lessons ?? []).forEach((lesson) => {
          lessons.push({ id: lesson.id, chapterId: chapter.id, name: lesson.name });
          (lesson.topics ?? []).forEach((topic) => topics.push({ id: topic.id, lessonId: lesson.id, name: topic.name }));
        });
      });
    });
  }));

  return { courses, subjects, chapters, lessons, topics };
}

async function createNode(level: TaxonomyLevel, courseId: string, parentId: string, name: string): Promise<BackendNode> {
  return apiRequest<BackendNode>(`/api/admin/questions/taxonomy/${encodeURIComponent(level)}`, {
    method: 'POST',
    body: { courseId, parentId, name: normalized(name) },
  });
}

export const taxonomyRepository: TaxonomyRepository = {
  getAll: loadTaxonomy,

  async create(level, parentId, name) {
    const cleanName = normalized(name);
    if (!cleanName) throw new Error('A taxonomy name is required.');
    const taxonomy = await loadTaxonomy();
    const courseId = level === 'subject' ? parentId
      : level === 'chapter' ? taxonomy.subjects.find((item) => item.id === parentId)?.courseId
        : level === 'lesson' ? (() => { const chapter = taxonomy.chapters.find((item) => item.id === parentId); return taxonomy.subjects.find((item) => item.id === chapter?.subjectId)?.courseId; })()
          : (() => { const lesson = taxonomy.lessons.find((item) => item.id === parentId); const chapter = taxonomy.chapters.find((item) => item.id === lesson?.chapterId); return taxonomy.subjects.find((item) => item.id === chapter?.subjectId)?.courseId; })();
    if (!courseId) throw new Error('The selected taxonomy parent is no longer available. Refresh and try again.');
    await createNode(level, courseId, parentId, cleanName);
    return loadTaxonomy();
  },

  async ensurePath(path) {
    const taxonomy = await loadTaxonomy();
    const created: string[] = [];
    const course = taxonomy.courses.find((item) => sameName(item.name, path.course));
    if (!course) throw new Error(`Course "${path.course}" does not exist. Create it in Courses before importing.`);

    let subject = taxonomy.subjects.find((item) => item.courseId === course.id && sameName(item.name, path.subject));
    if (!subject) {
      const node = await createNode('subject', course.id, course.id, path.subject);
      subject = { id: node.id, courseId: course.id, name: node.name };
      created.push(`Subject: ${subject.name}`);
    }
    let chapter = taxonomy.chapters.find((item) => item.subjectId === subject.id && sameName(item.name, path.chapter));
    if (!chapter) {
      const node = await createNode('chapter', course.id, subject.id, path.chapter);
      chapter = { id: node.id, subjectId: subject.id, name: node.name };
      created.push(`Chapter: ${chapter.name}`);
    }
    let lesson = taxonomy.lessons.find((item) => item.chapterId === chapter.id && sameName(item.name, path.lesson));
    if (!lesson) {
      const node = await createNode('lesson', course.id, chapter.id, path.lesson);
      lesson = { id: node.id, chapterId: chapter.id, name: node.name };
      created.push(`Lesson: ${lesson.name}`);
    }
    let topic = taxonomy.topics.find((item) => item.lessonId === lesson.id && sameName(item.name, path.topic));
    if (!topic) {
      const node = await createNode('topic', course.id, lesson.id, path.topic);
      topic = { id: node.id, lessonId: lesson.id, name: node.name };
      created.push(`Topic: ${topic.name}`);
    }
    return { classification: { courseId: course.id, subjectId: subject.id, chapterId: chapter.id, lessonId: lesson.id, topicId: topic.id }, created };
  },

  async pathFor(classification) {
    if (!classification) return null;
    const taxonomy = await loadTaxonomy();
    const course = taxonomy.courses.find((item) => item.id === classification.courseId);
    const subject = taxonomy.subjects.find((item) => item.id === classification.subjectId);
    const chapter = taxonomy.chapters.find((item) => item.id === classification.chapterId);
    const lesson = taxonomy.lessons.find((item) => item.id === classification.lessonId);
    const topic = taxonomy.topics.find((item) => item.id === classification.topicId);
    return course && subject && chapter && lesson && topic
      ? { course: course.name, subject: subject.name, chapter: chapter.name, lesson: lesson.name, topic: topic.name }
      : null;
  },
};
