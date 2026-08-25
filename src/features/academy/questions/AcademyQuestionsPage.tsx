import QuestionsPage from '@/features/admin/questions/QuestionsPage';
import { useAcademyTenantStore } from '@/app/store/useAcademyTenantStore';

export const AcademyQuestionsPage = () => {
  const academyId = useAcademyTenantStore((state) => state.activeAcademyId);
  const academyName = useAcademyTenantStore((state) => state.activeAcademy?.name);
  return <QuestionsPage scope="academy" academyId={academyId} academyName={academyName} />;
};

export default AcademyQuestionsPage;
