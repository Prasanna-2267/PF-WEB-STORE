import { create } from 'zustand';
import { mockAcademyRepository } from '@/features/admin/academies/api/mockAcademyRepository';
import type { AcademyRepository } from '@/features/admin/academies/api/academyRepository';
import type { Academy, AcademyInput, AcademyStatus } from '@/features/admin/academies/types/academy';

interface AcademyState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  academies: Academy[];
  selectedAcademy: Academy | null;
  selectedStatus: 'idle' | 'loading' | 'ready' | 'error';
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  getAcademy: (academyId: string) => Promise<Academy>;
  createAcademy: (input: AcademyInput) => Promise<Academy>;
  updateAcademy: (academyId: string, input: AcademyInput) => Promise<Academy>;
  updateAcademyStatus: (academyId: string, status: AcademyStatus) => Promise<Academy>;
  clearSelectedAcademy: () => void;
}

export const createAcademyStore = (repository: AcademyRepository = mockAcademyRepository) => create<AcademyState>((set, get) => {
  const load = async () => {
    set({ status: 'loading', error: null });
    try { set({ academies: await repository.list(), status: 'ready' }); }
    catch (error) { set({ status: 'error', error: error instanceof Error ? error.message : 'Academies could not be loaded.' }); }
  };
  const replace = (updated: Academy) => set((state) => ({
    academies: state.academies.map((academy) => academy.id === updated.id ? updated : academy),
    selectedAcademy: state.selectedAcademy?.id === updated.id ? updated : state.selectedAcademy,
  }));

  return {
    status: 'idle', error: null, academies: [], selectedAcademy: null, selectedStatus: 'idle',
    initialize: async () => { if (get().status === 'idle') await load(); },
    refresh: load,
    getAcademy: async (academyId) => {
      set({ selectedStatus: 'loading', error: null });
      try { const academy = await repository.get(academyId); set({ selectedAcademy: academy, selectedStatus: 'ready' }); return academy; }
      catch (error) { set({ selectedAcademy: null, selectedStatus: 'error', error: error instanceof Error ? error.message : 'Academy could not be loaded.' }); throw error; }
    },
    createAcademy: async (input) => { const academy = await repository.create(input); set((state) => ({ academies: [academy, ...state.academies] })); return academy; },
    updateAcademy: async (academyId, input) => { const academy = await repository.update(academyId, input); replace(academy); return academy; },
    updateAcademyStatus: async (academyId, status) => { const academy = await repository.updateStatus(academyId, status); replace(academy); return academy; },
    clearSelectedAcademy: () => set({ selectedAcademy: null, selectedStatus: 'idle' }),
  };
});

export const useAcademyStore = createAcademyStore();
