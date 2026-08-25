import { ApiError, apiRequest } from '@/lib/api/client';
import { BroadcastRepositoryError, type BroadcastRepository } from '@/features/admin/broadcast/api/broadcastRepository';
import type { Broadcast, BroadcastAudienceKind, BroadcastImage, BroadcastInput } from '@/features/admin/broadcast/types/broadcast';

const basePath = '/api/academy/broadcasts';

interface BackendBroadcastDto {
  id: string; title: string; subtitle?: string | null; message: string; type: string; priority: string; status: string;
  platform?: string; audienceKind?: string; startAt?: string | null; endAt?: string | null; publishedAt?: string | null;
  frequency?: string; dismissible?: boolean; presentation?: string; displayOrder?: string; customOrderWeight?: number;
  acknowledgementRequired?: boolean; repeatBehavior?: string; showInWhatsNew?: boolean;
  reachedCount?: number; viewedCount?: number; uniqueViewsCount?: number; clickedCount?: number; dismissedCount?: number; acknowledgedCount?: number;
  placements?: Array<{ placement: string }>; cta?: { enabled: boolean; text: string; action: string; destination: string } | null;
  image?: { name: string; mimeType: string; size: number | string } | null;
  courseTargets?: Array<{ course: { id: string; name: string } }>;
  timeline?: Array<{ actorId?: string; action: string; timestamp: string; description: string }>;
  createdAt: string; updatedAt: string;
}

const safeAudience = (dto: BackendBroadcastDto): BroadcastAudienceKind => dto.courseTargets?.length ? 'COURSES' : 'ACADEMY_STUDENTS';
const adapt = (dto: BackendBroadcastDto, image: BroadcastImage | null = null): Broadcast => ({
  id: dto.id, title: dto.title, subtitle: dto.subtitle ?? '', message: dto.message,
  type: (dto.type ?? 'ANNOUNCEMENT') as Broadcast['type'], priority: (dto.priority ?? 'NORMAL') as Broadcast['priority'], status: (dto.status ?? 'DRAFT') as Broadcast['status'], disabledFrom: null,
  image,
  cta: dto.cta ? { enabled: dto.cta.enabled, text: dto.cta.text, action: dto.cta.action as Broadcast['cta']['action'], destination: dto.cta.destination } : { enabled: false, text: '', action: 'INTERNAL_ROUTE', destination: '' },
  audience: { kind: safeAudience(dto), courseIds: dto.courseTargets?.map((target) => target.course.id) ?? [], packageIds: [], academyIds: [] },
  platform: (dto.platform ?? 'BOTH') as Broadcast['platform'], placements: (dto.placements?.map((entry) => entry.placement) ?? ['NOTIFICATION']) as Broadcast['placements'],
  startAt: dto.startAt ?? null, endAt: dto.endAt ?? null, frequency: (dto.frequency ?? 'ONCE') as Broadcast['frequency'], dismissible: dto.dismissible ?? true,
  presentation: (dto.presentation ?? 'NOTIFICATION') as Broadcast['presentation'], displayOrder: (dto.displayOrder ?? 'AUTOMATIC') as Broadcast['displayOrder'], customOrderWeight: dto.customOrderWeight ?? 50,
  acknowledgementRequired: dto.acknowledgementRequired ?? false, repeatBehavior: (dto.repeatBehavior ?? 'NEVER') as Broadcast['repeatBehavior'], showInWhatsNew: dto.showInWhatsNew ?? false,
  timeline: (dto.timeline ?? []).map((event) => ({ actor: { id: event.actorId ?? '', name: 'Academy administrator', role: 'ACADEMY_ADMIN' }, action: event.action as Broadcast['timeline'][number]['action'], timestamp: event.timestamp, description: event.description })),
  analytics: { reached: dto.reachedCount ?? 0, viewed: dto.viewedCount ?? 0, uniqueViews: dto.uniqueViewsCount ?? 0, clicked: dto.clickedCount ?? 0, dismissed: dto.dismissedCount ?? 0, acknowledged: dto.acknowledgedCount ?? 0, ctr: dto.reachedCount ? Math.round(((dto.clickedCount ?? 0) / dto.reachedCount) * 10_000) / 100 : 0 },
  createdAt: dto.createdAt, updatedAt: dto.updatedAt, publishedAt: dto.publishedAt ?? null,
});

async function hydrate(dto: BackendBroadcastDto): Promise<Broadcast> {
  if (!dto.image) return adapt(dto);
  try {
    const signed = await apiRequest<{ url: string }>(`${basePath}/${encodeURIComponent(dto.id)}/image`);
    return adapt(dto, { name: dto.image.name, mimeType: dto.image.mimeType, size: Number(dto.image.size), dataUrl: signed.url });
  } catch { return adapt(dto); }
}

