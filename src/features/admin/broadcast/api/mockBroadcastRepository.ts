import type { Broadcast, BroadcastInput, BroadcastStatus, BroadcastAudienceKind } from '../types/broadcast';
import { BroadcastRepositoryError, type BroadcastRepository } from './broadcastRepository';
import { apiRequest } from '@/lib/api/client';

interface BackendBroadcastDto {
  id: string;
  title: string;
  subtitle?: string | null;
  message: string;
  type: string;
  priority: string;
  status: string;
  audienceKind?: string;
  academyTargets?: Array<{ academyId: string; academy?: { id: string; name: string } }>;
  startAt?: string | null;
  endAt?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

function adaptBackendBroadcast(dto: BackendBroadcastDto): Broadcast {
  const targetAcademyIds = dto.academyTargets?.map((t) => t.academyId) || [];
  const audienceKind: BroadcastAudienceKind = targetAcademyIds.length > 0 ? 'ACADEMIES' : 'EVERYONE';

  return {
    id: dto.id,
    title: dto.title,
    subtitle: dto.subtitle || '',
    message: dto.message,
    type: (dto.type || 'ANNOUNCEMENT') as any,
    priority: (dto.priority || 'NORMAL') as any,
    status: (dto.status || 'DRAFT') as BroadcastStatus,
    disabledFrom: null,
    image: null,
    cta: { enabled: false, text: '', action: 'INTERNAL_ROUTE', destination: '' },
    audience: { kind: audienceKind, courseIds: [], packageIds: [], academyIds: targetAcademyIds },
    platform: 'APP',
    placements: ['NOTIFICATION', 'HOME'],
    startAt: dto.startAt || null,
    endAt: dto.endAt || null,
    frequency: 'ONCE',
    dismissible: true,
    presentation: 'BANNER',
    displayOrder: 'AUTOMATIC',
    acknowledgementRequired: false,
    repeatBehavior: 'NEVER',
    showInWhatsNew: false,
    timeline: [],
    analytics: { reached: 0, viewed: 0, uniqueViews: 0, clicked: 0, dismissed: 0, acknowledged: 0, ctr: 0 },
    publishedAt: dto.publishedAt || null,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

export class MockBroadcastRepository implements BroadcastRepository {
  async list(): Promise<Broadcast[]> {
    try {
      const response = await apiRequest<{ data: BackendBroadcastDto[] }>('/api/admin/broadcasts?limit=100');
      if (response && Array.isArray(response.data)) {
        return response.data.map(adaptBackendBroadcast);
      }
    } catch {
      // Unauthenticated / fallback
    }
    return [];
  }

  async createDraft(input: BroadcastInput): Promise<Broadcast> {
    try {
      const dto = await apiRequest<BackendBroadcastDto>('/api/admin/broadcasts', {
        method: 'POST',
        body: {
          title: input.title,
          subtitle: input.subtitle || undefined,
          message: input.message,
          type: input.type || 'ANNOUNCEMENT',
          priority: input.priority || 'NORMAL',
          targetAcademyIds: input.audience?.academyIds && input.audience.academyIds.length > 0 ? input.audience.academyIds : undefined,
          startAt: input.startAt || undefined,
          endAt: input.endAt || undefined,
        },
      });
      if (dto && dto.id) {
        return adaptBackendBroadcast(dto);
      }
    } catch (err) {
      if (err instanceof Error) throw new BroadcastRepositoryError('VALIDATION_ERROR', err.message);
    }
    throw new BroadcastRepositoryError('STORAGE_ERROR', 'Failed to create broadcast on backend.');
  }

  async update(broadcastId: string, input: BroadcastInput): Promise<Broadcast> {
    try {
      const dto = await apiRequest<BackendBroadcastDto>(`/api/admin/broadcasts/${encodeURIComponent(broadcastId)}`, {
        method: 'PATCH',
        body: {
          title: input.title,
          subtitle: input.subtitle || undefined,
          message: input.message,
          type: input.type,
          priority: input.priority,
          targetAcademyIds: input.audience?.academyIds,
          startAt: input.startAt || undefined,
          endAt: input.endAt || undefined,
        },
      });
      if (dto && dto.id) {
        return adaptBackendBroadcast(dto);
      }
    } catch (err) {
      if (err instanceof Error) throw new BroadcastRepositoryError('VALIDATION_ERROR', err.message);
    }
    throw new BroadcastRepositoryError('STORAGE_ERROR', 'Failed to update broadcast on backend.');
  }

  async publishNow(broadcastId: string, _input?: BroadcastInput): Promise<Broadcast> {
    try {
      const res = await apiRequest<{ updated?: BackendBroadcastDto; id?: string }>(`/api/admin/broadcasts/${encodeURIComponent(broadcastId)}/publish`, {
        method: 'POST',
      });
      const dto = res.updated || (res as unknown as BackendBroadcastDto);
      if (dto && dto.id) {
        return adaptBackendBroadcast(dto);
      }
    } catch (err) {
      if (err instanceof Error) throw new BroadcastRepositoryError('VALIDATION_ERROR', err.message);
    }
    throw new BroadcastRepositoryError('STORAGE_ERROR', 'Failed to publish broadcast on backend.');
  }

  async schedule(broadcastId: string, input: BroadcastInput): Promise<Broadcast> {
    try {
      const dto = await apiRequest<BackendBroadcastDto>(`/api/admin/broadcasts/${encodeURIComponent(broadcastId)}/schedule`, {
        method: 'POST',
        body: { startAt: input.startAt },
      });
      if (dto && dto.id) {
        return adaptBackendBroadcast(dto);
      }
    } catch (err) {
      if (err instanceof Error) throw new BroadcastRepositoryError('VALIDATION_ERROR', err.message);
    }
    throw new BroadcastRepositoryError('STORAGE_ERROR', 'Failed to schedule broadcast on backend.');
  }

  async duplicate(broadcastId: string): Promise<Broadcast> {
    const list = await this.list();
    const existing = list.find((b) => b.id === broadcastId);
    if (!existing) throw new BroadcastRepositoryError('NOT_FOUND', 'Broadcast not found.');
    return this.createDraft({
      title: `${existing.title} (Copy)`,
      subtitle: existing.subtitle,
      message: existing.message,
      type: existing.type,
      priority: existing.priority,
      image: existing.image,
      cta: existing.cta,
      audience: existing.audience,
      platform: existing.platform,
      placements: existing.placements,
      startAt: existing.startAt,
      endAt: existing.endAt,
      frequency: existing.frequency,
      presentation: existing.presentation,
      displayOrder: existing.displayOrder,
      acknowledgementRequired: existing.acknowledgementRequired,
      repeatBehavior: existing.repeatBehavior,
      dismissible: existing.dismissible,
      showInWhatsNew: existing.showInWhatsNew,
    });
  }

  async disable(broadcastId: string): Promise<Broadcast> {
    return this.updateStatus(broadcastId, 'archive');
  }

  async enable(broadcastId: string): Promise<Broadcast> {
    return this.updateStatus(broadcastId, 'restore');
  }

  async cancelSchedule(broadcastId: string): Promise<Broadcast> {
    try {
      const dto = await apiRequest<BackendBroadcastDto>(`/api/admin/broadcasts/${encodeURIComponent(broadcastId)}/cancel`, {
        method: 'POST',
      });
      if (dto && dto.id) {
        return adaptBackendBroadcast(dto);
      }
    } catch (err) {
      if (err instanceof Error) throw new BroadcastRepositoryError('VALIDATION_ERROR', err.message);
    }
    throw new BroadcastRepositoryError('STORAGE_ERROR', 'Failed to cancel broadcast on backend.');
  }

  async archive(broadcastId: string): Promise<Broadcast> {
    return this.updateStatus(broadcastId, 'archive');
  }

  async restore(broadcastId: string): Promise<Broadcast> {
    return this.updateStatus(broadcastId, 'restore');
  }

  async delete(broadcastId: string): Promise<void> {
    try {
      await apiRequest(`/api/admin/broadcasts/${encodeURIComponent(broadcastId)}/delete`, {
        method: 'POST',
      });
    } catch {
      // Ignore
    }
  }

  private async updateStatus(broadcastId: string, action: string): Promise<Broadcast> {
    try {
      const dto = await apiRequest<BackendBroadcastDto>(`/api/admin/broadcasts/${encodeURIComponent(broadcastId)}/${action}`, {
        method: 'POST',
      });
      if (dto && dto.id) {
        return adaptBackendBroadcast(dto);
      }
    } catch {
      // Ignore
    }
    throw new BroadcastRepositoryError('STORAGE_ERROR', `Failed to execute ${action} on broadcast.`);
  }
}

export const mockBroadcastRepository = new MockBroadcastRepository();
