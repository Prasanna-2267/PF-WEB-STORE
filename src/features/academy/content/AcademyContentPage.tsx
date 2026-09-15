import { AppSelect } from '@/components/ui/AppSelect';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Archive,
  ArrowDownAZ,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Eye,
  File,
  FileArchive,
  FileImage,
  FileText,
  Filter,
  Folder,
  FolderInput,
  FolderOpen,
  Grid2X2,
  Info,
  List,
  Lock,
  MoreVertical,
  Move,
  Pencil,
  Plus,
  Redo2,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Undo2,
  Upload,
  X,
  Link2,
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useAcademyTenantStore } from '@/app/store/useAcademyTenantStore';
import { fetchAcademyCourses } from '@/features/academy/readOnly/academyReadOnlyApi';
import { academyContentApi, type AcademyContentItem } from '@/features/academy/api/academyAcademicApi';
import {
  ACADEMY_UPLOAD_ACCEPT,
  AcademyContentPublishingWorkflow,
} from './AcademyContentPublishingWorkflow';
import {
  AdminDialog,
  AdminEmptyState,
  AdminPageHeader,
  AdminSkeleton,
  AdminToast,
  type AdminToastData,
} from '@/features/admin/AdminUi';
import '@/features/admin/admin-pages.css';
import '@/features/admin/content/content.css';
import { ContentAttachedLinksDialog } from '@/features/admin/content/ContentAttachedLinksDialog';
import './academy-content.css';

type Crumb = { id: string | null; name: string };
type ViewMode = 'list' | 'grid';
type ContentFilter = 'all' | 'folders' | 'files' | 'documents' | 'images' | 'media' | 'archives';
type SortField = 'manual' | 'name' | 'updatedAt' | 'createdAt' | 'type' | 'size';
type DialogState =
  | { kind: 'create'; item?: undefined }
  | { kind: 'rename' | 'archive' | 'restore'; item: AcademyContentItem }
  | { kind: 'move' | 'copy'; item?: AcademyContentItem }
  | { kind: 'preview'; item: AcademyContentItem }
  | null;
type Operation =
  | { kind: 'create'; name: string }
  | { kind: 'rename'; item: AcademyContentItem; name: string }
  | { kind: 'archive' | 'restore'; items: AcademyContentItem[] }
  | { kind: 'move' | 'copy'; items: AcademyContentItem[]; parentId: string | null }
  | { kind: 'order'; itemIds: string[] };
type HistoryAction = { label: string; undo: () => Promise<void>; redo: () => Promise<void> };

