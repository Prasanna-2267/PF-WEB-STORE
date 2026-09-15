import { AppSelect } from '@/components/ui/AppSelect';
import { useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useCourseStore, type CourseModule } from '@/app/store/useCourseStore';
import './courses/courses.css';

export const CourseSelector = ({
  module,
  onBeforeChange,
}: {
  module: CourseModule;
  onBeforeChange?: (nextCourseId: string) => boolean | Promise<boolean>;
}) => {
  const initialize = useCourseStore((state) => state.initialize);
  const status = useCourseStore((state) => state.status);
  const courses = useCourseStore((state) => state.courses);
  const selectedId = useCourseStore((state) => state.selections[module] ?? '');
  const select = useCourseStore((state) => state.select);
  useEffect(() => { void initialize(); }, [initialize]);
  const activeCourses = courses.filter((course) => course.status === 'ACTIVE');

  const handleChange = async (nextId: string) => {
    if (onBeforeChange) {
      const allowed = await onBeforeChange(nextId);
      if (!allowed) return;
    }
    await select(module, nextId);
  };

  return (
    <label className="pf-admin-course-selector">
      <span>Choose course</span>
      <div>
        <AppSelect
          value={selectedId}
          disabled={status === 'loading' || !activeCourses.length}
          onChange={(event) => void handleChange(event.target.value)}
          aria-label="Choose course"
        >
          <option value="">{activeCourses.length ? 'Choose course' : 'No courses available'}</option>
          {activeCourses.map((course) => (
            <option key={course.id} value={course.id}>{course.code} — {course.name}</option>
          ))}
        </AppSelect>
        <ChevronDown size={16} aria-hidden="true" />
      </div>
    </label>
  );
};
