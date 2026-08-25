import { create } from 'zustand';
import { BroadcastRepositoryError, type BroadcastRepository } from '@/features/admin/broadcast/api/broadcastRepository';
import { mockBroadcastRepository } from '@/features/admin/broadcast/api/mockBroadcastRepository';
import type { Broadcast, BroadcastInput } from '@/features/admin/broadcast/types/broadcast';

export interface BroadcastState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  broadcasts: Broadcast[];
  pendingId: string | null;
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  createDraft: (input: BroadcastInput) => Promise<Broadcast>;
  updateBroadcast: (id: string, input: BroadcastInput) => Promise<Broadcast>;
  publishNow: (id: string, input?: BroadcastInput) => Promise<Broadcast>;
  scheduleBroadcast: (id: string, input: BroadcastInput) => Promise<Broadcast>;
  duplicateBroadcast: (id: string) => Promise<Broadcast>;
  disableBroadcast: (id: string) => Promise<Broadcast>;
  enableBroadcast: (id: string) => Promise<Broadcast>;
  cancelSchedule: (id: string) => Promise<Broadcast>;
  archiveBroadcast: (id: string) => Promise<Broadcast>;
  restoreBroadcast: (id: string) => Promise<Broadcast>;
  deleteBroadcast: (id: string) => Promise<void>;
}

const messageFor = (error: unknown, fallback: string) => error instanceof BroadcastRepositoryError || error instanceof Error ? error.message : fallback;

export const createBroadcastStore = (repository: BroadcastRepository = mockBroadcastRepository) => create<BroadcastState>((set, get) => {
  let requestId = 0;
  const load = async () => {
    const current = ++requestId; set({ status: 'loading', error: null });
    try { const broadcasts = await repository.list(); if (current === requestId) set({ broadcasts, status: 'ready', error: null }); }
    catch (error) { if (current === requestId) set({ status: 'error', error: messageFor(error, 'Broadcasts could not be loaded.') }); }
  };
  const replace = (updated: Broadcast) => set((state) => ({ broadcasts: state.broadcasts.map((item) => item.id === updated.id ? updated : item), pendingId: null }));
  const mutate = async (id: string, operation: () => Promise<Broadcast>, fallback: string) => {
    set({ pendingId: id });
    try { const updated = await operation(); replace(updated); return updated; }
    catch (error) { set({ pendingId: null }); throw new Error(messageFor(error, fallback)); }
  };
  return {
    status: 'idle', error: null, broadcasts: [], pendingId: null,
    initialize: async () => { if (get().status === 'idle') await load(); }, refresh: load,
    createDraft: async (input) => { set({ pendingId: 'create' }); try { const created = await repository.createDraft(input); set((state) => ({ broadcasts: [created, ...state.broadcasts], pendingId: null })); return created; } catch (error) { set({ pendingId: null }); throw new Error(messageFor(error, 'The draft could not be saved.')); } },
    updateBroadcast: (id, input) => mutate(id, () => repository.update(id, input), 'The broadcast could not be updated.'),
    publishNow: (id, input) => mutate(id, () => repository.publishNow(id, input), 'The broadcast could not be published.'),
    scheduleBroadcast: (id, input) => mutate(id, () => repository.schedule(id, input), 'The broadcast could not be scheduled.'),
    duplicateBroadcast: async (id) => { set({ pendingId: id }); try { const created = await repository.duplicate(id); set((state) => ({ broadcasts: [created, ...state.broadcasts], pendingId: null })); return created; } catch (error) { set({ pendingId: null }); throw new Error(messageFor(error, 'The broadcast could not be duplicated.')); } },
    disableBroadcast: (id) => mutate(id, () => repository.disable(id), 'The broadcast could not be disabled.'),
    enableBroadcast: (id) => mutate(id, () => repository.enable(id), 'The broadcast could not be enabled.'),
    cancelSchedule: (id) => mutate(id, () => repository.cancelSchedule(id), 'The schedule could not be cancelled.'),
    archiveBroadcast: (id) => mutate(id, () => repository.archive(id), 'The broadcast could not be archived.'),
    restoreBroadcast: (id) => mutate(id, () => repository.restore(id), 'The broadcast could not be restored.'),
    deleteBroadcast: async (id) => { set({ pendingId: id }); try { await repository.delete(id); set((state) => ({ broadcasts: state.broadcasts.filter((item) => item.id !== id), pendingId: null })); } catch (error) { set({ pendingId: null }); throw new Error(messageFor(error, 'The broadcast could not be deleted.')); } },
  };
});

export const useBroadcastStore = createBroadcastStore();