const ease = [0.22, 1, 0.36, 1] as const;
const validHeading = (value: string) => {
  const normalized = value.trim().toLowerCase().replaceAll('_', ' ');
  return Boolean(normalized && normalized !== 'untitled' && normalized !== 'untitled page');
};
const formatBytes = (bytes: number) => {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** unit).toFixed(unit ? 1 : 0)} ${units[unit]}`;
};
const formatDate = (value: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
const fileCategory = (item: AcademyContentItem): Exclude<ContentFilter, 'all' | 'folders' | 'files'> | 'other' => {
  const mime = item.mimeType ?? '';
  if (mime.startsWith('image/')) return 'images';
  if (mime.startsWith('video/') || mime.startsWith('audio/')) return 'media';
  if (mime.includes('zip')) return 'archives';
  if (mime.includes('pdf') || mime.startsWith('text/')) return 'documents';
  return 'other';
};
const matchesFilter = (item: AcademyContentItem, filter: ContentFilter) => {
  if (filter === 'all') return true;
  if (filter === 'folders') return item.kind === 'FOLDER';
  if (filter === 'files') return item.kind === 'FILE';
  return item.kind === 'FILE' && fileCategory(item) === filter;
};
const filterLabels: Record<ContentFilter, string> = {
  all: 'All content', folders: 'Folders', files: 'Files', documents: 'Documents', images: 'Images', media: 'Media', archives: 'Archives',
};
const compare = (field: SortField, direction: 'asc' | 'desc') => (a: AcademyContentItem, b: AcademyContentItem) => {
  let value = 0;
  if (field === 'manual') value = a.displayOrder - b.displayOrder;
  else if (field === 'name') value = a.name.localeCompare(b.name);
  else if (field === 'type') value = a.kind.localeCompare(b.kind);
  else if (field === 'size') value = a.size - b.size;
  else value = new Date(a[field]).getTime() - new Date(b[field]).getTime();
  return direction === 'asc' ? value : -value;
};
const ItemIcon: React.FC<{ item: AcademyContentItem; size?: number }> = ({ item, size = 20 }) => {
  if (item.kind === 'FOLDER') return <Folder size={size} />;
  if (fileCategory(item) === 'images') return <FileImage size={size} />;
  if (fileCategory(item) === 'archives') return <FileArchive size={size} />;
  if (fileCategory(item) === 'documents') return <FileText size={size} />;
  return <File size={size} />;
};

export const AcademyContentPage: React.FC = () => {
  const { courseId: routedCourseId } = useParams();
  const academyId = useAcademyTenantStore((state) => state.activeAcademyId);
  const academy = useAcademyTenantStore((state) => state.activeAcademy);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const undoRef = useRef<HistoryAction[]>([]);
  const redoRef = useRef<HistoryAction[]>([]);

  const [courseId, setCourseId] = useState(routedCourseId ?? '');
  const [navigation, setNavigation] = useState<Crumb[][]>([[{ id: null, name: 'My Flow' }]]);
  const [navigationIndex, setNavigationIndex] = useState(0);
  const [search, setSearch] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [filter, setFilter] = useState<ContentFilter>('all');
  const [sort, setSort] = useState<{ field: SortField; direction: 'asc' | 'desc' }>({ field: 'manual', direction: 'asc' });
  const [view, setView] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('pf_academy_content_view');
    return saved === 'grid' || saved === 'list' ? saved : 'list';
  });
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [ordering, setOrdering] = useState(false);
  const [orderSelection, setOrderSelection] = useState<string[]>([]);
  const [createMenu, setCreateMenu] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [targetName, setTargetName] = useState('');
  const [destination, setDestination] = useState<string | null>(null);
  const [details, setDetails] = useState<AcademyContentItem | null>(null);
  const [description, setDescription] = useState('');
  const [heading, setHeading] = useState('Untitled Page');
  const [headingInvalid, setHeadingInvalid] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ item: AcademyContentItem; x: number; y: number } | null>(null);
  const [linkTarget, setLinkTarget] = useState<AcademyContentItem | null>(null);
  const [toast, setToast] = useState<AdminToastData | null>(null);
  const [publishingFiles, setPublishingFiles] = useState<File[] | null>(null);
  const [, setHistoryVersion] = useState(0);

  const [dragOverCrumbId, setDragOverCrumbId] = useState<string | null>(null);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [dragOverReorderId, setDragOverReorderId] = useState<string | null>(null);
  const [isExternalDragOver, setIsExternalDragOver] = useState(false);

  useEffect(() => {
    localStorage.setItem('pf_academy_content_view', view);
  }, [view]);

  const crumbs = navigation[navigationIndex] ?? [{ id: null, name: 'My Flow' }];
  const parentId = crumbs[crumbs.length - 1]?.id ?? null;
  const hasValidHeading = validHeading(heading);

  const courses = useQuery({
    queryKey: ['academy', academyId, 'content-courses'],
    queryFn: ({ signal }) => fetchAcademyCourses({ page: 1, limit: 100 }, signal),
    enabled: Boolean(academyId),
  });
  const activeCourses = useMemo(() => courses.data?.items.filter((course) => course.status === 'ACTIVE') ?? [], [courses.data]);
  useEffect(() => {
    if (!courseId && activeCourses[0]) setCourseId(activeCourses[0].id);
  }, [activeCourses, courseId]);

  const contentKey = ['academy', academyId, 'content', courseId, parentId, search, includeArchived] as const;
  const content = useQuery({
    queryKey: contentKey,
    queryFn: ({ signal }) => academyContentApi.list(courseId, search.trim() ? 'all' : parentId, search, includeArchived, signal),
    enabled: Boolean(academyId && courseId),
  });
  const location = useQuery({
    queryKey: ['academy', academyId, 'content-location', courseId, parentId],
    queryFn: ({ signal }) => academyContentApi.location(courseId, parentId, signal),
    enabled: Boolean(academyId && courseId),
  });
  const allFolders = useQuery({
    queryKey: ['academy', academyId, 'content-folders', courseId],
    queryFn: ({ signal }) => academyContentApi.list(courseId, 'all', '', false, signal),
    select: (result) => result.data.filter((item) => item.kind === 'FOLDER'),
    enabled: Boolean(courseId && (dialog?.kind === 'move' || dialog?.kind === 'copy')),
  });

  useEffect(() => { if (location.data) setHeading(location.data.pageHeading); }, [location.data]);
  useEffect(() => {
    const close = () => { setContextMenu(null); setCreateMenu(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', escape); };
  }, []);
  const notify = (title: string, message?: string, tone: AdminToastData['tone'] = 'success') => setToast({ id: Date.now(), title, message, tone });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['academy', academyId, 'content'] }),
      queryClient.invalidateQueries({ queryKey: ['academy', academyId, 'content-folders'] }),
      queryClient.invalidateQueries({ queryKey: ['academy', academyId, 'overview'] }),
    ]);
  };
  const pushHistory = (action: HistoryAction) => {
    undoRef.current.push(action);
    redoRef.current = [];
    setHistoryVersion((value) => value + 1);
  };
  const undo = async () => {
    const action = undoRef.current.pop();
    if (!action) return;
    try { await action.undo(); redoRef.current.push(action); await refresh(); notify('Change undone', action.label); }
    catch (error) { undoRef.current.push(action); notify('Undo failed', error instanceof Error ? error.message : undefined, 'error'); }
    setHistoryVersion((value) => value + 1);
  };
  const redo = async () => {
    const action = redoRef.current.pop();
    if (!action) return;
    try { await action.redo(); undoRef.current.push(action); await refresh(); notify('Change restored', action.label); }
    catch (error) { redoRef.current.push(action); notify('Redo failed', error instanceof Error ? error.message : undefined, 'error'); }
    setHistoryVersion((value) => value + 1);
  };

  const operation = useMutation({
    mutationFn: async (action: Operation) => {
      if (action.kind === 'order') {
        await academyContentApi.updateOrder(courseId, parentId, action.itemIds);
        return action.itemIds;
      }
      if (action.kind === 'create') return academyContentApi.createFolder(courseId, parentId, action.name);
      if (action.kind === 'rename') return academyContentApi.rename(action.item.id, action.name);
      if (action.kind === 'archive') { for (const item of action.items) await academyContentApi.archive(item.id); return action.items; }
      if (action.kind === 'restore') { for (const item of action.items) await academyContentApi.restore(item.id); return action.items; }
      if (action.kind === 'move') { for (const item of action.items) await academyContentApi.move(item.id, action.parentId); return action.items; }
      if (action.kind === 'copy') { for (const item of action.items) await academyContentApi.copy(item.id, action.parentId); return action.items; }
      return action.items;
    },
    onSuccess: async (result, action) => {
      await refresh();
      if (action.kind === 'create') {
        const item = result as AcademyContentItem;
        pushHistory({ label: `Create ${item.name}`, undo: () => academyContentApi.archive(item.id).then(() => undefined), redo: () => academyContentApi.restore(item.id).then(() => undefined) });
      } else if (action.kind === 'rename') {
        const oldName = action.item.name; const newName = action.name; const id = action.item.id;
        pushHistory({ label: `Rename ${oldName}`, undo: () => academyContentApi.rename(id, oldName).then(() => undefined), redo: () => academyContentApi.rename(id, newName).then(() => undefined) });
      } else if (action.kind === 'archive' || action.kind === 'restore') {
        const items = action.items;
        pushHistory({ label: `${action.kind} ${items.length} item(s)`, undo: async () => { for (const item of items) await (action.kind === 'archive' ? academyContentApi.restore(item.id) : academyContentApi.archive(item.id)); }, redo: async () => { for (const item of items) await (action.kind === 'archive' ? academyContentApi.archive(item.id) : academyContentApi.restore(item.id)); } });
      } else if (action.kind === 'move') {
        const previous = new Map(action.items.map((item) => [item.id, item.parentId])); const next = action.parentId;
        pushHistory({ label: `Move ${action.items.length} item(s)`, undo: async () => { for (const item of action.items) await academyContentApi.move(item.id, previous.get(item.id) ?? null); }, redo: async () => { for (const item of action.items) await academyContentApi.move(item.id, next); } });
      } else if (action.kind === 'order') {
        const previous = sortedItems.map((item) => item.id); const next = action.itemIds;
        pushHistory({ label: 'Reorder content', undo: () => academyContentApi.updateOrder(courseId, parentId, previous).then(() => undefined), redo: () => academyContentApi.updateOrder(courseId, parentId, next).then(() => undefined) });
      }
      setDialog(null); setTargetName(''); setSelected([]); setSelectMode(false); setOrdering(false); setOrderSelection([]);
      notify(action.kind === 'archive' ? 'Content deleted' : action.kind === 'restore' ? 'Content restored' : action.kind === 'move' ? 'Content moved' : action.kind === 'copy' ? 'Content copied' : action.kind === 'order' ? 'Order saved' : 'Content saved', action.kind === 'copy' && (result as Array<unknown>).some?.((value: any) => value?.accepted) ? 'A folder copy job was accepted and will finish in the background.' : 'The Academy backend confirmed the change.');
    },
    onError: (error) => notify('Change failed', error instanceof Error ? error.message : 'The server rejected the request.', 'error'),
  });

  const headingMutation = useMutation({
    mutationFn: () => academyContentApi.updateLocation(courseId, parentId, heading.trim()),
    onSuccess: async () => {
      setHeadingInvalid(false);
      await queryClient.invalidateQueries({ queryKey: ['academy', academyId, 'content-location', courseId, parentId] });
      notify('Page heading saved', 'Folders and uploads are enabled for this location.');
    },
    onError: (error) => notify('Heading not saved', error instanceof Error ? error.message : undefined, 'error'),
  });

  const detailsMutation = useMutation({
    mutationFn: () => {
      if (!details) return Promise.reject(new Error('No content selected.'));
      return academyContentApi.update(details.id, { description });
    },
    onSuccess: async (item) => { setDetails(item); await refresh(); notify('Details saved'); },
    onError: (error) => notify('Details not saved', error instanceof Error ? error.message : undefined, 'error'),
  });

  const rawItems = content.data?.data ?? [];
  const sortedItems = useMemo(() => [...rawItems].filter((item) => matchesFilter(item, filter)).sort(compare(sort.field, sort.direction)), [rawItems, filter, sort]);
  const selectedItems = sortedItems.filter((item) => selected.includes(item.id));
  const folderOptions = useMemo(() => {
    const all = allFolders.data ?? [];
    const result: Array<{ item: AcademyContentItem; depth: number }> = [];
    const visit = (id: string | null, depth: number) => all.filter((item) => item.parentId === id).sort((a, b) => a.name.localeCompare(b.name)).forEach((item) => { result.push({ item, depth }); visit(item.id, depth + 1); });
    visit(null, 0); return result;
  }, [allFolders.data]);

  const navigate = (next: Crumb[]) => {
    setNavigation((entries) => [...entries.slice(0, navigationIndex + 1), next]);
    setNavigationIndex((value) => value + 1);
    setSearch(''); setSelected([]);
  };
  const resetCourse = (nextCourseId: string) => {
    setCourseId(nextCourseId); setNavigation([[{ id: null, name: 'My Flow' }]]); setNavigationIndex(0);
    setSearch(''); setSelected([]); setOrdering(false); setOrderSelection([]); setDetails(null);
    undoRef.current = []; redoRef.current = []; setHistoryVersion((value) => value + 1);
  };
  const requireHeading = () => {
    if (hasValidHeading) return true;
    setHeadingInvalid(true); notify('Name this page first', 'A valid page heading is required before creating Academy content.', 'error');
    return false;
  };
  const stageUpload = (files: File[]) => {
    if (!files.length || !requireHeading()) return;
    setCreateMenu(false);
    setPublishingFiles(files);
  };
  const setFolderInput = (node: HTMLInputElement | null) => {
    folderInputRef.current = node;
    if (!node) return;
    node.setAttribute('webkitdirectory', '');
    node.setAttribute('directory', '');
    (node as HTMLInputElement & { webkitdirectory?: boolean }).webkitdirectory = true;
  };
  const startDialog = (kind: Exclude<NonNullable<DialogState>['kind'], 'preview'>, item?: AcademyContentItem) => {
    if (kind === 'create' && !requireHeading()) return;
    setCreateMenu(false); setDestination(null);
    if (kind === 'create') { setTargetName(''); setDialog({ kind }); return; }
    if (kind === 'rename' || kind === 'archive' || kind === 'restore') {
      const target = item ?? selectedItems[0]; if (!target) return;
      setTargetName(target.name); setDialog({ kind, item: target }); return;
    }
    setDialog({ kind, item });
  };
  const itemsForDialog = dialog?.kind === 'move' || dialog?.kind === 'copy'
    ? (dialog.item && !selected.includes(dialog.item.id) ? [dialog.item] : selectedItems)
    : dialog?.kind === 'archive' || dialog?.kind === 'restore' ? (selected.includes(dialog.item.id) ? selectedItems : [dialog.item]) : [];
  const submitDialog = () => {
    if (!dialog) return;
    if (dialog.kind === 'create') operation.mutate({ kind: 'create', name: targetName.trim() });
    else if (dialog.kind === 'rename') operation.mutate({ kind: 'rename', item: dialog.item, name: targetName.trim() });
    else if (dialog.kind === 'archive' || dialog.kind === 'restore') operation.mutate({ kind: dialog.kind, items: itemsForDialog });
    else if (dialog.kind === 'move' || dialog.kind === 'copy') operation.mutate({ kind: dialog.kind, items: itemsForDialog, parentId: destination });
  };
  const openItem = (item: AcademyContentItem) => {
    if (item.status === 'ARCHIVED') return;
    if (item.kind === 'FOLDER') navigate([...crumbs, { id: item.id, name: item.name }]);
    else void preview(item);
  };
  const preview = async (item: AcademyContentItem) => {
    setPreviewUrl(null); setDialog({ kind: 'preview', item });
    try { const result = await academyContentApi.access(item.id, 'preview'); setPreviewUrl(result.url); }
    catch (error) { setDialog(null); notify('Preview unavailable', error instanceof Error ? error.message : undefined, 'error'); }
  };
  const download = async (item: AcademyContentItem) => {
    if (item.kind === 'FOLDER') return;
    try {
      const result = await academyContentApi.access(item.id, 'download');
      const link = document.createElement('a'); link.href = result.url; link.download = item.name; link.rel = 'noopener'; link.click();
    } catch (error) { notify('Download unavailable', error instanceof Error ? error.message : undefined, 'error'); }
  };
  const showDetails = async (item: AcademyContentItem) => {
    try {
      const result = await academyContentApi.get(item.id);
      setDetails(result);
      setDescription(result.description ?? '');
    }
    catch (error) { notify('Details unavailable', error instanceof Error ? error.message : undefined, 'error'); }
  };
  const context = (event: React.MouseEvent, item: AcademyContentItem) => {
    event.preventDefault(); event.stopPropagation();
    setContextMenu({ item, x: Math.min(event.clientX, window.innerWidth - 245), y: Math.min(event.clientY, window.innerHeight - 330) });
  };

  const dropIntoBreadcrumb = async (event: React.DragEvent, targetFolderId: string | null, targetName: string) => {
    event.preventDefault();
    setDragOverCrumbId(null);
    const rawData = event.dataTransfer.getData('application/x-parallax-content');
    const internalIds = rawData ? rawData.split(',').filter(Boolean) : (draggedItemId ? [draggedItemId] : []);
    if (internalIds.length) {
      const itemsToMove = sortedItems.filter((i) => internalIds.includes(i.id));
      if (itemsToMove.length) {
        operation.mutate({ kind: 'move', items: itemsToMove, parentId: targetFolderId });
        notify('Items moved', `Moved ${itemsToMove.length} item${itemsToMove.length === 1 ? '' : 's'} to ${targetName}.`);
        setSelected([]);
      }
    }
  };

  const dropIntoFolderRow = async (event: React.DragEvent, folder: AcademyContentItem) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOverFolderId(null);
    const rawData = event.dataTransfer.getData('application/x-parallax-content');
    const internalIds = rawData ? rawData.split(',').filter(Boolean) : (draggedItemId ? [draggedItemId] : []);
    if (internalIds.length) {
      const itemsToMove = sortedItems.filter((i) => internalIds.includes(i.id) && i.id !== folder.id);
      if (itemsToMove.length) {
        operation.mutate({ kind: 'move', items: itemsToMove, parentId: folder.id });
        notify('Items moved', `Moved ${itemsToMove.length} item${itemsToMove.length === 1 ? '' : 's'} to ${folder.name}.`);
        setSelected([]);
      }
    }
  };

  const handleReorderDrop = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const currentIds = sortedItems.map((item) => item.id);
    const fromIndex = currentIds.indexOf(sourceId);
    const toIndex = currentIds.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    const nextIds = [...currentIds];
    const [moved] = nextIds.splice(fromIndex, 1);
    nextIds.splice(toIndex, 0, moved);
    operation.mutate({ kind: 'order', itemIds: nextIds });
  };

  if (courses.isLoading) return <AdminSkeleton label="Loading Academy content" rows={6} variant="detail" />;
  return (
    <motion.div className="pf-admin-page pf-content pf-academy-content" initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease }}>
      <AdminPageHeader
        eyebrow="ACADEMIC RESOURCES"
        title="Content"
        description={`Manage Drive-style course files and folders for ${academy?.name ?? 'your Academy'}. Only this Academy's courses and content are available here.`}
        actions={<label className="pf-academy-content-course"><span>CHOOSE COURSE</span><AppSelect className="pf-admin-select" value={courseId} onChange={(event) => resetCourse(event.target.value)}><option value="">Select an active course</option>{activeCourses.map((course) => <option key={course.id} value={course.id}>{course.code} — {course.name}</option>)}</AppSelect></label>}
      />

      <input ref={fileInputRef} hidden multiple type="file" accept={ACADEMY_UPLOAD_ACCEPT} onChange={(event) => { stageUpload(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = ''; }} />
      <input ref={setFolderInput} hidden multiple type="file" onChange={(event) => { stageUpload(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = ''; }} />

      <section
        className={`pf-content-browser${isExternalDragOver ? ' is-drag-over' : ''}`}
        style={{ position: 'relative' }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            setIsExternalDragOver(true);
          }
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setIsExternalDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsExternalDragOver(false);
          const files = Array.from(e.dataTransfer.files);
          if (files.length) stageUpload(files);
        }}
      >
        {isExternalDragOver ? (
          <div className="pf-content-drop-overlay">
            <div className="pf-content-drop-overlay__card">
              <Upload size={44} />
              <h3>Drop files to publish</h3>
              <p>Files will be staged into <strong>{heading || 'this location'}</strong>.</p>
            </div>
          </div>
        ) : null}

        <div className={`pf-content-page-identity${headingInvalid ? ' is-invalid' : ''}`}>
          <label>PAGE HEADING</label>
          <div className="pf-academy-content-heading-row">
            <input value={heading} maxLength={160} disabled={!courseId} onChange={(event) => { setHeading(event.target.value); setHeadingInvalid(false); }} onBlur={(e) => { const related = e.relatedTarget as HTMLElement | null; if (related && related.tagName === 'BUTTON') return; if (validHeading(heading) && heading.trim() !== location.data?.pageHeading && !headingMutation.isPending) headingMutation.mutate(); }} placeholder="Untitled Page" aria-label="Page heading" />
            <span className={hasValidHeading ? 'is-ready' : 'is-locked'}>{hasValidHeading ? <><Check /> READY</> : <><Lock /> UNNAMED PAGE (LOCKED)</>}</span>
            <button className="pf-admin-button pf-admin-button--secondary" type="button" disabled={!hasValidHeading || headingMutation.isPending || heading.trim() === location.data?.pageHeading} onClick={() => headingMutation.mutate()}>{headingMutation.isPending ? 'Saving…' : 'Save'}</button>
          </div>
          {!hasValidHeading ? <p className="pf-academy-content-lock-note">Content creation is locked until you give this library a valid page heading.</p> : null}
          <nav className="pf-content-full-path" aria-label="Content path">
            <FolderOpen />
            {crumbs.map((crumb, index) => {
              const isCrumbTarget = dragOverCrumbId === (crumb.id ?? 'root');
              return (
                <React.Fragment key={`${crumb.id ?? 'root'}-${index}`}>
                  {index ? <ChevronRight /> : null}
                  <button
                    type="button"
                    aria-current={index === crumbs.length - 1 ? 'page' : undefined}
                    className={isCrumbTarget ? 'is-drag-target' : undefined}
                    onClick={() => index < crumbs.length - 1 && navigate(crumbs.slice(0, index + 1))}
                    onDragOver={(e) => {
                      if (index < crumbs.length - 1) {
                        e.preventDefault();
                        setDragOverCrumbId(crumb.id ?? 'root');
                      }
                    }}
                    onDragLeave={() => setDragOverCrumbId(null)}
                    onDrop={(e) => index < crumbs.length - 1 && void dropIntoBreadcrumb(e, crumb.id, crumb.name)}
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
            <button type="button" disabled={navigationIndex <= 0} onClick={() => { setNavigationIndex((value) => value - 1); setSearch(''); }} aria-label="Back"><ArrowLeft /></button>
            <button type="button" disabled={navigationIndex >= navigation.length - 1} onClick={() => { setNavigationIndex((value) => value + 1); setSearch(''); }} aria-label="Forward"><ArrowRight /></button>
            <button type="button" disabled={!courseId} onClick={() => void content.refetch()} aria-label="Refresh"><RefreshCw /></button>
            <button type="button" disabled={!undoRef.current.length || operation.isPending} onClick={() => void undo()} title="Undo" aria-label="Undo"><Undo2 /></button>
            <button type="button" disabled={!redoRef.current.length || operation.isPending} onClick={() => void redo()} title="Redo" aria-label="Redo"><Redo2 /></button>
          </div>
          <div className="pf-content-search-group">
            <label className="pf-content-search"><Search /><input value={search} disabled={!courseId} onChange={(event) => setSearch(event.target.value)} placeholder="Search all Academy content" />{search ? <button type="button" onClick={() => setSearch('')} aria-label="Clear search"><X /></button> : null}</label>
            <details className="pf-content-filter">
              <summary><Filter /><span>{filterLabels[filter]}</span><ChevronDown /></summary>
              <div>
                <fieldset><legend>Content type</legend>{(Object.keys(filterLabels) as ContentFilter[]).map((value) => <button key={value} className={filter === value ? 'is-active' : ''} type="button" onClick={() => setFilter(value)}>{filter === value ? <Check /> : <span />}{filterLabels[value]}</button>)}</fieldset>
                <fieldset><legend>Sort</legend>{([['manual', 'Saved order'], ['name', 'Name'], ['updatedAt', 'Modified'], ['createdAt', 'Created'], ['type', 'Type'], ['size', 'Size']] as Array<[SortField, string]>).map(([value, label]) => <button key={value} className={sort.field === value ? 'is-active' : ''} type="button" onClick={() => setSort((current) => ({ ...current, field: value }))}>{sort.field === value ? <Check /> : <span />}{label}</button>)}<button type="button" onClick={() => setSort((current) => ({ ...current, direction: current.direction === 'asc' ? 'desc' : 'asc' }))}><ArrowDownAZ />{sort.direction === 'asc' ? 'Ascending' : 'Descending'}</button></fieldset>
              </div>
            </details>
          </div>
          <div className="pf-content-view-actions">
            <button className={selectMode ? 'is-active' : ''} type="button" onClick={() => { setSelectMode((value) => !value); setSelected([]); }} disabled={!courseId} aria-label="Select content"><CheckSquare /></button>
            {ordering ? <button className="pf-content-order-cancel" type="button" onClick={() => { setOrdering(false); setOrderSelection([]); }}>Cancel</button> : null}
            <button className={`pf-content-order-button${ordering ? ' is-active' : ''}`} type="button" disabled={!hasValidHeading || operation.isPending || !sortedItems.length} onClick={() => ordering ? operation.mutate({ kind: 'order', itemIds: [...orderSelection, ...sortedItems.map((item) => item.id).filter((id) => !orderSelection.includes(id))] }) : (setOrdering(true), setOrderSelection([]))}>{ordering ? <Check /> : <ArrowDownAZ />}<span>{ordering ? 'Save' : 'Order File'}</span></button>
            <div role="group"><button className={view === 'list' ? 'is-active' : ''} type="button" onClick={() => setView('list')} aria-label="List view"><List /></button><button className={view === 'grid' ? 'is-active' : ''} type="button" onClick={() => setView('grid')} aria-label="Grid view"><Grid2X2 /></button></div>
            <div className="pf-content-new-wrap" onPointerDown={(event) => event.stopPropagation()}>
              <button className="pf-content-new-btn" type="button" disabled={!courseId || !hasValidHeading || operation.isPending || Boolean(publishingFiles)} onClick={() => { if (requireHeading()) setCreateMenu((value) => !value); }}><Plus /> New <ChevronDown /></button>
              <AnimatePresence>{createMenu ? <motion.div className="pf-content-create-menu" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
                <button type="button" onClick={() => startDialog('create')}><FolderOpen /><span><strong>New folder</strong><small>Create a structured level</small></span></button>
                <button type="button" onClick={() => fileInputRef.current?.click()}><Upload /><span><strong>Upload files</strong><small>PDF, media or documents</small></span></button>
                <button type="button" onClick={() => folderInputRef.current?.click()}><FolderInput /><span><strong>Upload folder</strong><small>Keep its nested structure</small></span></button>
              </motion.div> : null}</AnimatePresence>
            </div>
          </div>
        </header>

        {ordering ? <div className="pf-content-ordering-bar"><span><ArrowDownAZ /> Click files and folders in the exact sequence you want.</span><strong>{orderSelection.length} of {sortedItems.length} ordered</strong></div> : null}
        {(selected.length || selectMode) && !ordering ? <div className="pf-content-selection"><button type="button" onClick={() => { setSelected([]); setSelectMode(false); }}><X /></button><strong>{selected.length} selected</strong><button type="button" onClick={() => setSelected(selected.length === sortedItems.length ? [] : sortedItems.map((item) => item.id))}>{selected.length === sortedItems.length ? 'Deselect all' : 'Select all'}</button><span /><button type="button" disabled={!selected.length} onClick={() => startDialog('move')}><Move /> Move</button><button type="button" disabled={!selected.length} onClick={() => startDialog('copy')}><Copy /> Copy</button>{selectedItems.length === 1 ? <button type="button" onClick={() => void showDetails(selectedItems[0])}><Info /> Details</button> : null}<button className="is-danger" type="button" disabled={!selected.length} onClick={() => startDialog('archive')}><Trash2 /> Delete</button></div> : null}
        {search.trim() ? <div className="pf-content-search-caption"><Search /><span>Results across this Academy course for <strong>“{search.trim()}”</strong></span><small>{sortedItems.length} found</small></div> : null}

        {content.isLoading ? <AdminSkeleton label="Loading Academy content" rows={6} /> : content.error ? <AdminEmptyState title="Content could not be loaded" description={content.error instanceof Error ? content.error.message : 'The server could not load this Academy folder.'} action={<button className="pf-admin-button" type="button" onClick={() => void content.refetch()}>Try again</button>} /> : !courseId ? <AdminEmptyState icon={<FolderOpen />} title="Select an Academy course" description="Only courses owned by the current Academy are available in this Drive." /> : !sortedItems.length ? <AdminEmptyState icon={hasValidHeading ? <FolderOpen /> : <Lock />} title={search || filter !== 'all' ? 'No matching content' : hasValidHeading ? 'This folder is ready' : 'Unnamed Page'} description={search || filter !== 'all' ? 'Try a broader search or content type.' : hasValidHeading ? 'Create a folder or upload files to begin.' : 'Content creation is locked. Name this page heading above to enable folders and file uploads.'} action={hasValidHeading && !search && filter === 'all' ? <button className="pf-admin-button" type="button" onClick={() => startDialog('create')}>Create folder</button> : undefined} /> : (
          <div className={`pf-content-items pf-content-items--${view}`} role="grid">
            {view === 'list' ? <div className="pf-content-list-head" role="row"><span>Name</span><span>Type</span><span>Modified</span><span>Size</span><span /></div> : null}
            {sortedItems.map((item, index) => {
              const orderIndex = orderSelection.indexOf(item.id);
              const isFolderTarget = dragOverFolderId === item.id;
              const isReorderTarget = dragOverReorderId === item.id;
              return <motion.article
                layout="position"
                key={item.id}
                className={`${selected.includes(item.id) ? 'is-selected ' : ''}${ordering ? 'is-ordering ' : ''}${orderIndex >= 0 ? 'is-ordered ' : ''}${item.status === 'ARCHIVED' ? 'is-archived ' : ''}${isFolderTarget ? 'is-drag-target ' : ''}${isReorderTarget ? 'is-reorder-target' : ''}`}
                role="row"
                tabIndex={0}
                draggable={!ordering}
                onDragStart={(event) => {
                  setDraggedItemId(item.id);
                  const dragIds = selected.includes(item.id) ? selected : [item.id];
                  (event as unknown as DragEvent).dataTransfer?.setData('application/x-parallax-content', dragIds.join(','));
                }}
                onDragOver={(event) => {
                  if (item.kind === 'FOLDER' && draggedItemId !== item.id && !selected.includes(item.id)) {
                    event.preventDefault();
                    setDragOverFolderId(item.id);
                  } else if (draggedItemId && draggedItemId !== item.id) {
                    event.preventDefault();
                    setDragOverReorderId(item.id);
                  }
                }}
                onDragLeave={() => {
                  setDragOverFolderId(null);
                  setDragOverReorderId(null);
                }}
                onDrop={(event) => {
                  setDragOverFolderId(null);
                  setDragOverReorderId(null);
                  if (item.kind === 'FOLDER' && draggedItemId !== item.id && !selected.includes(item.id)) {
                    void dropIntoFolderRow(event, item);
                  } else if (draggedItemId && draggedItemId !== item.id) {
                    handleReorderDrop(draggedItemId, item.id);
                  }
                }}
                onClick={(event) => { if (ordering) setOrderSelection((items) => items.includes(item.id) ? items.filter((id) => id !== item.id) : [...items, item.id]); else if (selectMode) setSelected((items) => event.ctrlKey || event.metaKey ? (items.includes(item.id) ? items.filter((id) => id !== item.id) : [...items, item.id]) : [item.id]); }}
                onDoubleClick={() => !ordering && !selectMode && openItem(item)}
                onKeyDown={(event) => { if (event.key === 'Enter' && !ordering) openItem(item); }}
                onContextMenu={(event) => !ordering && context(event, item)}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: .18, delay: Math.min(index * .018, .12), ease }}
              >
                {ordering ? <span className="pf-content-order-index">{orderIndex >= 0 ? orderIndex + 1 : <Plus />}</span> : null}
                <span className={`pf-content-item-icon pf-content-item-icon--${item.kind === 'FOLDER' ? 'folder' : 'file'}`}><ItemIcon item={item} size={view === 'grid' ? 27 : 19} /></span>
                <div className="pf-content-item-name"><strong>{item.name}</strong><small>{item.status === 'ARCHIVED' ? 'Archived' : item.entityType?.replaceAll('_', ' ').toLowerCase() ?? (item.kind === 'FOLDER' ? 'Folder' : 'Academy file')}</small></div>
                <span className="pf-content-owner">{item.kind === 'FOLDER' ? 'Folder' : item.mimeType ?? 'File'}</span>
                <time dateTime={item.updatedAt}>{formatDate(item.updatedAt)}</time>
                <span className="pf-content-size">{item.kind === 'FILE' ? formatBytes(item.size) : '—'}</span>
                <button className="pf-content-more" type="button" onClick={(event) => context(event, item)} disabled={ordering} aria-label={`More actions for ${item.name}`}><MoreVertical /></button>
              </motion.article>;
            })}
          </div>
        )}
      </section>

      {contextMenu ? <div className="pf-content-context" style={{ left: contextMenu.x, top: contextMenu.y }} onPointerDown={(event) => event.stopPropagation()}>
        {contextMenu.item.status === 'PUBLISHED' ? <>{contextMenu.item.kind === 'FILE' ? <><button type="button" onClick={() => void preview(contextMenu.item)}><Eye /> Preview</button><button type="button" onClick={() => void download(contextMenu.item)}><Download /> Download</button></> : <button type="button" onClick={() => openItem(contextMenu.item)}><FolderOpen /> Open</button>}<hr /><button type="button" onClick={() => startDialog('rename', contextMenu.item)}><Pencil /> Rename</button><button type="button" onClick={() => { setLinkTarget(contextMenu.item); setContextMenu(null); }}><Link2 /> Attach Link</button><button type="button" onClick={() => startDialog('move', contextMenu.item)}><Move /> Move</button><button type="button" onClick={() => startDialog('copy', contextMenu.item)}><Copy /> Copy</button><button type="button" onClick={() => void showDetails(contextMenu.item)}><Info /> Details</button><hr /><button className="is-danger" type="button" onClick={() => startDialog('archive', contextMenu.item)}><Trash2 /> Delete</button></> : <button type="button" onClick={() => startDialog('restore', contextMenu.item)}><RotateCcw /> Restore</button>}
      </div> : null}

      <ContentAttachedLinksDialog
        open={Boolean(linkTarget)}
        contentId={linkTarget?.id ?? null}
        contentName={linkTarget?.name ?? ''}
        apiBase="/api/academy/content"
        onClose={() => setLinkTarget(null)}
      />

      <AnimatePresence>{details ? <motion.aside className="pf-content-details" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
        <header><div><ItemIcon item={details} /><strong>{details.name}</strong></div><button type="button" onClick={() => setDetails(null)}><X /></button></header>
        <div className="pf-content-details__preview"><ItemIcon item={details} size={48} /></div>
        <dl><div><dt>Type</dt><dd>{details.kind === 'FOLDER' ? 'Folder' : details.mimeType ?? 'File'}</dd></div><div><dt>Size</dt><dd>{details.kind === 'FILE' ? formatBytes(details.size) : '—'}</dd></div><div><dt>Location</dt><dd>{crumbs.map((crumb) => crumb.name).join(' / ')}</dd></div><div><dt>Owner</dt><dd>{academy?.name ?? 'Current Academy'}</dd></div><div><dt>Status</dt><dd>{details.status}</dd></div><div><dt>Modified</dt><dd>{formatDate(details.updatedAt)}</dd></div><div><dt>Created</dt><dd>{formatDate(details.createdAt)}</dd></div></dl>
        <label><span>Description</span><textarea rows={5} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Add description" /></label>
        <button className="pf-admin-button" type="button" disabled={detailsMutation.isPending} onClick={() => detailsMutation.mutate()}>{detailsMutation.isPending ? 'Saving…' : 'Save details'}</button>
      </motion.aside> : null}</AnimatePresence>

      <AdminDialog open={Boolean(dialog && dialog.kind !== 'preview')} onClose={() => !operation.isPending && setDialog(null)} title={dialog?.kind === 'create' ? 'Create folder' : dialog?.kind === 'rename' ? 'Rename content' : dialog?.kind === 'archive' ? 'Delete content?' : dialog?.kind === 'restore' ? 'Restore content?' : dialog?.kind === 'move' ? 'Move content' : 'Copy content'} description={dialog?.kind === 'archive' ? 'Are you sure you want to delete the selected item(s)? This action cannot be undone.' : dialog?.kind === 'restore' ? 'The selected item(s) will return to this Academy library.' : dialog?.kind === 'move' || dialog?.kind === 'copy' ? 'Choose a destination inside the same Academy course.' : 'Use a clear academic name.'} size="small" footer={<><button className="pf-admin-button pf-admin-button--quiet" type="button" disabled={operation.isPending} onClick={() => setDialog(null)}>Cancel</button><button className={`pf-admin-button ${dialog?.kind === 'archive' ? 'pf-admin-button--danger' : 'pf-admin-button--primary'}`} type="button" disabled={operation.isPending || ((dialog?.kind === 'create' || dialog?.kind === 'rename') && !targetName.trim()) || ((dialog?.kind === 'move' || dialog?.kind === 'copy') && !itemsForDialog.length)} onClick={submitDialog}>{operation.isPending ? 'Working…' : dialog?.kind === 'archive' ? 'Delete' : dialog?.kind === 'restore' ? 'Restore' : dialog?.kind === 'move' ? 'Move here' : dialog?.kind === 'copy' ? 'Copy here' : 'Save'}</button></>}>
        {dialog?.kind === 'create' || dialog?.kind === 'rename' ? <label className="pf-admin-field"><span>Name</span><input autoFocus className="pf-admin-input" maxLength={180} value={targetName} onChange={(event) => setTargetName(event.target.value)} /></label> : null}
        {dialog?.kind === 'move' || dialog?.kind === 'copy' ? <div className="pf-content-folder-picker"><button type="button" className={destination === null ? 'is-active' : ''} onClick={() => setDestination(null)}><FolderOpen /><span>My Flow</span>{destination === null ? <Check /> : null}</button>{folderOptions.filter(({ item }) => !itemsForDialog.some((target) => target.id === item.id)).map(({ item, depth }) => <button type="button" key={item.id} className={destination === item.id ? 'is-active' : ''} style={{ paddingLeft: 12 + depth * 18 }} onClick={() => setDestination(item.id)}><Folder /><span>{item.name}</span>{destination === item.id ? <Check /> : null}</button>)}</div> : null}
      </AdminDialog>

      <AdminDialog open={dialog?.kind === 'preview'} onClose={() => setDialog(null)} title={dialog?.kind === 'preview' ? dialog.item.name : 'Preview'} size="large" footer={dialog?.kind === 'preview' ? <><button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={() => setDialog(null)}>Close</button><button className="pf-admin-button pf-admin-button--primary" type="button" onClick={() => void download(dialog.item)}><ArrowDownToLine /> Download</button></> : null}>
        {dialog?.kind === 'preview' ? !previewUrl ? <AdminSkeleton label="Preparing signed preview" rows={3} /> : dialog.item.mimeType?.startsWith('image/') ? <img className="pf-content-preview-media" src={previewUrl} alt={dialog.item.name} /> : dialog.item.mimeType?.startsWith('video/') ? <video className="pf-content-preview-media" controls src={previewUrl} /> : dialog.item.mimeType?.startsWith('audio/') ? <audio controls src={previewUrl} style={{ width: '100%' }} /> : <iframe className="pf-content-preview-frame" src={previewUrl} title={dialog.item.name} /> : null}
      </AdminDialog>

      {publishingFiles ? <AcademyContentPublishingWorkflow
        open
        files={publishingFiles}
        courseId={courseId}
        destinationId={parentId}
        destinationLabel={crumbs.map((crumb) => crumb.name).join(' / ')}
        destinationHeading={heading}
        onClose={() => setPublishingFiles(null)}
        onPublished={async (count) => {
          await refresh();
          notify('Upload complete', `${count} Academy file${count === 1 ? '' : 's'} published with backend-confirmed tenant ownership.`);
        }}
      /> : null}
      <AdminToast toast={toast} onDismiss={() => setToast(null)} />
    </motion.div>
  );
};

export default AcademyContentPage;
