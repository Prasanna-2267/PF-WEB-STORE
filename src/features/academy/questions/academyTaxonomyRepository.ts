import { apiRequest } from '@/lib/api/client';
import { fetchAcademyCourses } from '@/features/academy/readOnly/academyReadOnlyApi';
import type { TaxonomyRepository } from '@/features/admin/questions/api/taxonomyRepository';
import type { QuestionClassification, QuestionTaxonomy, TaxonomyLevel, TaxonomyPathNames } from '@/features/admin/questions/types/question';

const basePath = '/api/academy/questions';
const normalized = (value: string) => value.trim().replace(/\s+/g, ' ');
const sameName = (left: string, right: string) => normalized(left).localeCompare(normalized(right), undefined, { sensitivity: 'accent' }) === 0;
let data: QuestionTaxonomy = { courses: [], subjects: [], chapters: [], lessons: [], topics: [] };

const courseIdFor = (level: TaxonomyLevel, parentId: string) => {
  if (level === 'subject') return parentId;
  if (level === 'chapter') return data.subjects.find((entry) => entry.id === parentId)?.courseId ?? '';
  if (level === 'lesson') {
    const chapter = data.chapters.find((entry) => entry.id === parentId);
    return data.subjects.find((entry) => entry.id === chapter?.subjectId)?.courseId ?? '';
  }
  const lesson = data.lessons.find((entry) => entry.id === parentId);
  const chapter = data.chapters.find((entry) => entry.id === lesson?.chapterId);
  return data.subjects.find((entry) => entry.id === chapter?.subjectId)?.courseId ?? '';
};

async function createNode(level: TaxonomyLevel, parentId: string, name: string) {
  const courseId = courseIdFor(level, parentId);
  if (!courseId) throw new Error(`The ${level} parent is outside the authenticated Academy.`);
  return apiRequest<{ id: string; name: string }>(`${basePath}/taxonomy/${level}`, {
    method: 'POST', body: { courseId, parentId, name: normalized(name) },
  });
}

export const academyTaxonomyRepository: TaxonomyRepository = {
  async getAll() {
    const response = await fetchAcademyCourses({ page: 1, limit: 100, includeArchived: false });
    const courses = response.items.filter((course) => course.status !== 'ARCHIVED').map(({ id, name }) => ({ id, name }));
    const subjects: QuestionTaxonomy['subjects'] = [];
    const chapters: QuestionTaxonomy['chapters'] = [];
    const lessons: QuestionTaxonomy['lessons'] = [];
    const topics: QuestionTaxonomy['topics'] = [];
    for (const course of courses) {
      const taxonomy = await apiRequest<any>(`${basePath}/taxonomy?courseId=${encodeURIComponent(course.id)}`);
      for (const subject of taxonomy.subjects ?? []) {
        subjects.push({ id: subject.id, courseId: course.id, name: subject.name });
        for (const chapter of subject.taxonomyChapters ?? []) {
          chapters.push({ id: chapter.id, subjectId: subject.id, name: chapter.name });
          for (const lesson of chapter.lessons ?? []) {
            lessons.push({ id: lesson.id, chapterId: chapter.id, name: lesson.name });
            for (const topic of lesson.topics ?? []) topics.push({ id: topic.id, lessonId: lesson.id, name: topic.name });
          }
        }
      }
    }
    data = { courses, subjects, chapters, lessons, topics };
    return structuredClone(data);
  },
  async create(level, parentId, name) {
    await createNode(level, parentId, name);
    return this.getAll();
  },
  async ensurePath(path: TaxonomyPathNames): Promise<{ classification: QuestionClassification; created: string[] }> {
    await this.getAll();
    const created: string[] = [];
    const course = data.courses.find((entry) => sameName(entry.name, path.course));
    if (!course) throw new Error(`Course "${path.course}" is not an active course in this Academy.`);
    let subject = data.subjects.find((entry) => entry.courseId === course.id && sameName(entry.name, path.subject));
    if (!subject) {
      const node = await createNode('subject', course.id, path.subject);
      subject = { id: node.id, courseId: course.id, name: node.name }; data.subjects.push(subject); created.push(`Subject: ${node.name}`);
    }
    let chapter = data.chapters.find((entry) => entry.subjectId === subject!.id && sameName(entry.name, path.chapter));
    if (!chapter) {
      const node = await createNode('chapter', subject.id, path.chapter);
      chapter = { id: node.id, subjectId: subject.id, name: node.name }; data.chapters.push(chapter); created.push(`Chapter: ${node.name}`);
    }
    let lesson = data.lessons.find((entry) => entry.chapterId === chapter!.id && sameName(entry.name, path.lesson));
    if (!lesson) {
      const node = await createNode('lesson', chapter.id, path.lesson);
      lesson = { id: node.id, chapterId: chapter.id, name: node.name }; data.lessons.push(lesson); created.push(`Lesson: ${node.name}`);
    }
    let topic = data.topics.find((entry) => entry.lessonId === lesson!.id && sameName(entry.name, path.topic));
    if (!topic) {
      const node = await createNode('topic', lesson.id, path.topic);
      topic = { id: node.id, lessonId: lesson.id, name: node.name }; data.topics.push(topic); created.push(`Topic: ${node.name}`);
    }
    return { classification: { courseId: course.id, subjectId: subject.id, chapterId: chapter.id, lessonId: lesson.id, topicId: topic.id }, created };
  },
  async pathFor(classification) {
    if (!classification) return null;
    await this.getAll();
    const course = data.courses.find((entry) => entry.id === classification.courseId);
    const subject = data.subjects.find((entry) => entry.id === classification.subjectId);
    const chapter = data.chapters.find((entry) => entry.id === classification.chapterId);
    const lesson = data.lessons.find((entry) => entry.id === classification.lessonId);
    const topic = data.topics.find((entry) => entry.id === classification.topicId);
    return course && subject && chapter && lesson && topic ? { course: course.name, subject: subject.name, chapter: chapter.name, lesson: lesson.name, topic: topic.name } : null;
  },
};

