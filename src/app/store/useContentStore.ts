import { create } from 'zustand';
import { mockContentRepository } from '@/features/admin/content/api/mockContentRepository';
import type { ContentRepository } from '@/features/admin/content/api/contentRepository';
import type {
  ContentBreadcrumb,
  ContentItem,
  ContentPublishInput,
  ContentSearchResult,
  ContentSort,
  ContentUploadTask,
  ContentViewMode,
} from '@/features/admin/content/types/content';

const VIEW_KEY = 'pf_admin_content_view';
const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const taskId = () => `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

interface NavigateOptions {
  history?: 'push' | 'replace' | 'back' | 'forward';
}

interface ContentState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  courseId: string | null;
  currentFolderId: string | null;
  items: ContentItem[];
  breadcrumbs: ContentBreadcrumb[];
  pageHeading: string;
  backStack: Array<string | null>;
  forwardStack: Array<string | null>;
  sort: ContentSort;
  view: ContentViewMode;
  uploads: ContentUploadTask[];
  initialize: () => Promise<void>;
  setCourse: (courseId: string) => Promise<void>;
  navigate: (folderId: string | null, options?: NavigateOptions) => Promise<void>;
  goBack: () => Promise<void>;
  goForward: () => Promise<void>;
  refresh: () => Promise<void>;
  setSort: (sort: ContentSort) => void;
  setPageHeading: (pageHeading: string) => Promise<void>;
  saveChildOrder: (childOrder: string[]) => Promise<void>;
  setView: (view: ContentViewMode) => void;
  search: (query: string) => Promise<ContentSearchResult[]>;
  getFolders: () => Promise<ContentItem[]>;
  createFolder: (name: string) => Promise<ContentItem>;
  uploadFiles: (files: File[], parentId?: string | null) => Promise<void>;
  uploadFolder: (files: File[]) => Promise<void>;
  publishContent: (input: Omit<ContentPublishInput, 'courseId' | 'destinationId'> & { destinationId?: string | null }) => Promise<ContentItem[]>;
  renameItem: (itemId: string, name: string) => Promise<ContentItem>;
  deleteItems: (itemIds: string[]) => Promise<void>;
  copyItems: (itemIds: string[], destinationId: string | null) => Promise<void>;
  moveItems: (itemIds: string[], destinationId: string | null) => Promise<void>;
  updateDescription: (itemId: string, description: string) => Promise<ContentItem>;
  updateAccessType: (
    itemId: string,
    accessType: 'FREE' | 'PAID',
    price?: number | null,
    applyToChildren?: boolean,
    description?: string,
    sampleImages?: import('@/features/admin/content/types/content').ContentSampleImage[],
    storeSections?: import('@/features/admin/content/types/content').ContentStoreSection[],
    accessDurationValue?: number | null,
    accessDurationUnit?: import('@/features/admin/content/types/content').AccessDurationUnit | null
  ) => Promise<ContentItem>;
  markOpened: (itemId: string) => Promise<void>;
  clearCompletedUploads: () => void;
}

const initialView = (): ContentViewMode => {
  if (typeof window === 'undefined') return 'list';
  return window.localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'list';
};

export const createContentStore = (repository: ContentRepository = mockContentRepository) => create<ContentState>((set, get) => {
  let request = 0;

  const load = async (folderId: string | null, options: NavigateOptions = {}) => {
    const requestId = ++request;
    const previous = get().currentFolderId;
    set({ status: 'loading', error: null });
    try {
      const courseId = get().courseId;
      const [items, breadcrumbs, location] = await Promise.all([
        repository.getChildren(folderId, get().courseId ?? undefined),
        repository.getBreadcrumb(folderId, get().courseId ?? undefined),
        courseId ? repository.getLocationSettings(courseId, folderId) : Promise.resolve(null),
      ]);
      if (requestId !== request) return;
      const next: Partial<ContentState> = {
        currentFolderId: folderId,
        items,
        breadcrumbs,
        pageHeading: location?.pageHeading ?? 'Untitled Page',
        status: 'ready',
      };
      if (options.history === 'push' && previous !== folderId) {
        next.backStack = [...get().backStack, previous];
        next.forwardStack = [];
      }
      set(next);
    } catch (error) {
      if (requestId !== request) return;
      set({ status: 'error', error: error instanceof Error ? error.message : 'Content could not be loaded.' });
    }
  };

  const refresh = async () => load(get().currentFolderId, { history: 'replace' });

  const scheduleClear = (id: string) => {
    window.setTimeout(() => {
      set((state) => ({ uploads: state.uploads.filter((t) => t.id !== id) }));
    }, 6000);
  };

  const uploadOne = async (file: File, parentId: string | null) => {
    const id = taskId();
    set((state) => ({ uploads: [...state.uploads, { id, name: file.name, progress: 8, status: 'uploading' }] }));
    const progress = (value: number) => set((state) => ({
      uploads: state.uploads.map((task) => task.id === id ? { ...task, progress: value } : task),
    }));
    try {
      await wait(45);
      progress(38);
      await wait(55);
      progress(72);
      const courseId = get().courseId;
      if (!courseId) throw new Error('Choose a course before uploading content.');
      await repository.uploadFile(parentId, {
        courseId,
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        sourceFile: file,
      });
      set((state) => ({
        uploads: state.uploads.map((task) => task.id === id ? { ...task, progress: 100, status: 'complete' } : task),
      }));
      scheduleClear(id);
    } catch (error) {
      set((state) => ({
        uploads: state.uploads.map((task) => task.id === id ? {
          ...task,
          status: 'error',
          error: error instanceof Error ? error.message : 'Upload failed.',
        } : task),
      }));
      scheduleClear(id);
      throw error;
    }
  };

  return {
    status: 'idle',
    error: null,
    courseId: null,
    currentFolderId: null,
    items: [],
    breadcrumbs: [{ id: null, name: 'My Flow' }],
    pageHeading: 'Untitled Page',
    backStack: [],
    forwardStack: [],
    sort: { field: 'manual', direction: 'asc' },
    view: initialView(),
    uploads: [],
    initialize: async () => {
      if (get().status === 'idle') await load(null, { history: 'replace' });
    },
    setCourse: async (courseId) => {
      if (get().courseId === courseId && get().status !== 'idle') return;
      set({ courseId, currentFolderId: null, items: [], breadcrumbs: [{ id: null, name: 'My Flow' }], pageHeading: 'Untitled Page', backStack: [], forwardStack: [] });
      await load(null, { history: 'replace' });
    },
    navigate: load,
    goBack: async () => {
      const stack = [...get().backStack];
      if (!stack.length) return;
      const destination = stack.pop() ?? null;
      const current = get().currentFolderId;
      set({ backStack: stack, forwardStack: [current, ...get().forwardStack] });
      await load(destination, { history: 'back' });
    },
    goForward: async () => {
      const stack = [...get().forwardStack];
      if (!stack.length) return;
      const destination = stack.shift() ?? null;
      const current = get().currentFolderId;
      set({ forwardStack: stack, backStack: [...get().backStack, current] });
      await load(destination, { history: 'forward' });
    },
    refresh,
    setSort: (sort) => set({ sort }),
    setPageHeading: async (pageHeading) => {
      const courseId = get().courseId;
      if (!courseId) throw new Error('Choose a course before updating this page.');
      const location = await repository.updatePageHeading(courseId, get().currentFolderId, pageHeading);
      set({ pageHeading: location.pageHeading });
    },
    saveChildOrder: async (childOrder) => {
      const courseId = get().courseId;
      if (!courseId) throw new Error('Choose a course before ordering content.');
      await repository.saveChildOrder(courseId, get().currentFolderId, childOrder);
      set({ sort: { field: 'manual', direction: 'asc' } });
      await refresh();
    },
    setView: (view) => {
      window.localStorage.setItem(VIEW_KEY, view);
      set({ view });
    },
    search: (query) => repository.searchItems(query, get().courseId ?? undefined),
    getFolders: () => repository.getFolders(get().courseId ?? undefined),
    createFolder: async (name) => {
      const courseId = get().courseId;
      if (!courseId) throw new Error('Choose a course before creating content.');
      const item = await repository.createFolder({ name, parentId: get().currentFolderId, courseId });
      await refresh();
      return item;
    },
    uploadFiles: async (files, parentId = get().currentFolderId) => {
      const results = await Promise.allSettled(files.map((file) => uploadOne(file, parentId)));
      if (parentId === get().currentFolderId) await refresh();
      const rejected = results.find((result) => result.status === 'rejected');
      if (rejected?.status === 'rejected') throw rejected.reason;
    },
    uploadFolder: async (files) => {
      const rootParent = get().currentFolderId;
      const folderCache = new Map<string, string | null>([['', rootParent]]);
      const sortedFiles = [...files].sort((a, b) => a.webkitRelativePath.localeCompare(b.webkitRelativePath));
      for (const file of sortedFiles) {
        const parts = (file.webkitRelativePath || file.name).split('/').filter(Boolean);
        const folders = parts.slice(0, -1);
        let key = '';
        let parentId = rootParent;
        for (const folderName of folders) {
          const nextKey = key ? `${key}/${folderName}` : folderName;
          if (!folderCache.has(nextKey)) {
            const siblings = await repository.getChildren(parentId, get().courseId ?? undefined);
            const existing = siblings.find((item) => item.kind === 'folder' && item.name.localeCompare(folderName, undefined, { sensitivity: 'accent' }) === 0);
            const courseId = get().courseId;
            if (!courseId) throw new Error('Choose a course before uploading content.');
            const folder = existing ?? await repository.createFolder({ name: folderName, parentId, courseId });
            folderCache.set(nextKey, folder.id);
          }
          parentId = folderCache.get(nextKey) ?? rootParent;
          key = nextKey;
        }
        await uploadOne(file, parentId);
      }
      await refresh();
    },
    publishContent: async (input) => {
      const courseId = get().courseId;
      if (!courseId) throw new Error('Choose a course before publishing content.');
      const files = input.entries.filter((entry) => entry.kind === 'file');
      const id = taskId();
      const taskName = files.length === 1 ? files[0].name : `${files.length} files`;
      set((state) => ({ uploads: [...state.uploads, { id, name: taskName, progress: 5, status: 'preparing' }] }));
      const updateTask = (progress: number, status: ContentUploadTask['status'], error?: string) => set((state) => ({
        uploads: state.uploads.map((task) => task.id === id ? { ...task, progress, status, error } : task),
      }));
      try {
        await wait(90);
        updateTask(28, 'uploading');
        await wait(120);
        updateTask(68, 'uploading');
        await wait(90);
        updateTask(86, 'publishing');
        const published = await repository.publishContent({
          ...input,
          courseId,
          destinationId: input.destinationId ?? get().currentFolderId,
        });
        updateTask(100, 'complete');
        scheduleClear(id);
        await refresh();
        return published;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Publishing failed.';
        updateTask(100, 'error', message);
        scheduleClear(id);
        throw error;
      }
    },
    renameItem: async (itemId, name) => {
      const item = await repository.renameItem(itemId, name);
      await refresh();
      return item;
    },
    deleteItems: async (itemIds) => {
      await repository.deleteItems(itemIds);
      await refresh();
    },
    copyItems: async (itemIds, destinationId) => {
      await repository.copyItems(itemIds, destinationId);
      await refresh();
    },
    moveItems: async (itemIds, destinationId) => {
      await repository.moveItems(itemIds, destinationId);
      await refresh();
    },
    updateDescription: async (itemId, description) => {
      const item = await repository.updateDescription(itemId, description);
      await refresh();
      return item;
    },
    updateAccessType: async (itemId, accessType, price, applyToChildren, description, sampleImages, storeSections, accessDurationValue, accessDurationUnit) => {
      const item = await repository.updateAccessType(itemId, accessType, price, applyToChildren, description, sampleImages, storeSections, accessDurationValue, accessDurationUnit);
      await refresh();
      return item;
    },
    markOpened: (itemId) => repository.markOpened(itemId),
    clearCompletedUploads: () => set((state) => ({ uploads: state.uploads.filter((task) => task.status !== 'complete') })),
  };
});

export const useContentStore = createContentStore();
export { mockContentRepository as contentRepository };
