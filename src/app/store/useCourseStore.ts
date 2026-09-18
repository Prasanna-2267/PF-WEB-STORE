import { create } from 'zustand';
import { courseRepository, type CourseInput } from '@/features/admin/courses/courseRepository';
import type { AdminCourse } from '@/features/admin/types/admin';

export type CourseModule = 'students' | 'orders' | 'content' | 'packages' | 'questions';
const CONTEXT_KEY = 'pf_admin_course_context_v1';

interface CourseState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  courses: AdminCourse[];
  selections: Partial<Record<CourseModule, string>>;
  error: string | null;
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  select: (module: CourseModule, courseId: string) => void;
  selectedCourse: (module: CourseModule) => AdminCourse | null;
  createCourse: (input: CourseInput) => Promise<AdminCourse>;
  updateCourse: (courseId: string, input: CourseInput) => Promise<AdminCourse>;
  deleteCourse: (courseId: string) => Promise<void>;
}

const storedSelections = (): Partial<Record<CourseModule, string>> => {
  try { return JSON.parse(window.sessionStorage.getItem(CONTEXT_KEY) ?? '{}') as Partial<Record<CourseModule, string>>; } catch { return {}; }
};
const persistSelections = (selections: Partial<Record<CourseModule, string>>) => window.sessionStorage.setItem(CONTEXT_KEY, JSON.stringify(selections));

export const useCourseStore = create<CourseState>((set, get) => {
  const chooseFallbacks = (courses: AdminCourse[], selections: Partial<Record<CourseModule, string>>) => {
    const active = courses.filter((course) => course.status === 'ACTIVE'); const fallback = active[0]?.id;
    const next = { ...selections };
    (['students', 'orders', 'content', 'packages', 'questions'] as CourseModule[]).forEach((module) => {
      if (!courses.some((course) => course.id === next[module] && course.status === 'ACTIVE')) next[module] = fallback;
    });
    return next;
  };
  const load = async (background = false) => {
    if (background) set({ error: null });
    else set({ status: 'loading', error: null });
    try {
      const courses = await courseRepository.list();
      const selections = chooseFallbacks(courses, { ...storedSelections(), ...get().selections });
      persistSelections(selections);
      set({ courses, selections, status: 'ready' });
    }
    catch (error) { set({ status: 'error', error: error instanceof Error ? error.message : 'Courses could not be loaded.' }); }
  };
  return {
    // Persisted selections are restored only after the live course list has
    // validated them. This prevents stale fixture IDs from reaching UUID-only
    // backend routes during the first render.
    status: 'idle', courses: [], selections: {}, error: null,
    initialize: async () => {
      if (get().status === 'loading') return;
      await load(get().status === 'ready');
    },
    refresh: () => load(false),
    select: (module, courseId) => set((state) => { const selections = { ...state.selections, [module]: courseId }; persistSelections(selections); return { selections }; }),
    selectedCourse: (module) => get().courses.find((course) => course.id === get().selections[module]) ?? null,
    createCourse: async (input) => { const course = await courseRepository.create(input); await load(); return course; },
    updateCourse: async (courseId, input) => { const course = await courseRepository.update(courseId, input); await load(); return course; },
    deleteCourse: async (courseId) => { await courseRepository.remove(courseId); await load(); },
  };
});
