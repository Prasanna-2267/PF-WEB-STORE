export interface CourseIdentity {
  id?: string | null;
  slug?: string | null;
  code?: string | null;
  name?: string | null;
  shortName?: string | null;
}

export interface ProductCourseIdentity {
  course?: string | null;
  courseId?: string | null;
}

export const normalizeCourseKey = (value: unknown): string => {
  if (typeof value !== 'string') return '';

  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[\u2018\u2019']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export const courseIdentityKeys = (course?: CourseIdentity | null): string[] =>
  Array.from(
    new Set(
      [course?.id, course?.slug, course?.code, course?.name, course?.shortName]
        .map(normalizeCourseKey)
        .filter(Boolean),
    ),
  );

export const findCourseByIdentity = <T extends CourseIdentity>(
  courses: readonly T[],
  key?: string | null,
): T | undefined => {
  const normalizedKey = normalizeCourseKey(key);
  if (!normalizedKey) return undefined;
  return courses.find((course) => courseIdentityKeys(course).includes(normalizedKey));
};

export const productMatchesCourse = (
  product: ProductCourseIdentity,
  course: CourseIdentity,
): boolean => {
  const courseKeys = new Set(courseIdentityKeys(course));
  return [product.course, product.courseId]
    .map(normalizeCourseKey)
    .some((key) => Boolean(key) && courseKeys.has(key));
};

export const preferredCourseKey = (course?: CourseIdentity | null): string =>
  course?.slug?.trim() || course?.id?.trim() || normalizeCourseKey(course?.code || course?.name);