const academyPayload = (input: BroadcastInput) => {
  if (!['ACADEMY_STUDENTS', 'COURSES'].includes(input.audience.kind)) throw new BroadcastRepositoryError('VALIDATION_ERROR', 'Academy broadcasts can target only this Academy or one of its courses.');
  if (input.audience.kind === 'COURSES' && input.audience.courseIds.length !== 1) throw new BroadcastRepositoryError('VALIDATION_ERROR', 'Select exactly one Academy course.');
  return {
    title: input.title, subtitle: input.subtitle || undefined, message: input.message, type: input.type, priority: input.priority,
    targetCourseId: input.audience.kind === 'COURSES' ? input.audience.courseIds[0] : null,
    startAt: input.startAt ?? undefined, endAt: input.endAt ?? undefined,
    platform: input.platform, placements: input.placements.filter((placement) => placement !== 'STORE'),
    cta: input.cta, frequency: input.frequency, dismissible: input.dismissible, presentation: input.presentation,
    displayOrder: input.displayOrder, customOrderWeight: input.customOrderWeight, acknowledgementRequired: input.acknowledgementRequired,
    repeatBehavior: input.repeatBehavior, showInWhatsNew: input.showInWhatsNew,
  };
};

async function uploadImage(broadcastId: string, image: BroadcastImage | null) {
  if (!image?.dataUrl.startsWith('data:')) return;
  const blob = await (await fetch(image.dataUrl)).blob();
  const checksumSha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const intent = await apiRequest<{ uploadId: string; uploadUrl: string; headers: Record<string, string> }>(`${basePath}/${encodeURIComponent(broadcastId)}/image/upload-intent`, {
    method: 'POST', body: { fileName: image.name, mimeType: image.mimeType, sizeBytes: blob.size, checksumSha256 },
  });
  const response = await fetch(intent.uploadUrl, { method: 'PUT', headers: intent.headers, body: blob });
  if (!response.ok) throw new BroadcastRepositoryError('STORAGE_ERROR', 'The broadcast image could not be uploaded.');
  await apiRequest(`${basePath}/${encodeURIComponent(broadcastId)}/image`, { method: 'POST', body: { uploadId: intent.uploadId } });
}

async function detail(id: string) { return hydrate(await apiRequest<BackendBroadcastDto>(`${basePath}/${encodeURIComponent(id)}`)); }

export const academyBroadcastRepository: BroadcastRepository = {
  async list() {
    const response = await apiRequest<{ data: BackendBroadcastDto[] }>(`${basePath}?limit=100`);
    return Promise.all(response.data.map(hydrate));
  },
  async createDraft(input) {
    const created = await apiRequest<BackendBroadcastDto>(basePath, { method: 'POST', body: academyPayload(input) });
    await uploadImage(created.id, input.image);
    return detail(created.id);
  },
  async update(id, input) {
    await apiRequest(`${basePath}/${encodeURIComponent(id)}`, { method: 'PATCH', body: academyPayload(input) });
    if (input.image) await uploadImage(id, input.image);
    else {
      try { await apiRequest(`${basePath}/${encodeURIComponent(id)}/image`, { method: 'DELETE' }); }
      catch (error) { if (!(error instanceof ApiError) || error.code !== 'BROADCAST_IMAGE_NOT_FOUND') throw error; }
    }
    return detail(id);
  },
  async publishNow(id) { await apiRequest(`${basePath}/${encodeURIComponent(id)}/publish`, { method: 'POST' }); return detail(id); },
  async schedule(id, input) { await apiRequest(`${basePath}/${encodeURIComponent(id)}/schedule`, { method: 'POST', body: { startAt: input.startAt } }); return detail(id); },
  async duplicate(id) {
    const source = await detail(id);
    return this.createDraft({ ...source, title: `${source.title} (Copy)`, startAt: null, endAt: null, image: null });
  },
  async disable(id) { await apiRequest(`${basePath}/${encodeURIComponent(id)}/archive`, { method: 'POST' }); return detail(id); },
  async enable(id) { await apiRequest(`${basePath}/${encodeURIComponent(id)}/restore`, { method: 'POST' }); return detail(id); },
  async cancelSchedule(id) { await apiRequest(`${basePath}/${encodeURIComponent(id)}/cancel`, { method: 'POST' }); return detail(id); },
  async archive(id) { await apiRequest(`${basePath}/${encodeURIComponent(id)}/archive`, { method: 'POST' }); return detail(id); },
  async restore(id) { await apiRequest(`${basePath}/${encodeURIComponent(id)}/restore`, { method: 'POST' }); return detail(id); },
  async delete(id) { await apiRequest(`${basePath}/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
};
