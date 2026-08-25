import { create } from 'zustand';
import { mockPackageRepository } from '@/features/admin/packages/api/mockPackageRepository';
import type { PackageRepository } from '@/features/admin/packages/api/packageRepository';
import type { LearningPackage, PackageInput } from '@/features/admin/packages/types/package';

interface PackageState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  packages: LearningPackage[];
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  createPackage: (input: PackageInput) => Promise<LearningPackage>;
  updatePackage: (packageId: string, input: PackageInput) => Promise<LearningPackage>;
  deletePackage: (packageId: string) => Promise<void>;
}

export const createPackageStore = (repository: PackageRepository = mockPackageRepository) => create<PackageState>((set, get) => {
  const load = async () => {
    set({ status: 'loading', error: null });
    try {
      set({ packages: await repository.list(), status: 'ready' });
    } catch (error) {
      set({ status: 'error', error: error instanceof Error ? error.message : 'Packages could not be loaded.' });
    }
  };

  return {
    status: 'idle',
    error: null,
    packages: [],
    initialize: async () => { if (get().status === 'idle') await load(); },
    refresh: load,
    createPackage: async (input) => {
      const created = await repository.create(input);
      set((state) => ({ packages: [created, ...state.packages] }));
      return created;
    },
    updatePackage: async (packageId, input) => {
      const updated = await repository.update(packageId, input);
      set((state) => ({ packages: state.packages.map((item) => item.id === packageId ? updated : item) }));
      return updated;
    },
    deletePackage: async (packageId) => {
      await repository.delete(packageId);
      set((state) => ({ packages: state.packages.filter((item) => item.id !== packageId) }));
    },
  };
});

export const usePackageStore = createPackageStore();
