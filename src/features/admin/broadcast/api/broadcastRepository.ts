import type { Broadcast, BroadcastInput } from '../types/broadcast';

export type BroadcastRepositoryErrorCode = 'NOT_FOUND' | 'INVALID_TRANSITION' | 'VALIDATION_ERROR' | 'STORAGE_ERROR';

export class BroadcastRepositoryError extends Error {
  readonly code: BroadcastRepositoryErrorCode;

  constructor(code: BroadcastRepositoryErrorCode, message: string) {
    super(message);
    this.name = 'BroadcastRepositoryError';
    this.code = code;
  }
}

export interface BroadcastRepository {
  list(): Promise<Broadcast[]>;
  createDraft(input: BroadcastInput): Promise<Broadcast>;
  update(broadcastId: string, input: BroadcastInput): Promise<Broadcast>;
  publishNow(broadcastId: string, input?: BroadcastInput): Promise<Broadcast>;
  schedule(broadcastId: string, input: BroadcastInput): Promise<Broadcast>;
  duplicate(broadcastId: string): Promise<Broadcast>;
  disable(broadcastId: string): Promise<Broadcast>;
  enable(broadcastId: string): Promise<Broadcast>;
  cancelSchedule(broadcastId: string): Promise<Broadcast>;
  archive(broadcastId: string): Promise<Broadcast>;
  restore(broadcastId: string): Promise<Broadcast>;
  delete(broadcastId: string): Promise<void>;
}
