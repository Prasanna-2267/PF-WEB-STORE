import { AppSelect } from '@/components/ui/AppSelect';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDownAZ,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  Check,
  CheckSquare,
  ChevronDown,
  ClipboardCopy,
  Copy,
  File as FileIcon,
  FileArchive,
  FileImage,
  FileText,
  FileVideo,
  Filter,
  Folder,
  FolderInput,
  FolderOpen,
  Grid2X2,
  HardDrive,
  Info,
  List,
  Lock,
  MoreVertical,
  Move,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
  ShoppingBag,
  CheckCircle2,
  LockKeyhole,
  ImagePlus,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Undo2,
  Redo2,
  Link2,
} from 'lucide-react';
import { useContentStore, contentRepository } from '@/app/store/useContentStore';
import { useCourseStore } from '@/app/store/useCourseStore';
import { apiRequest } from '@/lib/api/client';
import type {
  ContentFileCategory,
  ContentFolderSummary,
  ContentItem,
  ContentSampleImage,
  ContentSearchResult,
  ContentSortField,
  ContentStoreSection,
  AccessDurationUnit,
} from './types/content';
import { AdminDialog, AdminEmptyState, AdminPageHeader, AdminSkeleton, AdminToast, type AdminToastData } from '../AdminUi';
import { CourseSelector } from '../CourseSelector';
import { ContentPublishingWorkflow } from './ContentPublishingWorkflow';
import { ContentAttachedLinksDialog } from './ContentAttachedLinksDialog';
import './content.css';

const ease = [0.22, 1, 0.36, 1] as const;
const acceptedFiles = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.mp4,.webm,.zip';

