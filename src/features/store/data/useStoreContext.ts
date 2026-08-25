import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CourseSlug } from '../types/catalog';

export type StoreCourseFilter = CourseSlug | 'all';

export interface StoreContextState {
  selectedCourseSlug: StoreCourseFilter;
  setSelectedCourseSlug: (slug: StoreCourseFilter) => void;
  initializeForStudent: (enrolledSlugs: readonly string[]) => void;
}

export const useStoreContextStore = create<StoreContextState>()(
  persist(
    (set, get) => ({
      selectedCourseSlug: 'all',
      setSelectedCourseSlug: (slug) => set({ selectedCourseSlug: slug }),
      initializeForStudent: (enrolledSlugs) => {
        const current = get().selectedCourseSlug;
        if (!enrolledSlugs.length) {
          if (current !== 'all') set({ selectedCourseSlug: 'all' });
          return;
        }
        // If single course enrolment, auto-select it
        if (enrolledSlugs.length === 1) {
          const single = enrolledSlugs[0] as StoreCourseFilter;
          if (current !== single) set({ selectedCourseSlug: single });
        } else if (current !== 'all' && !enrolledSlugs.includes(current)) {
          // If current selection is invalid for student, select first active enrolment
          set({ selectedCourseSlug: enrolledSlugs[0] as StoreCourseFilter });
        }
      },
    }),
    {
      name: 'pf_store_course_context_v1',
    },
  ),
);
