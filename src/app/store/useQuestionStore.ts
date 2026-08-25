import { create } from 'zustand';
import { questionRepository } from '@/features/admin/questions/api/questionRepository';
import { taxonomyRepository } from '@/features/admin/questions/api/taxonomyRepository';
import type { QuestionRecord, QuestionStatus, QuestionTaxonomy, TaxonomyLevel } from '@/features/admin/questions/types/question';

export interface QuestionState {
  scopeKey: string;
  questions: QuestionRecord[];
  taxonomy: QuestionTaxonomy | null;
  loading: boolean;
  error: string | null;
  initialize: (scopeKey?: string) => Promise<void>;
  refresh: (scopeKey?: string) => Promise<void>;
  save: (question: QuestionRecord) => Promise<QuestionRecord>;
  saveMany: (questions: QuestionRecord[]) => Promise<QuestionRecord[]>;
  duplicate: (id: string) => Promise<QuestionRecord>;
  trash: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
  permanentDelete: (id: string) => Promise<void>;
  setStatus: (id: string, status: QuestionStatus) => Promise<QuestionRecord>;
  createTaxonomy: (level: TaxonomyLevel, parentId: string, name: string) => Promise<void>;
}

export interface QuestionDataRepository {
  list(includeDeleted?: boolean): Promise<QuestionRecord[]>;
  save(question: QuestionRecord): Promise<QuestionRecord>;
  saveMany(questions: QuestionRecord[]): Promise<QuestionRecord[]>;
  duplicate(id: string): Promise<QuestionRecord>;
  moveToTrash(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  permanentDelete(id: string): Promise<void>;
  setStatus(id: string, status: QuestionStatus): Promise<QuestionRecord>;
}

export interface QuestionTaxonomyRepository {
  getAll(): Promise<QuestionTaxonomy>;
  create(level: TaxonomyLevel, parentId: string, name: string): Promise<QuestionTaxonomy>;
}

const messageFor = (error: unknown) => error instanceof Error ? error.message : 'The question workspace could not be updated.';

export const createQuestionStore = (
  questionsRepository: QuestionDataRepository = questionRepository,
  questionTaxonomyRepository: QuestionTaxonomyRepository = taxonomyRepository,
) => create<QuestionState>((set, get) => ({
  scopeKey: '', questions: [], taxonomy: null, loading: false, error: null,
  initialize: async (scopeKey = 'platform') => {
    if (get().scopeKey === scopeKey && (get().taxonomy || get().loading)) return;
    set({ scopeKey, questions: [], taxonomy: null, loading: true, error: null });
    try {
      const [questions, taxonomy] = await Promise.all([questionsRepository.list(true), questionTaxonomyRepository.getAll()]);
      set({ questions, taxonomy, loading: false });
    } catch (error) { set({ error: messageFor(error), loading: false }); }
  },
  refresh: async (scopeKey = get().scopeKey || 'platform') => {
    set({ scopeKey, loading: true, error: null });
    try {
      const [questions, taxonomy] = await Promise.all([questionsRepository.list(true), questionTaxonomyRepository.getAll()]);
      set({ questions, taxonomy, loading: false });
    } catch (error) { set({ error: messageFor(error), loading: false }); throw error; }
  },
  save: async (question) => {
    const saved = await questionsRepository.save(question);
    set((state) => ({ questions: [saved, ...state.questions.filter((entry) => entry.id !== saved.id)], error: null }));
    return saved;
  },
  saveMany: async (records) => {
    const saved = await questionsRepository.saveMany(records);
    await get().refresh();
    return saved;
  },
  duplicate: async (id) => { const copy = await questionsRepository.duplicate(id); set((state) => ({ questions: [copy, ...state.questions] })); return copy; },
  trash: async (id) => { await questionsRepository.moveToTrash(id); await get().refresh(); },
  restore: async (id) => { await questionsRepository.restore(id); await get().refresh(); },
  permanentDelete: async (id) => { await questionsRepository.permanentDelete(id); set((state) => ({ questions: state.questions.filter((entry) => entry.id !== id) })); },
  setStatus: async (id, status) => { const saved = await questionsRepository.setStatus(id, status); set((state) => ({ questions: state.questions.map((entry) => entry.id === id ? saved : entry) })); return saved; },
  createTaxonomy: async (level, parentId, name) => {
    const taxonomy = await questionTaxonomyRepository.create(level, parentId, name);
    set({ taxonomy });
  },
}));

export const useQuestionStore = createQuestionStore();
