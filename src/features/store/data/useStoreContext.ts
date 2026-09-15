import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CourseSlug } from '../types/catalog';

export type StoreCourseFilter = CourseSlug | 'all';

export interface StoreContextState {
  selectedCourseSlug: StoreCourseFilter;
  setSelectedCourseSlug: (slug: StoreCourseFilter) => void;
  initializeForStudent: (enrolledSlugs: readonly string[]) => void;
}

export const resolveStoreCourseSelection = (
  current: StoreCourseFilter,
  enrolledSlugs: readonly string[],
): StoreCourseFilter => {
  if (!enrolledSlugs.length) return 'all';
  if (enrolledSlugs.includes(current)) return current;
  return enrolledSlugs[0] as StoreCourseFilter;
};

export const useStoreContextStore = create<StoreContextState>()(
  persist(
    (set, get) => ({
      selectedCourseSlug: 'all',
      setSelectedCourseSlug: (slug) => set({ selectedCourseSlug: slug }),
      initializeForStudent: (enrolledSlugs) => {
        const current = get().selectedCourseSlug;
        const next = resolveStoreCourseSelection(current, enrolledSlugs);
        if (current !== next) set({ selectedCourseSlug: next });
      },
    }),
    {
      name: 'pf_store_course_context_v1',
    },
  ),
);