const formatBytes = (bytes: number): string => {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** unit).toFixed(unit ? 1 : 0)} ${units[unit]}`;
};

const formatDate = (value: string | null): string => (value
  ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
  : 'Never');

const fileCategory = (item: ContentItem): ContentFileCategory => {
  const mime = item.mimeType ?? '';
  const extension = item.name.split('.').pop()?.toLowerCase();
  if (mime.includes('pdf') || extension === 'pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.includes('presentation') || ['ppt', 'pptx'].includes(extension ?? '')) return 'presentation';
  if (mime.includes('zip') || ['zip', 'rar', '7z'].includes(extension ?? '')) return 'archive';
  if (mime.includes('document') || ['doc', 'docx', 'txt', 'xls', 'xlsx'].includes(extension ?? '')) return 'document';
  return 'other';
};

const ItemIcon: React.FC<{ item: ContentItem; size?: number }> = ({ item, size = 20 }) => {
  if (item.kind === 'folder') return <Folder size={size} />;
  const category = fileCategory(item);
  if (category === 'pdf' || category === 'document' || category === 'presentation') return <FileText size={size} />;
  if (category === 'image') return <FileImage size={size} />;
  if (category === 'video') return <FileVideo size={size} />;
  if (category === 'archive') return <FileArchive size={size} />;
  return <FileIcon size={size} />;
};

const compareItems = (field: ContentSortField, direction: 'asc' | 'desc') => (a: ContentItem, b: ContentItem) => {
  if (field === 'manual') return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
  if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
  let result = 0;
  if (field === 'name') result = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  else if (field === 'type') result = (a.mimeType ?? a.kind).localeCompare(b.mimeType ?? b.kind);
  else if (field === 'size') result = a.size - b.size;
  else result = new Date(a[field]).getTime() - new Date(b[field]).getTime();
  return direction === 'asc' ? result : -result;
};

type DialogName = 'create' | 'rename' | 'delete' | 'move' | 'copy' | 'preview' | 'access' | null;
interface ContextMenuState { item: ContentItem; x: number; y: number }
interface PublishingSession {
  files: File[];
  mode: 'files' | 'folder' | 'drop';
  destinationId: string | null;
  destinationLabel: string;
}
type ContentTypeFilter = 'all' | 'folders' | 'files' | ContentFileCategory;

const contentFilterLabels: Record<ContentTypeFilter, string> = {
  all: 'All content',
  folders: 'Folders',
  files: 'All files',
  pdf: 'PDF files',
  image: 'Images',
  document: 'Documents',
  presentation: 'Presentations',
  video: 'Videos',
  archive: 'Archives',
  other: 'Other files',
};

const matchesContentFilter = (item: ContentItem, filter: ContentTypeFilter): boolean => {
  if (filter === 'all') return true;
  if (filter === 'folders') return item.kind === 'folder';
  if (filter === 'files') return item.kind === 'file';
  return item.kind === 'file' && fileCategory(item) === filter;
};

export const ContentPage: React.FC = () => {
  const store = useContentStore();
  const courseId = useCourseStore((state) => state.selections.content);
  const initializeCourses = useCourseStore((state) => state.initialize);

  useEffect(() => {
    void initializeCourses();
  }, [initializeCourses]);

  useEffect(() => {
    if (courseId) {
      void store.setCourse(courseId);
    }
  }, [courseId, store.setCourse]);
  const [selected, setSelected] = useState<string[]>([]);
  const [anchorIndex, setAnchorIndex] = useState<number | null>(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [dragOverCrumbId, setDragOverCrumbId] = useState<string | null>(null);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverReorderId, setDragOverReorderId] = useState<string | null>(null);

  // Undo / Redo History Stack (Ctrl + Z, Ctrl + Y)
  const undoStackRef = useRef<Array<{ description: string; undo: () => Promise<void>; redo: () => Promise<void> }>>([]);
  const redoStackRef = useRef<Array<{ description: string; undo: () => Promise<void>; redo: () => Promise<void> }>>([]);

  const pushHistoryAction = (action: { description: string; undo: () => Promise<void>; redo: () => Promise<void> }) => {
    undoStackRef.current.push(action);
    redoStackRef.current = [];
  };

  const executeUndo = async () => {
    if (!undoStackRef.current.length) {
      notify('Nothing to undo', 'There are no recent operations to undo.', 'info');
      return;
    }
    const action = undoStackRef.current.pop()!;
    try {
      await action.undo();
      redoStackRef.current.push(action);
      notify('Undo successful', `Undid: ${action.description}`);
    } catch (error) {
      notify('Undo failed', error instanceof Error ? error.message : undefined, 'error');
    }
  };

  const executeRedo = async () => {
    if (!redoStackRef.current.length) {
      notify('Nothing to redo', 'There are no operations to redo.', 'info');
      return;
    }
    const action = redoStackRef.current.pop()!;
    try {
      await action.redo();
      undoStackRef.current.push(action);
      notify('Redo successful', `Redid: ${action.description}`);
    } catch (error) {
      notify('Redo failed', error instanceof Error ? error.message : undefined, 'error');
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isControl = event.ctrlKey || event.metaKey;
      if (!isControl) return;

      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || (active as HTMLElement).isContentEditable)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        void executeUndo();
      } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault();
        void executeRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  const [dialog, setDialog] = useState<DialogName>(null);
  const [target, setTarget] = useState<ContentItem | null>(null);
  const [name, setName] = useState('');
  const [destination, setDestination] = useState<string | null>(null);
  const [folders, setFolders] = useState<ContentItem[]>([]);
  const [summary, setSummary] = useState<ContentFolderSummary | null>(null);
  const [details, setDetails] = useState<ContentItem | null>(null);
  const [detailsSummary, setDetailsSummary] = useState<ContentFolderSummary | null>(null);
  const [detailsPath, setDetailsPath] = useState('My Flow');
  const [description, setDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ContentSearchResult[]>([]);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [linkTarget, setLinkTarget] = useState<ContentItem | null>(null);
  const [createMenu, setCreateMenu] = useState(false);
  const [toasts, setToasts] = useState<AdminToastData[]>([]);

  // Page Heading & Unlocked/Locked State
  const [headingDraft, setHeadingDraft] = useState('Untitled Page');
  const [headingInvalid, setHeadingInvalid] = useState(false);
  const [savingHeading, setSavingHeading] = useState(false);

  // Unsaved changes course switch modal
  const [pendingCourseSwitch, setPendingCourseSwitch] = useState<string | null>(null);

  const [contentFilter, setContentFilter] = useState<ContentTypeFilter>('all');
  const [ordering, setOrdering] = useState(false);
  const [orderSelection, setOrderSelection] = useState<string[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);
  const [publishingSession, setPublishingSession] = useState<PublishingSession | null>(null);
  const [submittingFolder, setSubmittingFolder] = useState(false);

  const headingRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const setFolderInputRef = (node: HTMLInputElement | null) => {
    folderInputRef.current = node;
    if (node) {
      node.setAttribute('webkitdirectory', '');
      node.setAttribute('directory', '');
    }
  };

  const sortedItems = useMemo(() => [...store.items].sort(compareItems(store.sort.field, store.sort.direction)), [store.items, store.sort]);
  const getFolderSize = useMemo(() => {
    const map = new Map<string, number>();
    const calculateSize = (folderId: string): number => {
      if (map.has(folderId)) return map.get(folderId)!;
      const children = store.items.filter((item) => item.parentId === folderId);
      let size = 0;
      for (const child of children) {
        if (child.kind === 'file') {
          size += child.size || 0;
        } else if (child.kind === 'folder') {
          size += calculateSize(child.id);
        }
      }
      map.set(folderId, size);
      return size;
    };
    return (folderId: string) => calculateSize(folderId);
  }, [store.items]);
  const resultItems = searchQuery.trim() ? searchResults.map((result) => result.item) : sortedItems;
  const displayItems = useMemo(() => resultItems.filter((item) => matchesContentFilter(item, contentFilter)), [resultItems, contentFilter]);
  const selectableItems = displayItems;
  const selectedItems = useMemo(() => selectableItems.filter((item) => selected.includes(item.id)), [selected, selectableItems]);

  const normalizedHeading = headingDraft.trim();
  const lowerHeading = normalizedHeading.toLowerCase();
  const hasValidHeading = normalizedHeading.length > 0 && lowerHeading !== 'untitled' && lowerHeading !== 'untitled page' && lowerHeading !== 'untitled_page';
  const isPageLocked = !hasValidHeading;

  useEffect(() => {
    setSelected([]);
    setAnchorIndex(null);
    setDetails(null);
    const heading = store.pageHeading?.trim() ?? '';
    const lower = heading.toLowerCase();
    setHeadingDraft(heading && lower !== 'untitled' && lower !== 'untitled page' && lower !== 'untitled_page' ? heading : '');
    setHeadingInvalid(false);
    setOrdering(false);
    setOrderSelection([]);
  }, [store.courseId, store.currentFolderId, store.pageHeading]);

  useEffect(() => {
    const close = () => { setContextMenu(null); setCreateMenu(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', escape); };
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) { setSearchResults([]); setSearching(false); return; }
    let active = true;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const results = await store.search(query);
        if (active) setSearchResults(results);
      } finally { if (active) setSearching(false); }
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [searchQuery, store]);

  const notify = (title: string, message?: string, tone: AdminToastData['tone'] = 'success') => {
    const newToast: AdminToastData = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, title, message, tone };
    setToasts((prev) => [...prev.slice(-4), newToast]);
  };

  const dismissToast = (id?: string | number) => {
    if (id === undefined) setToasts([]);
    else setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const commitHeading = async (): Promise<boolean> => {
    if (savingHeading) return false;
    const trimmed = headingDraft.trim();
    if (trimmed === store.pageHeading) return true;
    const lower = trimmed.toLowerCase();
    if (!trimmed || lower === 'untitled page' || lower === 'untitled_page') {
      setHeadingInvalid(true);
      notify('Page heading locked', 'Please enter a valid page heading before creating content.', 'error');
      return false;
    }
    setSavingHeading(true);
    try {
      const prevHeading = store.pageHeading;
      await store.setPageHeading(trimmed);
      setHeadingDraft(trimmed);
      pushHistoryAction({
        description: `Page heading changed to "${trimmed}"`,
        undo: async () => {
          await store.setPageHeading(prevHeading);
          setHeadingDraft(prevHeading || 'Untitled Page');
        },
        redo: async () => {
          await store.setPageHeading(trimmed);
          setHeadingDraft(trimmed);
        },
      });
      notify('Page heading saved', `“${trimmed}” is now ready for content creation.`);
      return true;
    } catch (error) {
      notify('Page heading was not saved', error instanceof Error ? error.message : undefined, 'error');
      return false;
    } finally {
      setSavingHeading(false);
    }
  };

  const cancelHeadingEdit = () => {
    setHeadingDraft(store.pageHeading || 'Untitled Page');
    setHeadingInvalid(false);
  };

  const requirePageHeading = (): boolean => {
    if (hasValidHeading) {
      setHeadingInvalid(false);
      if (headingDraft.trim() !== store.pageHeading) {
        void commitHeading();
      }
      return true;
    }
    setHeadingInvalid(true);
    window.requestAnimationFrame(() => {
      headingRef.current?.focus({ preventScroll: true });
      headingRef.current?.select();
    });
    notify('Page heading required', 'Please enter a valid page heading before creating content.', 'error');
    return false;
  };

  const handleBeforeCourseChange = (nextCourseId: string): boolean => {
    const hasUnsavedChanges = headingDraft.trim() !== (store.pageHeading || 'Untitled Page');
    if (hasUnsavedChanges) {
      setPendingCourseSwitch(nextCourseId);
      return false;
    }
    return true;
  };

  const confirmCourseSwitch = async () => {
    if (!pendingCourseSwitch) return;
    const next = pendingCourseSwitch;
    setPendingCourseSwitch(null);
    setHeadingDraft('Untitled Page');
    setHeadingInvalid(false);
    await useCourseStore.getState().select('content', next);
  };

  const beginCreateFolder = () => {
    if (!requirePageHeading()) return;
    setName('');
    setDialog('create');
    setCreateMenu(false);
  };

  const beginOrdering = () => {
    if (isPageLocked) {
      notify('Page heading required', 'Please name the page before arranging content.', 'error');
      return;
    }
    setSearchQuery('');
    setContentFilter('all');
    store.setSort({ field: 'manual', direction: 'asc' });
    setSelected([]);
    setOrderSelection([]);
    setOrdering(true);
  };

  const toggleOrderItem = (itemId: string) => {
    setOrderSelection((current) => (current.includes(itemId)
      ? current.filter((id) => id !== itemId)
      : [...current, itemId]));
  };

  const saveOrder = async () => {
    setSavingOrder(true);
    try {
      const allFolderItemIds = displayItems.map((item) => item.id);
      const unselected = allFolderItemIds.filter((id) => !orderSelection.includes(id));
      const fullOrder = [...orderSelection, ...unselected];
      await store.saveChildOrder(fullOrder);
      setOrdering(false);
      setOrderSelection([]);
      notify('File order saved', 'This order will remain after navigation and reload.');
    } catch (error) {
      notify('Order could not be saved', error instanceof Error ? error.message : undefined, 'error');
    } finally {
      setSavingOrder(false);
    }
  };

  const openItem = async (item: ContentItem) => {
    if (item.kind === 'folder') { setSearchQuery(''); await store.navigate(item.id, { history: 'push' }); }
    else { setTarget(item); setDialog('preview'); await store.markOpened(item.id); }
  };

  const selectItem = (event: React.MouseEvent, item: ContentItem, index: number) => {
    const additive = event.ctrlKey || event.metaKey;
    if (event.shiftKey && anchorIndex !== null) {
      const [start, end] = [anchorIndex, index].sort((a, b) => a - b);
      const range = displayItems.slice(start, end + 1).map((entry) => entry.id);
      setSelected(additive ? [...new Set([...selected, ...range])] : range);
    } else {
      setSelected(additive
        ? selected.includes(item.id) ? selected.filter((id) => id !== item.id) : [...selected, item.id]
        : [item.id]);
      setAnchorIndex(index);
    }
  };

  const dropIntoBreadcrumb = async (event: React.DragEvent, targetFolderId: string | null, targetName: string) => {
    event.preventDefault();
    setDragOverCrumbId(null);
    const rawData = event.dataTransfer.getData('application/x-parallax-content');
    const internalIds = rawData ? rawData.split(',').filter(Boolean) : (draggedItemId ? [draggedItemId] : []);
    try {
      if (internalIds.length) {
        const itemsToMove = store.items.filter((i) => internalIds.includes(i.id));
        const moveMap = new Map(itemsToMove.map((i) => [i.id, i.parentId]));
        await store.moveItems(internalIds, targetFolderId);
        pushHistoryAction({
          description: `Moved ${internalIds.length} item(s) to ${targetName}`,
          undo: async () => {
            for (const [id, prevParent] of moveMap.entries()) {
              await store.moveItems([id], prevParent);
            }
          },
          redo: async () => {
            await store.moveItems(internalIds, targetFolderId);
          },
        });
        notify('Items moved', `Moved ${internalIds.length} item${internalIds.length === 1 ? '' : 's'} to ${targetName}.`);
        setSelected([]);
      }
    } catch (error) {
      notify('Drop could not be completed', error instanceof Error ? error.message : undefined, 'error');
    }
  };

  const handleReorderDrop = async (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const currentIds = displayItems.map((item) => item.id);
    const fromIndex = currentIds.indexOf(sourceId);
    const toIndex = currentIds.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    const nextIds = [...currentIds];
    const [moved] = nextIds.splice(fromIndex, 1);
    nextIds.splice(toIndex, 0, moved);

    try {
      const prevOrder = [...currentIds];
      await store.saveChildOrder(nextIds);
      pushHistoryAction({
        description: 'Item reordering',
        undo: async () => { await store.saveChildOrder(prevOrder); },
        redo: async () => { await store.saveChildOrder(nextIds); },
      });
      notify('Order updated', 'New custom file order saved permanently.');
    } catch (error) {
      notify('Order update failed', error instanceof Error ? error.message : undefined, 'error');
    }
  };

  const openAction = async (next: Exclude<DialogName, 'create' | 'preview' | null>, item?: ContentItem) => {
    if ((next === 'copy' || next === 'move') && !requirePageHeading()) return;
    const actual = item ?? selectedItems[0] ?? null;
    setTarget(actual);
    setName(actual?.name ?? '');
    setDestination(store.currentFolderId);
    if (next === 'delete' && actual?.kind === 'folder') setSummary(await contentRepository.getFolderSummary(actual.id, courseId));
    else setSummary(null);
    if (next === 'move' || next === 'copy') setFolders(await store.getFolders());
    setDialog(next);
  };

  const actionIds = target && !selected.includes(target.id) ? [target.id] : selected.length ? selected : target ? [target.id] : [];

  const submitDialog = async () => {
    if (dialog === 'create') {
      if (!requirePageHeading()) return;
      const trimmedFolder = name.trim();
      if (!trimmedFolder) {
        notify('Folder name required', 'Please enter a valid folder name.', 'error');
        return;
      }
      const isDuplicate = store.items.some((item) => item.kind === 'folder' && item.name.toLowerCase() === trimmedFolder.toLowerCase());
      if (isDuplicate) {
        notify('Folder name exists', `A folder named “${trimmedFolder}” already exists in this folder.`, 'error');
        return;
      }
      setSubmittingFolder(true);
      try {
        await store.createFolder(trimmedFolder);
        notify('Folder created', `“${trimmedFolder}” is ready.`);
        setDialog(null);
        setName('');
      } catch (error) {
        notify('Folder could not be created', error instanceof Error ? error.message : undefined, 'error');
      } finally {
        setSubmittingFolder(false);
      }
      return;
    }

    try {
      if (dialog === 'rename' && target) {
        const trimmedName = name.trim();
        if (!trimmedName) { notify('Name required', 'Please enter a valid name.', 'error'); return; }
        const oldName = target.name;
        const targetId = target.id;
        await store.renameItem(targetId, trimmedName);
        pushHistoryAction({
          description: `Renamed "${oldName}" to "${trimmedName}"`,
          undo: async () => { await store.renameItem(targetId, oldName); },
          redo: async () => { await store.renameItem(targetId, trimmedName); },
        });
        notify('Item renamed', `Renamed to ${trimmedName}.`);
      }
      if (dialog === 'delete') {
        const itemsToDelete = store.items.filter((i) => actionIds.includes(i.id));
        await store.deleteItems(actionIds);
        pushHistoryAction({
          description: `Deleted ${actionIds.length} item(s)`,
          undo: async () => {
            for (const item of itemsToDelete) {
              await contentRepository.restoreItem(item);
            }
            await store.refresh();
          },
          redo: async () => {
            await store.deleteItems(actionIds);
          },
        });
        notify('Moved out of Content', `${actionIds.length} item${actionIds.length === 1 ? '' : 's'} deleted.`);
      }
      if (dialog === 'move') {
        const itemsToMove = store.items.filter((i) => actionIds.includes(i.id));
        const moveMap = new Map(itemsToMove.map((i) => [i.id, i.parentId]));
        const targetDest = destination;
        await store.moveItems(actionIds, targetDest);
        pushHistoryAction({
          description: `Moved ${actionIds.length} item(s)`,
          undo: async () => {
            for (const [id, prevParent] of moveMap.entries()) {
              await store.moveItems([id], prevParent);
            }
          },
          redo: async () => {
            await store.moveItems(actionIds, targetDest);
          },
        });
        notify('Items moved');
      }
      if (dialog === 'copy') { await store.copyItems(actionIds, destination); notify('Copy created'); }
      setDialog(null); setSelected([]); setTarget(null);
    } catch (error) { notify('Action could not be completed', error instanceof Error ? error.message : undefined, 'error'); }
  };

  const [accessTypeDraft, setAccessTypeDraft] = useState<'FREE' | 'PAID'>('FREE');
  const [accessPriceDraft, setAccessPriceDraft] = useState<string>('499');
  const [accessDurationModeDraft, setAccessDurationModeDraft] = useState<'PERMANENT' | 'FIXED'>('PERMANENT');
  const [accessDurationValueDraft, setAccessDurationValueDraft] = useState<string>('30');
  const [accessDurationUnitDraft, setAccessDurationUnitDraft] = useState<AccessDurationUnit>('DAYS');
  const [accessDescriptionDraft, setAccessDescriptionDraft] = useState<string>('');
  const [accessSampleImages, setAccessSampleImages] = useState<ContentSampleImage[]>([]);
  const [accessStoreSections, setAccessStoreSections] = useState<ContentStoreSection[]>([
    { id: 'sec-1', heading: '', content: '', order: 0 },
    { id: 'sec-2', heading: '', content: '', order: 1 },
    { id: 'sec-3', heading: '', content: '', order: 2 },
  ]);
  const [accessImageError, setAccessImageError] = useState<string>('');
  const [applyToChildren, setApplyToChildren] = useState<boolean>(true);
  const [submittingAccess, setSubmittingAccess] = useState<boolean>(false);

  const readSampleImageFile = (file: File): Promise<ContentSampleImage> => new Promise((resolve, reject) => {
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      reject(new Error('Choose JPG, PNG, or WebP images only.'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error('Sample images must be under 5MB each.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve({
      id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: file.name,
      size: file.size,
      mimeType: file.type,
      dataUrl: String(reader.result),
      order: 0,
    });
    reader.onerror = () => reject(new Error('Image file could not be read.'));
    reader.readAsDataURL(file);
  });

  const openAccessDialog = async (item: ContentItem) => {
    let current = item;
    try {
      current = await contentRepository.getItem(item.id, courseId);
    } catch {
      // Keep the already-loaded item available if the detail refresh fails.
    }
    setTarget(current);
    setAccessTypeDraft(current.accessType || 'FREE');
    setAccessPriceDraft(current.price ? String(current.price) : '499');
    setAccessDurationModeDraft(current.accessDurationValue && current.accessDurationUnit ? 'FIXED' : 'PERMANENT');
    setAccessDurationValueDraft(String(current.accessDurationValue ?? 30));
    setAccessDurationUnitDraft(current.accessDurationUnit ?? 'DAYS');
    setAccessDescriptionDraft(current.description || '');
    setAccessSampleImages(current.sampleImages?.length ? current.sampleImages : []);
    const initialSections = current.storeSections?.length ? current.storeSections : [
      { id: 'sec-1', heading: '', content: '', order: 0 },
      { id: 'sec-2', heading: '', content: '', order: 1 },
      { id: 'sec-3', heading: '', content: '', order: 2 },
    ];
    setAccessStoreSections(initialSections);
    setAccessImageError('');
    setApplyToChildren(true);
    setContextMenu(null);
    setDialog('access');
  };

  const addAccessSampleImage = async (files: File[]) => {
    if (!files.length) return;
    setAccessImageError('');
    try {
      const available = 3 - accessSampleImages.length;
      if (files.length > available) throw new Error(`You can add maximum 3 sample images.`);
      const newImages = await Promise.all(files.map(readSampleImageFile));
      setAccessSampleImages((current) => [...current, ...newImages].slice(0, 3).map((img, idx) => ({ ...img, order: idx })));
    } catch (err) {
      setAccessImageError(err instanceof Error ? err.message : 'Failed to add image.');
    }
  };

  const removeAccessSampleImage = (imageId: string) => {
    setAccessSampleImages((current) => current.filter((img) => img.id !== imageId).map((img, idx) => ({ ...img, order: idx })));
  };

  const updateAccessStoreSection = (index: number, patch: Partial<ContentStoreSection>) => {
    setAccessStoreSections((current) => current.map((sec, idx) => idx === index ? { ...sec, ...patch } : sec));
  };

  const submitAccessChange = async () => {
    if (!target) return;
    const numPrice = Number(accessPriceDraft);
    if (accessTypeDraft === 'PAID') {
      if (!accessPriceDraft || isNaN(numPrice) || numPrice <= 0) {
        notify('Valid price required', 'Paid content requires a positive price.', 'error');
        return;
      }
      const durationValue = Number(accessDurationValueDraft);
      const max = accessDurationUnitDraft === 'DAYS' ? 3650 : accessDurationUnitDraft === 'WEEKS' ? 520 : 120;
      if (accessDurationModeDraft === 'FIXED' && (!Number.isInteger(durationValue) || durationValue <= 0 || durationValue > max)) {
        notify('Valid expiry required', 'Enter a whole number from 0 to 3650 days after the learner’s exam date.', 'error');
        return;
      }
    }
    setSubmittingAccess(true);
    try {
      const updated = await store.updateAccessType(
        target.id,
        accessTypeDraft,
        accessTypeDraft === 'PAID' ? numPrice : null,
        applyToChildren,
        accessTypeDraft === 'PAID' ? accessDescriptionDraft.trim() : undefined,
        accessTypeDraft === 'PAID' ? accessSampleImages : [],
        accessTypeDraft === 'PAID' ? accessStoreSections : [],
        accessTypeDraft === 'PAID' && accessDurationModeDraft === 'FIXED' ? Number(accessDurationValueDraft) : null,
        accessTypeDraft === 'PAID' && accessDurationModeDraft === 'FIXED' ? accessDurationUnitDraft : null
      );
      if (details && details.id === target.id) {
        setDetails(updated);
      }
      notify('Access setting updated', `${target.name} converted to ${accessTypeDraft.toLowerCase()} access.`);
      setDialog(null);
      setTarget(null);
    } catch (error) {
      notify('Access update failed', error instanceof Error ? error.message : undefined, 'error');
    } finally {
      setSubmittingAccess(false);
    }
  };

  const chooseUpload = (folder = false) => {
    if (!requirePageHeading()) return;
    setCreateMenu(false);
    (folder ? folderInputRef : fileInputRef).current?.click();
  };

  const currentDestinationLabel = store.breadcrumbs.map((crumb) => crumb.name).join(' / ') || 'My Flow';

  const stageFiles = (files: File[], mode: PublishingSession['mode'], destinationId = store.currentFolderId, destinationLabel = currentDestinationLabel) => {
    if (!files.length) return;
    if (!requirePageHeading()) return;
    setPublishingSession({ files, mode, destinationId, destinationLabel });
  };

  const downloadItem = async (item: ContentItem) => {
    if (item.kind === 'folder') { notify('Folder download unavailable', 'Select the files inside this folder to download them.', 'info'); return; }
    const source = contentRepository.getFileSource(item.id);
    if (source) {
      const url = URL.createObjectURL(source);
      const link = document.createElement('a'); link.href = url; link.download = item.name; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }
    try {
      const res = await apiRequest<{ url: string; fileName: string }>(`/api/admin/content/${encodeURIComponent(item.id)}/download`);
      if (res && res.url) {
        const link = document.createElement('a');
        link.href = res.url;
        link.download = res.fileName || item.name;
        link.target = '_blank';
        link.click();
        return;
      }
    } catch {
      // Fallback
    }
    const fallbackSource = new File([`Parallax Flow content placeholder for ${item.name}`], item.name, { type: item.mimeType ?? 'text/plain' });
    const url = URL.createObjectURL(fallbackSource);
    const link = document.createElement('a'); link.href = url; link.download = item.name; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const openDetails = async (item: ContentItem) => {
    setDetails(item); setDescription(item.description); setContextMenu(null); setDetailsSummary(null);
    const [path, folderSummary, current] = await Promise.all([
      contentRepository.getBreadcrumb(item.parentId, courseId),
      item.kind === 'folder' ? contentRepository.getFolderSummary(item.id, courseId) : Promise.resolve(null),
      contentRepository.getItem(item.id, courseId).catch(() => item),
    ]);
    setDetails(current);
    setDescription(current.description);
    setDetailsPath(path.map((part) => part.name).join(' / '));
    setDetailsSummary(folderSummary);
  };

  const context = (event: React.MouseEvent, item: ContentItem) => {
    event.preventDefault(); event.stopPropagation();
    const width = 230; const height = 360;
    setContextMenu({ item, x: Math.max(8, Math.min(event.clientX, window.innerWidth - width - 8)), y: Math.max(8, Math.min(event.clientY, window.innerHeight - height - 8)) });
    if (!selected.includes(item.id)) setSelected([item.id]);
  };

  const dropInto = async (event: React.DragEvent, folder: ContentItem) => {
    event.preventDefault(); event.currentTarget.classList.remove('is-drop-target');
    if (isPageLocked) {
      notify('Page heading required', 'Please enter a valid page heading before adding content.', 'error');
      return;
    }
    const internalIds = event.dataTransfer.getData('application/x-parallax-content').split(',').filter(Boolean);
    try {
      if (internalIds.length) { await store.moveItems(internalIds, folder.id); notify('Items moved', `Moved to ${folder.name}.`); }
      else if (event.dataTransfer.files.length) {
        stageFiles(
          [...event.dataTransfer.files],
          'drop',
          folder.id,
          `${currentDestinationLabel} / ${folder.name}`,
        );
      }
    } catch (error) { notify('Drop could not be completed', error instanceof Error ? error.message : undefined, 'error'); }
  };

  return (
    <motion.main className="pf-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
      <AdminPageHeader
        title="Content"
        description="Direct Parallax Flow content. Academy-owned files and folders remain in their Academy details page."
        breadcrumbs={[{ label: 'Overview', to: '/admin/overview' }, { label: 'Content' }]}
        actions={<CourseSelector module="content" onBeforeChange={handleBeforeCourseChange} />}
      />

      <input ref={fileInputRef} className="pf-admin-sr-only" type="file" multiple accept={acceptedFiles} onChange={(event) => { stageFiles([...(event.target.files ?? [])], 'files'); event.target.value = ''; }} />
      <input ref={setFolderInputRef} className="pf-admin-sr-only" type="file" multiple accept={acceptedFiles} onChange={(event) => { stageFiles([...(event.target.files ?? [])], 'folder'); event.target.value = ''; }} />

      <section className="pf-content-browser" aria-label="Content library">
        <div className={`pf-content-page-identity${headingInvalid ? ' is-invalid' : ''}${isPageLocked ? ' is-locked' : ''}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <label htmlFor="pf-content-page-heading">PAGE HEADING</label>
            {isPageLocked ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' }}>
                <Lock size={12} /> UNNAMED PAGE (LOCKED)
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac' }}>
                <Check size={12} /> READY
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              ref={headingRef}
              id="pf-content-page-heading"
              value={headingDraft}
              onChange={(event) => {
                setHeadingDraft(event.target.value);
                const val = event.target.value.trim().toLowerCase();
                if (val && val !== 'untitled page' && val !== 'untitled_page') setHeadingInvalid(false);
              }}
              onBlur={(e) => {
                const related = e.relatedTarget as HTMLElement | null;
                if (related && related.tagName === 'BUTTON') return;
                if (headingDraft.trim() !== store.pageHeading && hasValidHeading && !savingHeading) {
                  void commitHeading();
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void commitHeading();
                  event.currentTarget.blur();
                }
              }}
              placeholder="Untitled Page"
              aria-invalid={headingInvalid}
              spellCheck="false"
              style={{ flex: 1 }}
            />

            {headingDraft.trim() !== (store.pageHeading || 'Untitled Page') ? (
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  className="pf-admin-button pf-admin-button--quiet"
                  type="button"
                  onClick={cancelHeadingEdit}
                  style={{ padding: '6px 12px', fontSize: 12 }}
                >
                  Cancel
                </button>
                <button
                  className="pf-admin-button pf-admin-button--primary"
                  type="button"
                  onClick={() => void commitHeading()}
                  disabled={savingHeading}
                  style={{ padding: '6px 14px', fontSize: 12, background: '#2563eb', color: '#ffffff' }}
                >
                  {savingHeading ? 'Saving…' : 'Save'}
                </button>
              </div>
            ) : null}
          </div>

          {isPageLocked ? (
            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#dc2626', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5 }}>
              ⚠️ Content creation is locked until you give this library a valid page heading.
            </p>
          ) : null}

          <nav className="pf-content-full-path" aria-label="Full content path" style={{ marginTop: 8 }}>
            {store.breadcrumbs.map((crumb, index) => {
              const isTarget = dragOverCrumbId === (crumb.id ?? 'root');
              return (
                <React.Fragment key={crumb.id ?? 'root'}>
                  {index ? <span aria-hidden="true">/</span> : <HardDrive aria-hidden="true" />}
                  <button
                    type="button"
                    onClick={() => void store.navigate(crumb.id, { history: 'push' })}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      setDragOverCrumbId(crumb.id ?? 'root');
                    }}
                    onDragLeave={() => setDragOverCrumbId(null)}
                    onDrop={(e) => void dropIntoBreadcrumb(e, crumb.id, crumb.name)}
                    style={{
                      background: isTarget ? '#dbeafe' : undefined,
                      color: isTarget ? '#1d4ed8' : undefined,
                      borderRadius: 6,
                      padding: '2px 6px',
                      transition: 'all 140ms ease',
                    }}
                    aria-current={index === store.breadcrumbs.length - 1 ? 'page' : undefined}
                  >
                    {crumb.name}
                  </button>
                </React.Fragment>
              );
            })}
          </nav>
        </div>

        <header className="pf-content-toolbar">
          <div className="pf-content-history">
            <button type="button" onClick={() => void store.goBack()} disabled={!store.backStack.length} aria-label="Back"><ArrowLeft /></button>
            <button type="button" onClick={() => void store.goForward()} disabled={!store.forwardStack.length} aria-label="Forward"><ArrowRight /></button>
            <button type="button" onClick={() => void store.refresh()} aria-label="Refresh"><RefreshCw /></button>
            <button type="button" onClick={() => void executeUndo()} title="Undo (Ctrl+Z)" aria-label="Undo"><Undo2 size={16} /></button>
            <button type="button" onClick={() => void executeRedo()} title="Redo (Ctrl+Y)" aria-label="Redo"><Redo2 size={16} /></button>
          </div>
          <div className="pf-content-search-group">
            <label className="pf-content-search"><Search /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search all content" aria-label="Search all content" />{searchQuery ? <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear search"><X /></button> : null}</label>
            <details className="pf-content-filter">
              <summary aria-label="Filter and sort content"><Filter /><span>{contentFilterLabels[contentFilter]}</span><ChevronDown /></summary>
              <div>
                <fieldset>
                  <legend>Content type</legend>
                  {(Object.keys(contentFilterLabels) as ContentTypeFilter[]).map((value) => <button className={contentFilter === value ? 'is-active' : ''} type="button" key={value} onClick={() => setContentFilter(value)}>{contentFilter === value ? <Check /> : <span />}{contentFilterLabels[value]}</button>)}
                </fieldset>
                <fieldset>
                  <legend>Sort</legend>
                  {([['manual', 'Saved order'], ['name', 'Name'], ['updatedAt', 'Modified'], ['createdAt', 'Created'], ['type', 'Type'], ['size', 'Size']] as Array<[ContentSortField, string]>).map(([value, label]) => <button className={store.sort.field === value ? 'is-active' : ''} type="button" key={value} onClick={() => store.setSort({ ...store.sort, field: value })}>{store.sort.field === value ? <Check /> : <span />}{label}</button>)}
                  {store.sort.field !== 'manual' ? <button type="button" onClick={() => store.setSort({ ...store.sort, direction: store.sort.direction === 'asc' ? 'desc' : 'asc' })}><ArrowUpDown /><span>{store.sort.direction === 'asc' ? 'Ascending' : 'Descending'}</span></button> : null}
                </fieldset>
              </div>
            </details>
          </div>
          <div className="pf-content-view-actions">
            <button
              className={`pf-admin-button pf-admin-button--secondary${isSelectMode ? ' is-active' : ''}`}
              type="button"
              onClick={() => {
                setIsSelectMode((current) => !current);
                if (isSelectMode) setSelected([]);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                borderRadius: 9,
                border: '1px solid var(--admin-line-strong)',
                background: isSelectMode ? '#2563eb' : 'var(--admin-panel-solid)',
                color: isSelectMode ? '#ffffff' : 'var(--admin-ink)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 160ms ease',
              }}
            >
              <CheckSquare size={15} />
              <span>{isSelectMode ? 'Cancel Select' : 'Select'}</span>
            </button>
            {ordering ? <button className="pf-content-order-cancel" type="button" onClick={() => { setOrdering(false); setOrderSelection([]); }}>Cancel</button> : null}
            <button className={`pf-content-order-button${ordering ? ' is-active' : ''}`} type="button" onClick={() => (ordering ? void saveOrder() : beginOrdering())} disabled={isPageLocked || savingOrder || (!ordering && !store.items.length)}>{ordering ? <Check /> : <ArrowDownAZ />}<span>{savingOrder ? 'Saving…' : ordering ? 'Save' : 'Order File'}</span></button>
            <div role="group" aria-label="View mode"><button className={store.view === 'list' ? 'is-active' : ''} type="button" onClick={() => store.setView('list')} aria-label="List view"><List /></button><button className={store.view === 'grid' ? 'is-active' : ''} type="button" onClick={() => store.setView('grid')} aria-label="Grid view"><Grid2X2 /></button></div>
            <div className="pf-content-new-wrap" onPointerDown={(event) => event.stopPropagation()}>
              <button
                className="pf-admin-button pf-admin-button--primary pf-content-new-btn"
                type="button"
                onClick={() => {
                  if (!requirePageHeading()) return;
                  setCreateMenu((open) => !open);
                }}
                disabled={isPageLocked}
                aria-expanded={createMenu}
                title={isPageLocked ? 'Please name the page before adding content' : undefined}
              >
                <Plus size={17} /> New <ChevronDown size={15} />
              </button>
              <AnimatePresence>{createMenu && !isPageLocked ? (
                <motion.div className="pf-content-create-menu" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
                  <button type="button" onClick={beginCreateFolder}><FolderOpen /> <span><strong>New folder</strong><small>Create a structured level</small></span></button>
                  <button type="button" onClick={() => chooseUpload()}><Upload /> <span><strong>Upload files</strong><small>PDF, media or documents</small></span></button>
                  <button type="button" onClick={() => chooseUpload(true)}><FolderInput /> <span><strong>Upload folder</strong><small>Keep its nested structure</small></span></button>
                </motion.div>
              ) : null}</AnimatePresence>
            </div>
          </div>
        </header>

        <AnimatePresence>{ordering ? (
          <motion.div className="pf-content-ordering-bar" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
            <span><ArrowDownAZ /> Click files and folders in the exact sequence you want.</span>
            <strong>{orderSelection.length} of {store.items.length} ordered</strong>
          </motion.div>
        ) : null}</AnimatePresence>

        <AnimatePresence>{(selected.length || isSelectMode) && !ordering ? (
          <motion.div className="pf-content-selection" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            <button type="button" onClick={() => { setSelected([]); setIsSelectMode(false); }} aria-label="Clear selection"><X /></button>
            <strong>{selected.length} selected</strong>
            <button
              className="pf-admin-button pf-admin-button--quiet"
              type="button"
              onClick={() => {
                if (selected.length === selectableItems.length) {
                  setSelected([]);
                } else {
                  setSelected(selectableItems.map((item) => item.id));
                }
              }}
              style={{ padding: '3px 9px', fontSize: 11, marginLeft: 6, color: 'var(--admin-primary)', fontWeight: 700 }}
            >
              {selected.length === selectableItems.length ? 'Deselect all' : 'Select all'}
            </button>
            <span />
            <button type="button" onClick={() => void openAction('move')} disabled={!selected.length}><Move /> Move</button>
            <button type="button" onClick={() => void openAction('copy')} disabled={!selected.length}><Copy /> Copy</button>
            <button type="button" onClick={() => selectedItems.forEach(downloadItem)} disabled={!selected.length}><ArrowDownToLine /> Download</button>
            {selectedItems.length === 1 ? <button type="button" onClick={() => void openDetails(selectedItems[0])}><Info /> Details</button> : null}
            <button className="is-danger" type="button" onClick={() => void openAction('delete')} disabled={!selected.length}><Trash2 /> Delete</button>
          </motion.div>
        ) : null}</AnimatePresence>

        {searchQuery.trim() ? <div className="pf-content-search-caption"><Search /> <span>Results across My Flow for <strong>“{searchQuery.trim()}”</strong></span>{searching ? <small>Searching…</small> : <small>{displayItems.length} found</small>}</div> : null}

        {store.status === 'loading' && !searchQuery ? <AdminSkeleton variant="table" rows={6} label="Loading content" /> : null}
        {store.status === 'error' ? <AdminEmptyState title="Content could not be loaded" description={store.error ?? 'Try again.'} action={<button className="pf-admin-button" type="button" onClick={() => void store.refresh()}>Try again</button>} /> : null}

        {/* Empty States */}
        {(store.status === 'ready' || searchQuery) && !searching && !displayItems.length ? (
          searchQuery || contentFilter !== 'all' ? (
            // State D: Search/Filter has no results
            <AdminEmptyState
              icon={<FolderOpen />}
              title="No matching content"
              description="Try a broader search or content type."
            />
          ) : isPageLocked ? (
            // State A: Unnamed Page
            <AdminEmptyState
              icon={<Lock />}
              title="Unnamed Page"
              description="Content creation is locked. Name this page heading above to enable folders and file uploads."
              action={
                <button className="pf-admin-button" type="button" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                  Create folder
                </button>
              }
            />
          ) : (
            // State B: Named but Empty
            <AdminEmptyState
              icon={<FolderOpen />}
              title="This folder is ready"
              description="Create a folder or upload files to begin."
              action={
                <button className="pf-admin-button" type="button" onClick={beginCreateFolder}>
                  Create folder
                </button>
              }
            />
          )
        ) : null}

        {/* State C: Content Exists */}
        {displayItems.length ? (
          <div className={`pf-content-items pf-content-items--${store.view}`} role="grid" aria-label={searchQuery ? 'Search results' : 'Folder contents'}>
            {store.view === 'list' ? <div className="pf-content-list-head" role="row"><span>Name</span><span>Owner</span><span>Modified</span><span>Size</span><span /></div> : null}
            {displayItems.map((item, index) => {
              const searchResult = searchResults.find((result) => result.item.id === item.id);
              const orderIndex = orderSelection.indexOf(item.id);
              const isReorderTarget = dragOverReorderId === item.id;
              return (
                <motion.article
                  layout="position"
                  key={item.id}
                  className={`${selected.includes(item.id) ? 'is-selected' : ''}${ordering ? ' is-ordering' : ''}${orderIndex >= 0 ? ' is-ordered' : ''}${isReorderTarget ? ' is-drop-target' : ''}`}
                  role="row"
                  tabIndex={0}
                  draggable={!ordering}
                  onClick={(event) => {
                    if (ordering) {
                      toggleOrderItem(item.id);
                    } else if (isSelectMode) {
                      selectItem(event, item, index);
                    }
                  }}
                  onDoubleClick={() => {
                    if (!ordering) void openItem(item);
                  }}
                  onKeyDown={(event) => { if (ordering && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); toggleOrderItem(item.id); } else if (event.key === 'Enter') void openItem(item); else if (event.key === ' ') { event.preventDefault(); setSelected([item.id]); } }}
                  onContextMenu={(event) => { if (ordering) event.preventDefault(); else context(event, item); }}
                  onDragStart={(event: any) => {
                    setDraggedItemId(item.id);
                    const dragIds = selected.includes(item.id) ? selected : [item.id];
                    event.dataTransfer?.setData('application/x-parallax-content', dragIds.join(','));
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (item.kind === 'folder' && !selected.includes(item.id)) {
                      event.currentTarget.classList.add('is-drop-target');
                    } else if (draggedItemId && draggedItemId !== item.id) {
                      setDragOverReorderId(item.id);
                    }
                  }}
                  onDragLeave={(event) => {
                    event.currentTarget.classList.remove('is-drop-target');
                    setDragOverReorderId(null);
                  }}
                  onDrop={(event) => {
                    setDragOverReorderId(null);
                    if (item.kind === 'folder' && draggedItemId !== item.id && !selected.includes(item.id)) {
                      void dropInto(event, item);
                    } else if (draggedItemId && draggedItemId !== item.id) {
                      void handleReorderDrop(draggedItemId, item.id);
                    }
                  }}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease, delay: Math.min(index * 0.018, 0.12) }}
                >
                  {ordering ? <span className="pf-content-order-index" aria-label={orderIndex >= 0 ? `Order ${orderIndex + 1}` : 'Not ordered'}>{orderIndex >= 0 ? orderIndex + 1 : <Plus />}</span> : null}
                  <span className={`pf-content-item-icon pf-content-item-icon--${item.kind}`}><ItemIcon item={item} size={store.view === 'grid' ? 27 : 19} /></span>
                  <div className="pf-content-item-name"><strong>{item.name}</strong>{searchResult ? <small>{searchResult.path.map((part) => part.name).join(' / ')}</small> : item.entityType ? <small>{item.entityType.replace('-', ' ')}</small> : null}</div>
                  <span className="pf-content-owner">{item.owner}</span>
                  <time dateTime={item.updatedAt}>{formatDate(item.updatedAt)}</time>
                  <span className="pf-content-size">{item.kind === 'file' ? formatBytes(item.size) : formatBytes(getFolderSize(item.id))}</span>
                  <button className="pf-content-more" type="button" onClick={(event) => context(event, item)} aria-label={`More actions for ${item.name}`} disabled={ordering}><MoreVertical /></button>
                </motion.article>
              );
            })}
          </div>
        ) : null}
      </section>

      <AnimatePresence>{store.uploads.length ? (
        <motion.aside className="pf-content-uploads" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
          <header><strong>Uploads</strong><button type="button" onClick={store.clearCompletedUploads} aria-label="Clear completed uploads"><X /></button></header>
          {store.uploads.slice(-5).map((task) => <div key={task.id}><span><FileText /><em>{task.name}</em><small>{task.status === 'error' ? task.error : `${task.progress}%`}</small></span><i><b style={{ transform: `scaleX(${task.progress / 100})` }} /></i></div>)}
        </motion.aside>
      ) : null}</AnimatePresence>

      <AnimatePresence>{details ? (
        <motion.aside className="pf-content-details" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.24, ease }} data-lenis-prevent>
          <header><div><ItemIcon item={details} /><strong>{details.name}</strong></div><button type="button" onClick={() => setDetails(null)} aria-label="Close details"><X /></button></header>
          <div className="pf-content-details__preview"><ItemIcon item={details} size={48} /></div>
          <dl>
            <div><dt>Type</dt><dd>{details.kind === 'folder' ? 'Folder' : details.mimeType ?? 'File'}</dd></div>
            <div><dt>{details.kind === 'folder' ? 'Storage used' : 'Size'}</dt><dd>{details.kind === 'folder' ? detailsSummary ? formatBytes(detailsSummary.totalSize) : 'Calculating…' : formatBytes(details.size)}</dd></div>
            {details.kind === 'folder' ? <>
              <div><dt>Folders</dt><dd>{detailsSummary?.folders ?? '—'}</dd></div>
              <div><dt>Files</dt><dd>{detailsSummary?.files ?? '—'}</dd></div>
              <div><dt>Access</dt><dd style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span>{details.accessType === 'PAID' ? `Paid (₹${details.price?.toLocaleString('en-IN') ?? '0'}) · ${details.accessDurationValue && details.accessDurationUnit ? `${details.accessDurationValue} ${details.accessDurationUnit.toLowerCase()}` : 'Permanent'}` : 'Free'}</span><button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={() => openAccessDialog(details)} style={{ padding: '2px 8px', fontSize: 11 }}><ShoppingBag size={12} /> Edit</button></dd></div>
            </> : <>
              <div><dt>Storage used</dt><dd>{formatBytes(details.size)}</dd></div>
              <div><dt>Access</dt><dd style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span>{details.accessType === 'PAID' ? `Paid (₹${details.price?.toLocaleString('en-IN') ?? '0'}) · ${details.accessDurationValue && details.accessDurationUnit ? `${details.accessDurationValue} ${details.accessDurationUnit.toLowerCase()}` : 'Permanent'}` : 'Free'}</span><button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={() => openAccessDialog(details)} style={{ padding: '2px 8px', fontSize: 11 }}><ShoppingBag size={12} /> Edit</button></dd></div>
              {details.accessType === 'PAID' ? <>
                <div><dt>Sample images</dt><dd>{details.sampleImages.length}</dd></div>
                <div><dt>Store sections</dt><dd>{details.storeSections.length}</dd></div>
              </> : null}
            </>}
            <div><dt>Location</dt><dd>{detailsPath}</dd></div>
            <div><dt>Owner</dt><dd>{details.owner}</dd></div>
            <div><dt>Modified</dt><dd>{formatDate(details.updatedAt)}</dd></div>
            <div><dt>Opened</dt><dd>{formatDate(details.lastOpenedAt)}</dd></div>
            <div><dt>Created</dt><dd>{formatDate(details.createdAt)}</dd></div>
          </dl>
          <label><span>Description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Add description" rows={5} /></label>
          <button className="pf-admin-button" type="button" onClick={async () => { try { const updated = await store.updateDescription(details.id, description); setDetails(updated); notify('Description saved'); } catch (error) { notify('Description was not saved', error instanceof Error ? error.message : undefined, 'error'); } }}>Save details</button>
        </motion.aside>
      ) : null}</AnimatePresence>

      {contextMenu ? (
        <div className="pf-content-context" style={{ left: contextMenu.x, top: contextMenu.y }} onPointerDown={(event) => event.stopPropagation()}>
          <button type="button" onClick={() => { void openItem(contextMenu.item); setContextMenu(null); }}>{contextMenu.item.kind === 'folder' ? <FolderOpen /> : <FileText />} {contextMenu.item.kind === 'folder' ? 'Open' : 'Preview'}</button>
          <button type="button" onClick={() => { setTarget(contextMenu.item); setName(contextMenu.item.name); setDialog('rename'); setContextMenu(null); }}><Pencil /> Rename</button>
          <button type="button" onClick={() => { setLinkTarget(contextMenu.item); setContextMenu(null); }}><Link2 /> Attach Link</button>
          <button type="button" onClick={() => openAccessDialog(contextMenu.item)}><ShoppingBag /> Convert Access (Free / Paid)</button>
          <button type="button" onClick={() => void openAction('move', contextMenu.item)}><Move /> Move to</button>
          <button type="button" onClick={() => void openAction('copy', contextMenu.item)}><ClipboardCopy /> Make a copy</button>
          {contextMenu.item.kind === 'file' ? <button type="button" onClick={() => { downloadItem(contextMenu.item); setContextMenu(null); }}><ArrowDownToLine /> Download</button> : null}
          <button type="button" onClick={() => void openDetails(contextMenu.item)}><Info /> File information</button>
          <hr /><button className="is-danger" type="button" onClick={() => void openAction('delete', contextMenu.item)}><Trash2 /> Delete</button>
        </div>
      ) : null}

      <ContentAttachedLinksDialog
        open={Boolean(linkTarget)}
        contentId={linkTarget?.id ?? null}
        contentName={linkTarget?.name ?? ''}
        apiBase="/api/admin/content"
        onClose={() => setLinkTarget(null)}
      />

      {/* Convert Access (Free / Paid) Dialog */}
      <AdminDialog
        open={dialog === 'access'}
        onClose={() => setDialog(null)}
        title={`Convert Access — ${target?.name ?? ''}`}
        description={`Change access type for this ${target?.kind === 'folder' ? 'folder' : 'file'}.`}
        size={accessTypeDraft === 'PAID' ? 'medium' : 'small'}
        footer={
          <>
            <button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={() => setDialog(null)}>
              Cancel
            </button>
            <button className="pf-admin-button" type="button" onClick={() => void submitAccessChange()} disabled={submittingAccess}>
              {submittingAccess ? 'Saving…' : 'Save Access Setting'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={() => { setAccessTypeDraft('FREE'); setAccessDurationModeDraft('PERMANENT'); setAccessDurationValueDraft(''); setAccessDurationUnitDraft('DAYS'); }}
              style={{
                flex: 1, padding: '12px 14px', borderRadius: 8, border: accessTypeDraft === 'FREE' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                backgroundColor: accessTypeDraft === 'FREE' ? '#eff6ff' : '#ffffff', cursor: 'pointer', textAlign: 'left', fontWeight: 600, color: accessTypeDraft === 'FREE' ? '#1e40af' : '#475569',
                display: 'flex', flexDirection: 'column', gap: 4
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                <CheckCircle2 size={18} color={accessTypeDraft === 'FREE' ? '#2563eb' : '#64748b'} />
                <span>Free Access</span>
              </div>
              <div style={{ fontSize: 12, fontWeight: 400, color: '#64748b' }}>Available immediately in library</div>
            </button>

            <button
              type="button"
              onClick={() => setAccessTypeDraft('PAID')}
              style={{
                flex: 1, padding: '12px 14px', borderRadius: 8, border: accessTypeDraft === 'PAID' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                backgroundColor: accessTypeDraft === 'PAID' ? '#eff6ff' : '#ffffff', cursor: 'pointer', textAlign: 'left', fontWeight: 600, color: accessTypeDraft === 'PAID' ? '#1e40af' : '#475569',
                display: 'flex', flexDirection: 'column', gap: 4
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                <LockKeyhole size={18} color={accessTypeDraft === 'PAID' ? '#2563eb' : '#64748b'} />
                <span>Paid Content</span>
              </div>
              <div style={{ fontSize: 12, fontWeight: 400, color: '#64748b' }}>Requires store purchase</div>
            </button>
          </div>

          {accessTypeDraft === 'PAID' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
              <label className="pf-admin-field">
                <span>Price (₹) <b style={{ color: '#dc2626' }}>*Required</b></span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={accessPriceDraft}
                  onChange={(e) => setAccessPriceDraft(e.target.value)}
                  placeholder="e.g. 499"
                />
              </label>

              <label className="pf-admin-field">
                <span>Access duration</span>
                <AppSelect value={accessDurationModeDraft} onChange={(event) => setAccessDurationModeDraft(event.target.value as 'PERMANENT' | 'FIXED')}>
                  <option value="PERMANENT">Permanent access</option>
                  <option value="FIXED">Fixed duration</option>
                </AppSelect>
                <small style={{ color: '#64748b' }}>{accessDurationModeDraft === 'PERMANENT' ? 'Lifetime access to this content.' : 'The configured period starts after successful purchase.'}</small>
              </label>

              {accessDurationModeDraft === 'FIXED' ? (
                <label className="pf-admin-field">
                  <span>Duration <b style={{ color: '#dc2626' }}>*Required</b></span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><input type="number" min="1" step="1" value={accessDurationValueDraft} onChange={(event) => setAccessDurationValueDraft(event.target.value)} /><AppSelect value={accessDurationUnitDraft} onChange={(event) => setAccessDurationUnitDraft(event.target.value as AccessDurationUnit)}><option value="DAYS">Days</option><option value="WEEKS">Weeks</option><option value="MONTHS">Months</option></AppSelect></div>
                  <small style={{ color: '#64748b' }}>Expiry is calculated and stored by the server when access is activated.</small>
                </label>
              ) : null}

              <label className="pf-admin-field">
                <span>Description / Store Details</span>
                <textarea
                  rows={3}
                  value={accessDescriptionDraft}
                  onChange={(e) => setAccessDescriptionDraft(e.target.value)}
                  placeholder="Explain what the learner receives and why it is useful."
                />
              </label>

              {/* STORE PREVIEW IMAGES */}
              <div className="pf-publish-samples" style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <header style={{ marginBottom: 10 }}>
                  <strong style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px' }}>STORE PREVIEW IMAGES</strong>
                </header>

                {/* AUTOMATIC COVER CARD */}
                <div style={{ background: '#ffffff', padding: 10, borderRadius: 6, border: '1px solid #cbd5e1', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 56, background: '#0f172a', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8', fontSize: 10, fontWeight: 700 }}>
                    PDF
                  </div>
                  <div>
                    <strong style={{ fontSize: 12, display: 'block', color: '#0f172a' }}>AUTOMATIC COVER (PAGE 1)</strong>
                    <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Automatically generated from page 1 of the uploaded PDF</span>
                    <span style={{ fontSize: 10.5, color: '#0284c7', fontWeight: 600 }}>Required · Cannot be removed</span>
                  </div>
                </div>

                {/* OPTIONAL PREVIEW IMAGES */}
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <strong style={{ fontSize: 12.5 }}>OPTIONAL PREVIEW IMAGES</strong>
                    <small style={{ display: 'block', color: '#64748b', fontSize: 11 }}>Up to 3 additional preview images ({accessSampleImages.length} / 3)</small>
                  </div>
                  <label className={accessSampleImages.length >= 3 ? 'is-disabled' : ''} style={{ cursor: accessSampleImages.length >= 3 ? 'not-allowed' : 'pointer', fontSize: 12, padding: '4px 10px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 6, display: accessSampleImages.length >= 3 ? 'none' : 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <ImagePlus size={14} /> Add preview
                    <input
                      className="pf-admin-sr-only"
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp"
                      multiple
                      disabled={accessSampleImages.length >= 3}
                      onChange={(event) => {
                        void addAccessSampleImage([...(event.target.files ?? [])]);
                        event.target.value = '';
                      }}
                    />
                  </label>
                </header>
                {accessImageError ? <p style={{ color: '#dc2626', fontSize: 12, margin: '4px 0 8px' }}>{accessImageError}</p> : null}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {accessSampleImages.map((image, idx) => (
                    <article key={image.id} style={{ width: 100, border: '1px solid #cbd5e1', borderRadius: 6, overflow: 'hidden', background: '#ffffff' }}>
                      <img src={image.dataUrl} alt={image.name} style={{ width: '100%', height: 60, objectFit: 'cover' }} />
                      <div style={{ padding: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 10, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 65 }}>{image.name || `Preview ${idx + 1}`}</span>
                        <button type="button" onClick={() => removeAccessSampleImage(image.id)} style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', padding: 2 }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </article>
                  ))}
                  {accessSampleImages.length < 3 ? (
                    <div style={{ width: 100, height: 80, border: '1px dashed #cbd5e1', borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 11, gap: 4 }}>
                      <ImagePlus size={18} />
                      <span>Upload Preview {accessSampleImages.length + 1}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* 3 Store Section Text Boxes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <header style={{ marginBottom: 4 }}>
                  <strong style={{ fontSize: 13 }}>Store information (3 highlights / text boxes)</strong>
                  <small style={{ display: 'block', color: '#64748b', fontSize: 11 }}>Provide details or key highlights for learners</small>
                </header>

                {accessStoreSections.map((sec, idx) => (
                  <div key={sec.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, background: '#ffffff', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#475569' }}>Section {idx + 1}</div>
                    <input
                      style={{ fontSize: 12.5, padding: '6px 10px', borderRadius: 4, border: '1px solid #cbd5e1' }}
                      value={sec.heading}
                      onChange={(e) => updateAccessStoreSection(idx, { heading: e.target.value })}
                      placeholder={`Section ${idx + 1} Heading (e.g. What you'll learn)`}
                    />
                    <textarea
                      rows={2}
                      style={{ fontSize: 12, padding: '6px 10px', borderRadius: 4, border: '1px solid #cbd5e1' }}
                      value={sec.content}
                      onChange={(e) => updateAccessStoreSection(idx, { content: e.target.value })}
                      placeholder={`Section ${idx + 1} Content details...`}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {target?.kind === 'folder' ? (
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 8, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={applyToChildren}
                onChange={(e) => setApplyToChildren(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.4 }}>
                <strong>Apply to nested contents</strong>
                <br />
                Also convert all subfolders and files inside this folder to {accessTypeDraft === 'PAID' ? `Paid (₹${accessPriceDraft || '0'})` : 'Free'}.
              </span>
            </label>
          ) : null}
        </div>
      </AdminDialog>

      {/* Create Folder Dialog */}
      <AdminDialog
        open={dialog === 'create'}
        onClose={() => setDialog(null)}
        title="New folder"
        description="Add another level anywhere in your content hierarchy."
        size="small"
        footer={
          <>
            <button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={() => setDialog(null)}>Cancel</button>
            <button className="pf-admin-button" type="button" onClick={() => void submitDialog()} disabled={!name.trim() || submittingFolder}>
              {submittingFolder ? 'Creating…' : 'Create'}
            </button>
          </>
        }
      >
        <label className="pf-admin-field">
          <span>Folder name</span>
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter' && name.trim() && !submittingFolder) void submitDialog(); }}
            placeholder="e.g. Module 1 — Auditing Standards"
          />
        </label>
      </AdminDialog>

      {/* Rename Dialog */}
      <AdminDialog open={dialog === 'rename'} onClose={() => setDialog(null)} title="Rename item" description="File extensions are preserved automatically." size="small" footer={<><button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={() => setDialog(null)}>Cancel</button><button className="pf-admin-button" type="button" onClick={() => void submitDialog()} disabled={!name.trim()}>Rename</button></>}><label className="pf-admin-field"><span>New name</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} /></label></AdminDialog>

      {/* Delete Dialog */}
      <AdminDialog open={dialog === 'delete'} onClose={() => setDialog(null)} title={`Delete ${actionIds.length === 1 ? 'item' : `${actionIds.length} items`}?`} description={summary ? `This folder contains ${summary.folders} nested folders and ${summary.files} files (${formatBytes(summary.totalSize)}). Its complete subtree will be deleted.` : 'This action removes the selected content and cannot be undone.'} size="small" footer={<><button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={() => setDialog(null)}>Cancel</button><button className="pf-admin-button pf-admin-button--danger" type="button" onClick={() => void submitDialog()}>Delete</button></>}><div className="pf-content-delete-note"><Trash2 /><p>Review the selection carefully before continuing.</p></div></AdminDialog>

      {/* Move / Copy Dialog */}
      <AdminDialog open={dialog === 'move' || dialog === 'copy'} onClose={() => setDialog(null)} title={dialog === 'move' ? 'Move to' : 'Copy to'} description="Choose a destination. Invalid circular destinations are safely rejected." size="medium" footer={<><button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={() => setDialog(null)}>Cancel</button><button className="pf-admin-button" type="button" onClick={() => void submitDialog()}>{dialog === 'move' ? 'Move here' : 'Copy here'}</button></>}><FolderPicker folders={folders} destination={destination} onChange={setDestination} /></AdminDialog>

      {/* Unsaved Changes Confirmation Modal for Course Switch */}
      <AdminDialog
        open={Boolean(pendingCourseSwitch)}
        onClose={() => setPendingCourseSwitch(null)}
        title="Discard unsaved changes?"
        description="You have unsaved changes to the page heading. Changing course now will discard them."
        size="small"
        footer={
          <>
            <button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={() => setPendingCourseSwitch(null)}>
              Cancel
            </button>
            <button className="pf-admin-button pf-admin-button--danger" type="button" onClick={() => void confirmCourseSwitch()}>
              Discard & Switch
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 8, backgroundColor: '#fef2f2', border: '1px solid #fca5a5' }}>
          <Lock size={20} color="#dc2626" />
          <p style={{ margin: 0, fontSize: 13, color: '#991b1b' }}>
            The current draft heading <strong>“{headingDraft}”</strong> will be lost if you switch courses without saving.
          </p>
        </div>
      </AdminDialog>

      <PreviewDialog item={dialog === 'preview' ? target : null} onClose={() => setDialog(null)} onDownload={downloadItem} />

      <ContentPublishingWorkflow
        open={Boolean(publishingSession)}
        initialFiles={publishingSession?.files ?? []}
        initialMode={publishingSession?.mode ?? 'files'}
        destinationId={publishingSession?.destinationId ?? store.currentFolderId}
        destinationLabel={publishingSession?.destinationLabel ?? currentDestinationLabel}
        onClose={() => setPublishingSession(null)}
        onPublished={(count) => {
          setPublishingSession(null);
          notify('Content published', `${count} file${count === 1 ? '' : 's'} added to the library.`);
        }}
      />

      <AdminToast toasts={toasts} onDismiss={dismissToast} />
    </motion.main>
  );
};

const FolderPicker: React.FC<{ folders: ContentItem[]; destination: string | null; onChange: (id: string | null) => void }> = ({ folders, destination, onChange }) => {
  const ordered = useMemo(() => {
    const result: Array<{ item: ContentItem; depth: number }> = [];
    const visit = (parentId: string | null, depth: number) => folders.filter((folder) => folder.parentId === parentId).sort((a, b) => a.name.localeCompare(b.name)).forEach((item) => { result.push({ item, depth }); visit(item.id, depth + 1); });
    visit(null, 0); return result;
  }, [folders]);
  return <div className="pf-content-folder-picker"><button className={destination === null ? 'is-active' : ''} type="button" onClick={() => onChange(null)}><HardDrive /> My Flow {destination === null ? <Check /> : null}</button>{ordered.map(({ item, depth }) => <button className={destination === item.id ? 'is-active' : ''} style={{ paddingLeft: `${18 + depth * 18}px` }} type="button" key={item.id} onClick={() => onChange(item.id)}><Folder /> <span>{item.name}</span>{destination === item.id ? <Check /> : null}</button>)}</div>;
};

const PreviewDialog: React.FC<{ item: ContentItem | null; onClose: () => void; onDownload: (item: ContentItem) => void }> = ({ item, onClose, onDownload }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!item) { setUrl(null); setLoading(false); return; }
    const source = contentRepository.getFileSource(item.id);
    if (source) {
      const next = URL.createObjectURL(source); setUrl(next); setLoading(false);
      return () => URL.revokeObjectURL(next);
    }
    let active = true;
    setLoading(true);
    apiRequest<{ url: string }>(`/api/admin/content/${encodeURIComponent(item.id)}/preview`)
      .then((res) => {
        if (active && res && res.url) {
          setUrl(res.url);
        }
      })
      .catch(() => {
        // Fallback
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [item?.id]);

  const category = item ? fileCategory(item) : 'other';
  return <AdminDialog open={Boolean(item)} onClose={onClose} title={item?.name ?? 'Preview'} description={item ? `${item.mimeType ?? 'File'} · ${formatBytes(item.size)}` : undefined} size="large" footer={item ? <><button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={onClose}>Close</button><button className="pf-admin-button" type="button" onClick={() => onDownload(item)}><ArrowDownToLine /> Download</button></> : undefined}>
    {loading ? (
      <div className="pf-content-preview-fallback">
        <ItemIcon item={item!} size={58} />
        <h3>Loading preview…</h3>
      </div>
    ) : null}
    {!loading && item && url && category === 'image' ? <img className="pf-content-preview-media" src={url} alt={item.name} /> : null}
    {!loading && item && url && category === 'video' ? <video className="pf-content-preview-media" src={url} controls aria-label={item.name} /> : null}
    {!loading && item && url && category === 'pdf' ? <iframe className="pf-content-preview-frame" src={url} title={item.name} /> : null}
    {!loading && item && (!url || !['image', 'video', 'pdf'].includes(category)) ? <div className="pf-content-preview-fallback"><ItemIcon item={item} size={58} /><h3>Preview is not available</h3><p>{url ? 'This file type is ready to download.' : 'This file could not be retrieved for preview.'}</p></div> : null}
  </AdminDialog>;
};

export default ContentPage;
