import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAcademyTenantStore } from '@/app/store/useAcademyTenantStore';
import { createBroadcastStore } from '@/app/store/useBroadcastStore';
import { fetchAcademyCourses } from '@/features/academy/readOnly/academyReadOnlyApi';
import { academyBroadcastRepository } from './academyBroadcastRepository';
import { BroadcastPage } from '@/features/admin/broadcast/BroadcastPage';
import type { AdminCourse } from '@/features/admin/types/admin';

const AcademyBroadcastWorkspace = ({ academyId, academyName }: { academyId: string; academyName?: string }) => {
  const [useScopedBroadcastStore] = useState(() => createBroadcastStore(academyBroadcastRepository));
  const store = useScopedBroadcastStore();
  const coursesQuery = useQuery({
    queryKey: ['academy', academyId, 'broadcast-courses'],
    queryFn: ({ signal }) => fetchAcademyCourses({ page: 1, limit: 100, includeArchived: false }, signal),
  });
  const courses: AdminCourse[] = (coursesQuery.data?.items ?? []).filter((course) => course.status !== 'ARCHIVED').map((course) => ({
    id: course.id,
    slug: course.code.toLocaleLowerCase(),
    code: course.code,
    name: course.name,
    description: course.description,
    status: course.status,
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
  }));
  return <BroadcastPage scope="academy" academyId={academyId} academyName={academyName} storeOverride={store} academyCourses={courses} />;
};

export const AcademyBroadcastPage = () => {
  const academyId = useAcademyTenantStore((state) => state.activeAcademyId);
  const academyName = useAcademyTenantStore((state) => state.activeAcademy?.name);
  if (!academyId) return null;
  return <AcademyBroadcastWorkspace key={academyId} academyId={academyId} academyName={academyName} />;
};

export default AcademyBroadcastPage;
