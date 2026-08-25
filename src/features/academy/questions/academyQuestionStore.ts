import { createQuestionStore } from '@/app/store/useQuestionStore';
import { academyQuestionRepository } from './academyQuestionRepository';
import { academyTaxonomyRepository } from './academyTaxonomyRepository';

export const useAcademyQuestionStore = createQuestionStore(academyQuestionRepository, academyTaxonomyRepository);

