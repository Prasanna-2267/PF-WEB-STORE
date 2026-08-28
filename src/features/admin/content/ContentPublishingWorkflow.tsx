import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  Files,
  Folder,
  FolderInput,
  ImagePlus,
  LoaderCircle,
  LockKeyhole,
  Plus,
  ShoppingBag,
  Trash2,
  Upload,
} from 'lucide-react';
import { useContentStore, contentRepository } from '@/app/store/useContentStore';
import { AdminDialog } from '../AdminUi';
import type {
  ContentAccessType,
  ContentPublishEntry,
  ContentSampleImage,
  ContentStoreSection,
} from './types/content';
import './content-publishing.css';

type WorkflowStep = 'select' | 'configure' | 'review' | 'publishing';
type UploadMode = 'files' | 'folder' | 'drop';
type PublishPhase = 'PREPARING' | 'UPLOADING' | 'PUBLISHING' | 'COMPLETED' | 'FAILED';

interface ContentPublishingWorkflowProps {
  open: boolean;
  initialFiles: File[];
  initialMode: UploadMode;
  destinationId: string | null;
  destinationLabel: string;
  onClose: () => void;
  onPublished: (count: number) => void;
}

interface FileCandidate {
  file: File;
  relativePath: string;
}

const MAX_SAMPLE_IMAGES = 3;
const MAX_STORE_SECTIONS = 3;
const ACCEPTED_FILE_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg', 'webp', 'mp4', 'webm', 'zip',
]);
const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  mp4: 'video/mp4',
  webm: 'video/webm',
  zip: 'application/zip',
};
const SAMPLE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PHASE_DELAYS = { upload: 110, publish: 310 } as const;
const COMPLETION_RETURN_DELAY = 650;
let temporarySequence = 0;

const temporaryId = (kind: 'file' | 'folder') => `stage-${kind}-${Date.now()}-${temporarySequence += 1}`;
const cleanPath = (value: string) => value.replace(/\\/g, '/').split('/').filter(Boolean).join('/');
const fileExtension = (name: string) => name.split('.').pop()?.toLocaleLowerCase() ?? '';
const contentMimeType = (file: File) => (MIME_BY_EXTENSION[fileExtension(file.name)] ?? file.type) || 'application/octet-stream';
const formatBytes = (bytes: number): string => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** unit).toFixed(unit ? 1 : 0)} ${units[unit]}`;
};

const asCandidates = (files: File[]): FileCandidate[] => files.map((file) => ({
  file,
  relativePath: cleanPath(file.webkitRelativePath || file.name),
}));

const buildEntries = (
  candidates: FileCandidate[],
  previous: ContentPublishEntry[] = [],
): ContentPublishEntry[] => {
  const previousByPath = new Map(previous.filter((entry) => entry.kind === 'file').map((entry) => [entry.relativePath, entry]));
  const previousFolderByPath = new Map(previous.filter((entry) => entry.kind === 'folder').map((entry) => [entry.relativePath, entry]));
  const folderByPath = new Map<string, ContentPublishEntry>();
  const entries: ContentPublishEntry[] = [];
  const siblingOrder = new Map<string, number>();
  const nextOrder = (parentId: string | null) => {
    const key = parentId ?? '__root__';
    const value = siblingOrder.get(key) ?? 0;
    siblingOrder.set(key, value + 1);
    return value;
  };

  candidates.forEach(({ file, relativePath }, fileIndex) => {
    const safePath = relativePath || file.name || `File ${fileIndex + 1}`;
    const parts = safePath.split('/').filter(Boolean);
    let folderPath = '';
    let parentTemporaryId: string | null = null;
    parts.slice(0, -1).forEach((folderName) => {
      folderPath = folderPath ? `${folderPath}/${folderName}` : folderName;
      let folderEntry = folderByPath.get(folderPath);
      if (!folderEntry) {
        const prevFolder = previousFolderByPath.get(folderPath);
        folderEntry = {
          temporaryId: prevFolder?.temporaryId ?? temporaryId('folder'),
          parentTemporaryId,
          relativePath: folderPath,
          kind: 'folder',
          name: folderName,
          pageHeading: prevFolder?.pageHeading ?? '',
          size: 0,
          mimeType: null,
          accessType: 'FREE',
          price: null,
          validityMode: 'PERMANENT',
          validityOffsetDays: null,
          description: '',
          sampleImages: [],
          storeSections: [],
          displayOrder: nextOrder(parentTemporaryId),
        };
        folderByPath.set(folderPath, folderEntry);
        entries.push(folderEntry);
      }
      parentTemporaryId = folderEntry.temporaryId;
    });
    const previousEntry = previousByPath.get(safePath);
    entries.push({
      temporaryId: previousEntry?.temporaryId ?? temporaryId('file'),
      parentTemporaryId,
      relativePath: safePath,
      kind: 'file',
      name: parts.at(-1) || file.name,
      size: file.size,
      mimeType: contentMimeType(file),
      sourceFile: file,
      entityType: previousEntry?.entityType ?? 'study-material',
      accessType: previousEntry?.accessType ?? 'FREE',
      price: previousEntry?.price ?? null,
      validityMode: previousEntry?.validityMode ?? 'PERMANENT',
      validityOffsetDays: previousEntry?.validityOffsetDays ?? null,
      description: previousEntry?.description ?? '',
      sampleImages: previousEntry?.sampleImages ?? [],
      storeSections: previousEntry?.storeSections ?? [],
      displayOrder: nextOrder(parentTemporaryId),
    });
  });
  return entries;
};

const validateFile = (entry: ContentPublishEntry, duplicatePaths: Set<string>): string[] => {
  const issues: string[] = [];
  if (!entry.name.trim()) issues.push('File name is required.');
  if (!ACCEPTED_FILE_EXTENSIONS.has(fileExtension(entry.name))) issues.push('This file type is not supported.');
  if (entry.size <= 0) issues.push('The selected file is empty.');
  if (duplicatePaths.has(entry.relativePath.toLocaleLowerCase())) issues.push('Another selected file has the same path.');
  if (entry.accessType === 'PAID') {
    if (!entry.price || entry.price <= 0) issues.push('Enter a price greater than zero.');
    if (!entry.description.trim()) issues.push('Add a Store description.');
    const validityDays = entry.validityOffsetDays ?? -1;
    if (entry.validityMode === 'EXAM_DATE_OFFSET' && (!Number.isInteger(validityDays) || validityDays < 0 || validityDays > 3650)) issues.push('Enter validity from 0 to 3650 days after the exam date.');
    if (entry.sampleImages.length > MAX_SAMPLE_IMAGES) issues.push('Use no more than three sample images.');
    if (entry.storeSections.length > MAX_STORE_SECTIONS) issues.push('Use no more than three Store information sections.');
    entry.storeSections.forEach((section, index) => {
      if (!section.heading.trim() || !section.content.trim()) issues.push(`Complete Store section ${index + 1}.`);
    });
  }
  return issues;
};

const readImage = (file: File): Promise<ContentSampleImage> => new Promise((resolve, reject) => {
  const ext = fileExtension(file.name);
  const isImage = file.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'jfif', 'gif', 'svg'].includes(ext);
  if (!isImage) {
    reject(new Error('Choose an image file (JPG, PNG, WebP, JFIF, GIF).'));
    return;
  }
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('This image could not be read.'));
  reader.onload = () => resolve({
    id: temporaryId('file'),
    name: file.name,
    mimeType: file.type || 'image/jpeg',
    size: file.size,
    dataUrl: String(reader.result),
    order: 0,
  });
  reader.readAsDataURL(file);
});

export const ContentPublishingWorkflow: React.FC<ContentPublishingWorkflowProps> = ({
  open,
  initialFiles,
  initialMode,
  destinationId,
  destinationLabel,
  onClose,
  onPublished,
}) => {
  const publishContent = useContentStore((state) => state.publishContent);
  const [step, setStep] = useState<WorkflowStep>('select');
  const [entries, setEntries] = useState<ContentPublishEntry[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkScope, setBulkScope] = useState<'selected' | 'all'>('selected');
  const [bulkAccess, setBulkAccess] = useState<ContentAccessType>('FREE');
  const [bulkPrice, setBulkPrice] = useState('');
  const [bulkDescription, setBulkDescription] = useState('');
  const [discardOpen, setDiscardOpen] = useState(false);
  const [phase, setPhase] = useState<PublishPhase>('PREPARING');
  const [publishedCount, setPublishedCount] = useState(0);
  const [publishError, setPublishError] = useState('');
  const [imageError, setImageError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const setFolderInputRef = (node: HTMLInputElement | null) => {
    folderInputRef.current = node;
    if (node) {
      node.setAttribute('webkitdirectory', '');
      node.setAttribute('directory', '');
    }
  };
  const completionTimerRef = useRef<number | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => () => {
    if (completionTimerRef.current !== null) window.clearTimeout(completionTimerRef.current);
  }, []);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      wasOpenRef.current = true;
      if (completionTimerRef.current !== null) {
        window.clearTimeout(completionTimerRef.current);
        completionTimerRef.current = null;
      }
      const next = buildEntries(asCandidates(initialFiles));
      setEntries(next);
      setActiveFileId(next.find((entry) => entry.kind === 'file')?.temporaryId ?? null);
      setExpanded(new Set(next.filter((entry) => entry.kind === 'folder').map((entry) => entry.temporaryId)));
      setChecked(new Set());
      setStep('select');
      setPhase('PREPARING');
      setPublishedCount(0);
      setPublishError('');
      setImageError('');
      setDiscardOpen(false);
    } else if (!open) {
      wasOpenRef.current = false;
    }
  }, [open, initialFiles]);

  const files = useMemo(() => entries.filter((entry) => entry.kind === 'file'), [entries]);
  const folders = useMemo(() => entries.filter((entry) => entry.kind === 'folder'), [entries]);
  const duplicatePaths = useMemo(() => {
    const counts = new Map<string, number>();
    files.forEach((file) => {
      const path = file.relativePath.toLocaleLowerCase();
      counts.set(path, (counts.get(path) ?? 0) + 1);
    });
    return new Set([...counts].filter(([, count]) => count > 1).map(([path]) => path));
  }, [files]);
  const validation = useMemo(() => new Map(files.map((file) => [file.temporaryId, validateFile(file, duplicatePaths)])), [duplicatePaths, files]);
  const invalidFiles = useMemo(() => files.filter((file) => (validation.get(file.temporaryId)?.length ?? 0) > 0), [files, validation]);
  const activeFile = files.find((file) => file.temporaryId === activeFileId) ?? files[0] ?? null;
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  const updateEntry = (entryId: string, patch: Partial<ContentPublishEntry>) => {
    setEntries((current) => current.map((entry) => entry.temporaryId === entryId ? { ...entry, ...patch } : entry));
  };

  const addFiles = (nextFiles: File[]) => {
    if (!nextFiles.length) return;
    const candidates: FileCandidate[] = [
      ...files.filter((file) => file.sourceFile).map((file) => ({ file: file.sourceFile!, relativePath: file.relativePath })),
      ...asCandidates(nextFiles),
    ];
    const next = buildEntries(candidates, entries);
    setEntries(next);
    setExpanded(new Set(next.filter((entry) => entry.kind === 'folder').map((entry) => entry.temporaryId)));
    setActiveFileId((current) => current && next.some((entry) => entry.temporaryId === current) ? current : next.find((entry) => entry.kind === 'file')?.temporaryId ?? null);
  };

  const removeFile = (fileId: string) => {
    const remaining = files.filter((file) => file.temporaryId !== fileId && file.sourceFile)
      .map((file) => ({ file: file.sourceFile!, relativePath: file.relativePath }));
    const next = buildEntries(remaining, entries.filter((entry) => entry.temporaryId !== fileId));
    setEntries(next);
    setChecked((current) => new Set([...current].filter((id) => id !== fileId)));
    setActiveFileId(next.find((entry) => entry.kind === 'file')?.temporaryId ?? null);
  };

  const finishPublishing = (count = publishedCount) => {
    if (completionTimerRef.current !== null) {
      window.clearTimeout(completionTimerRef.current);
      completionTimerRef.current = null;
    }
    onPublished(count);
  };

  const requestClose = () => {
    if (step === 'publishing' && phase !== 'COMPLETED' && phase !== 'FAILED') return;
    if (phase === 'COMPLETED') {
      finishPublishing();
    }
    else setDiscardOpen(true);
  };

  const openIssue = (fileId: string) => {
    setActiveFileId(fileId);
    setStep('configure');
  };

  const applyBulk = () => {
    const targetIds = bulkScope === 'all' ? new Set(files.map((file) => file.temporaryId)) : checked;
    if (!targetIds.size) return;
    const numericPrice = Number(bulkPrice);
    setEntries((current) => current.map((entry) => {
      if (entry.kind !== 'file' || !targetIds.has(entry.temporaryId)) return entry;
      return {
        ...entry,
        accessType: bulkAccess,
        price: bulkAccess === 'PAID' && numericPrice > 0 ? numericPrice : null,
        validityMode: bulkAccess === 'FREE' ? 'PERMANENT' : entry.validityMode,
        validityOffsetDays: bulkAccess === 'FREE' ? null : entry.validityOffsetDays,
        description: bulkDescription.trim() || entry.description,
        sampleImages: bulkAccess === 'FREE' ? [] : entry.sampleImages,
        storeSections: bulkAccess === 'FREE' ? [] : entry.storeSections,
      };
    }));
    setBulkOpen(false);
  };

  const addSampleImages = async (selected: File[]) => {
    if (!activeFile) return;
    setImageError('');
    try {
      const available = MAX_SAMPLE_IMAGES - activeFile.sampleImages.length;
      if (selected.length > available) throw new Error(`You can add ${available} more sample image${available === 1 ? '' : 's'}.`);
      const images = await Promise.all(selected.map(readImage));
      updateEntry(activeFile.temporaryId, {
        sampleImages: [...activeFile.sampleImages, ...images].map((image, index) => ({ ...image, order: index })),
      });
    } catch (error) {
      setImageError(error instanceof Error ? error.message : 'The image could not be added.');
    }
  };

  const replaceSampleImage = async (sampleId: string, selected?: File) => {
    if (!activeFile || !selected) return;
    setImageError('');
    try {
      const image = await readImage(selected);
      updateEntry(activeFile.temporaryId, {
        sampleImages: activeFile.sampleImages.map((current) => current.id === sampleId ? { ...image, id: sampleId, order: current.order } : current),
      });
    } catch (error) {
      setImageError(error instanceof Error ? error.message : 'The image could not be replaced.');
    }
  };

  const addSection = () => {
    if (!activeFile || activeFile.storeSections.length >= MAX_STORE_SECTIONS) return;
    const section: ContentStoreSection = {
      id: temporaryId('file'),
      heading: '',
      content: '',
      order: activeFile.storeSections.length,
    };
    updateEntry(activeFile.temporaryId, { storeSections: [...activeFile.storeSections, section] });
  };

  const updateSection = (sectionId: string, patch: Partial<ContentStoreSection>) => {
    if (!activeFile) return;
    updateEntry(activeFile.temporaryId, {
      storeSections: activeFile.storeSections.map((section) => section.id === sectionId ? { ...section, ...patch } : section),
    });
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    if (!activeFile) return;
    const target = index + direction;
    if (target < 0 || target >= activeFile.storeSections.length) return;
    const sections = [...activeFile.storeSections];
    [sections[index], sections[target]] = [sections[target], sections[index]];
    updateEntry(activeFile.temporaryId, { storeSections: sections.map((section, order) => ({ ...section, order })) });
  };

  const courseId = useContentStore((state) => state.courseId);
  const refreshStore = useContentStore((state) => state.refresh);

  const [destinationHeading, setDestinationHeading] = useState('');
  const [folderHeadings, setFolderHeadings] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open || !courseId) return;
    setFolderHeadings({});
    contentRepository.getLocationSettings(courseId, destinationId).then((res) => {
      const heading = res?.pageHeading?.trim() ?? '';
      const lower = heading.toLowerCase();
      if (heading && lower !== 'untitled' && lower !== 'untitled page' && lower !== 'untitled_page') {
        setDestinationHeading(heading);
      } else {
        setDestinationHeading('');
      }
    }).catch(() => setDestinationHeading(''));
  }, [open, destinationId, courseId]);

  const isHeadingValid = (h: string) => {
    const trimmed = h.trim().toLowerCase();
    return Boolean(trimmed && trimmed !== 'untitled' && trimmed !== 'untitled page' && trimmed !== 'untitled_page');
  };

  const destinationHeadingValid = isHeadingValid(destinationHeading);
  const subfoldersHeadingValid = useMemo(() => {
    return folders.every((folder) => isHeadingValid(folderHeadings[folder.temporaryId] ?? ''));
  }, [folders, folderHeadings]);
  const allHeadingsValid = destinationHeadingValid && subfoldersHeadingValid;

  const publish = async () => {
    if (invalidFiles.length || !files.length || !allHeadingsValid) return;
    setStep('publishing');
    setPhase('PREPARING');
    setPublishError('');
    const uploadTimer = window.setTimeout(() => setPhase('UPLOADING'), PHASE_DELAYS.upload);
    const publishTimer = window.setTimeout(() => setPhase('PUBLISHING'), PHASE_DELAYS.publish);
    try {
      if (courseId) {
        await contentRepository.updatePageHeading(courseId, destinationId, destinationHeading.trim());
      }
      const finalEntries = entries.map((entry) => {
        if (entry.kind === 'folder') {
          return { ...entry, pageHeading: folderHeadings[entry.temporaryId]?.trim() };
        }
        return entry;
      });
      const published = await publishContent({ entries: finalEntries, destinationId });
      await refreshStore();
      const fileCount = published.filter((item) => item.kind === 'file').length;
      setPublishedCount(fileCount);
      setPhase('COMPLETED');
      completionTimerRef.current = window.setTimeout(() => {
        completionTimerRef.current = null;
        onPublished(fileCount);
      }, COMPLETION_RETURN_DELAY);
    } catch (error) {
      setPhase('FAILED');
      setPublishError(error instanceof Error ? error.message : 'Content could not be published.');
    } finally {
      window.clearTimeout(uploadTimer);
      window.clearTimeout(publishTimer);
    }
  };

  const renderTree = (parentId: string | null, depth = 0): React.ReactNode => entries
    .filter((entry) => entry.parentTemporaryId === parentId)
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .map((entry) => {
      if (entry.kind === 'folder') {
        const isExpanded = expanded.has(entry.temporaryId);
        const childCount = entries.filter((child) => child.parentTemporaryId === entry.temporaryId).length;
        return (
          <React.Fragment key={entry.temporaryId}>
            <button className="pf-publish-tree-folder" type="button" style={{ '--tree-depth': depth } as React.CSSProperties} onClick={() => setExpanded((current) => {
              const next = new Set(current);
              if (isExpanded) next.delete(entry.temporaryId); else next.add(entry.temporaryId);
              return next;
            })}>
              {isExpanded ? <ChevronDown /> : <ChevronRight />}<Folder /><span>{entry.name}</span><small>{childCount}</small>
            </button>
            {isExpanded ? renderTree(entry.temporaryId, depth + 1) : null}
          </React.Fragment>
        );
      }
      const issues = validation.get(entry.temporaryId) ?? [];
      return (
        <div key={entry.temporaryId} className={`pf-publish-tree-file${activeFile?.temporaryId === entry.temporaryId ? ' is-active' : ''}`} style={{ '--tree-depth': depth } as React.CSSProperties}>
          <label aria-label={`Select ${entry.name} for bulk editing`}><input type="checkbox" checked={checked.has(entry.temporaryId)} onChange={(event) => setChecked((current) => {
            const next = new Set(current);
            if (event.target.checked) next.add(entry.temporaryId); else next.delete(entry.temporaryId);
            return next;
          })} /><span /></label>
          <button type="button" onClick={() => setActiveFileId(entry.temporaryId)}><FileText /><span><strong>{entry.name}</strong><small>{entry.relativePath}</small></span></button>
          <i className={issues.length ? 'needs-attention' : 'ready'}>{issues.length ? <AlertCircle /> : <CheckCircle2 />}{issues.length ? 'Needs attention' : entry.accessType === 'PAID' ? 'Paid · Ready' : 'Free · Ready'}</i>
        </div>
      );
    });

  const footer = step === 'select' ? (
    <><button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={requestClose}>Cancel</button><button className="pf-admin-button" type="button" disabled={!files.length} onClick={() => setStep('configure')}>Continue to configure</button></>
  ) : step === 'configure' ? (
    <><button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={() => setStep('select')}>Back</button><button className="pf-admin-button" type="button" disabled={!files.length || !allHeadingsValid} onClick={() => setStep('review')}>Review upload</button></>
  ) : step === 'review' ? (
    <><button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={() => setStep('configure')}>Back</button><button className="pf-admin-button" type="button" disabled={!files.length || Boolean(invalidFiles.length) || !allHeadingsValid} onClick={() => void publish()}><Upload /> Upload &amp; publish</button></>
  ) : phase === 'COMPLETED' ? (
    <button className="pf-admin-button" type="button" onClick={() => finishPublishing()}>View Content Library</button>
  ) : phase === 'FAILED' ? (
    <><button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={() => setStep('review')}>Back to review</button><button className="pf-admin-button" type="button" onClick={() => void publish()}>Try again</button></>
  ) : null;

  return (
    <AdminDialog
      open={open}
      onClose={requestClose}
      title="Upload & publish content"
      description={`Temporary upload session · Destination: ${destinationLabel}`}
      size="wide"
      footer={footer}
      bodyClassName="pf-publish-dialog-body"
    >
      <div className="pf-publish-workflow">
        <ol className="pf-publish-steps" aria-label="Publishing progress">
          {(['select', 'configure', 'review', 'publishing'] as WorkflowStep[]).map((value, index) => {
            const current = ['select', 'configure', 'review', 'publishing'].indexOf(step);
            return <li key={value} className={`${value === step ? 'is-active' : ''}${index < current ? ' is-complete' : ''}`}><span>{index < current ? <Check /> : index + 1}</span><strong>{value === 'select' ? 'Select' : value === 'configure' ? 'Configure' : value === 'review' ? 'Review' : 'Publish'}</strong></li>;
          })}
        </ol>

        {step === 'select' ? (
          <motion.section className="pf-publish-select" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>
            <div className="pf-publish-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addFiles([...event.dataTransfer.files]); }}>
              <span><Upload /></span><div><h3>Files are staged, not published</h3><p>Add more files or folders. Their original hierarchy is preserved until you explicitly publish.</p></div>
              <div><button className="pf-admin-button pf-admin-button--secondary" type="button" onClick={() => fileInputRef.current?.click()}><Files /> Add files</button><button className="pf-admin-button pf-admin-button--secondary" type="button" onClick={() => folderInputRef.current?.click()}><FolderInput /> Add folder</button></div>
              <input ref={fileInputRef} className="pf-admin-sr-only" type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.mp4,.webm,.zip" onChange={(event) => { addFiles([...(event.target.files ?? [])]); event.target.value = ''; }} />
              <input ref={setFolderInputRef} className="pf-admin-sr-only" type="file" multiple onChange={(event) => { addFiles([...(event.target.files ?? [])]); event.target.value = ''; }} />
            </div>
            <div className="pf-publish-session-summary"><div><Files /><span><strong>{files.length}</strong><small>Files selected</small></span></div><div><Folder /><span><strong>{folders.length}</strong><small>Folders preserved</small></span></div><div><ShoppingBag /><span><strong>{formatBytes(totalSize)}</strong><small>Session size</small></span></div><div><LockKeyhole /><span><strong>Free by default</strong><small>Configure paid items next</small></span></div></div>
            <div className="pf-publish-selection-list">
              <header><div><strong>Temporary upload session</strong><small>{initialMode === 'folder' ? 'Folder hierarchy preserved' : initialMode === 'drop' ? 'Dropped files' : 'Selected files'}</small></div><span>Nothing has changed in the library</span></header>
              {files.map((file) => <div key={file.temporaryId}><FileText /><span><strong>{file.name}</strong><small>{file.relativePath} · {formatBytes(file.size)}</small></span><button type="button" onClick={() => removeFile(file.temporaryId)} aria-label={`Remove ${file.name}`}><Trash2 /></button></div>)}
            </div>
          </motion.section>
        ) : null}

        {step === 'configure' ? (
          <motion.section className="pf-publish-configure" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>
            <aside className="pf-publish-tree" aria-label="Temporary content hierarchy">
              <header><div><strong>Content tree</strong><small>{files.length} independent file{files.length === 1 ? '' : 's'}</small></div><button type="button" onClick={() => setBulkOpen((current) => !current)}><Files /> Bulk configure</button></header>
              <div className="pf-publish-tree-scroll">
                {bulkOpen ? <div className="pf-publish-bulk" style={{ marginBottom: 12 }}>
                  <div className="pf-publish-segmented"><button className={bulkScope === 'selected' ? 'is-active' : ''} type="button" onClick={() => setBulkScope('selected')}>Selected ({checked.size})</button><button className={bulkScope === 'all' ? 'is-active' : ''} type="button" onClick={() => setBulkScope('all')}>All files</button></div>
                  <label><span>Access</span><select value={bulkAccess} onChange={(event) => setBulkAccess(event.target.value as ContentAccessType)}><option value="FREE">Free</option><option value="PAID">Paid</option></select></label>
                  {bulkAccess === 'PAID' ? <><label><span>Price (₹)</span><input inputMode="decimal" value={bulkPrice} onChange={(event) => setBulkPrice(event.target.value)} placeholder="499" /></label><label><span>Description (optional bulk value)</span><textarea rows={2} value={bulkDescription} onChange={(event) => setBulkDescription(event.target.value)} /></label></> : null}
                  <button className="pf-admin-button" type="button" onClick={applyBulk} disabled={bulkScope === 'selected' && !checked.size} style={{ width: '100%', marginTop: 10 }}>Apply settings</button>
                </div> : null}
                {renderTree(null)}
              </div>
            </aside>
            <div className="pf-publish-editor">
              {activeFile ? <>
                <header><div><FileText /><span><strong>{activeFile.name}</strong><small>{activeFile.relativePath} · {formatBytes(activeFile.size)}</small></span></div><i className={(validation.get(activeFile.temporaryId)?.length ?? 0) ? 'needs-attention' : 'ready'}>{(validation.get(activeFile.temporaryId)?.length ?? 0) ? 'Needs attention' : 'Ready'}</i></header>
                <div className="pf-publish-editor-scroll">
                  <div className="pf-publish-location-card">
                    <header>
                      <div>
                        <Folder />
                        <span>
                          <strong>Destination Page Heading</strong>
                          <small>{destinationLabel}</small>
                        </span>
                      </div>
                      <i className={destinationHeadingValid ? 'ready' : 'needs-attention'}>
                        {destinationHeadingValid ? 'Ready' : 'Heading Required'}
                      </i>
                    </header>
                    <label>
                      <span>Set Page Heading for this library location <b>Required for upload</b></span>
                      <input
                        type="text"
                        value={destinationHeading}
                        onChange={(event) => setDestinationHeading(event.target.value)}
                        placeholder="Enter a valid page heading (e.g., Certifications Library, AKKSK Notes)..."
                      />
                    </label>
                    {!destinationHeadingValid ? (
                      <p className="pf-publish-location-warning">
                        <AlertCircle /> Content upload is locked until this destination location is given a valid page heading.
                      </p>
                    ) : null}
                  </div>
                  {folders.map((folderEntry) => {
                    const isFolderValid = isHeadingValid(folderHeadings[folderEntry.temporaryId] ?? '');
                    return (
                      <div className="pf-publish-location-card" key={folderEntry.temporaryId} style={{ marginTop: 12 }}>
                        <header>
                          <div>
                            <Folder />
                            <span>
                              <strong>Folder Page Heading: {folderEntry.name}</strong>
                              <small>{folderEntry.relativePath}</small>
                            </span>
                          </div>
                          <i className={isFolderValid ? 'ready' : 'needs-attention'}>
                            {isFolderValid ? 'Ready' : 'Heading Required'}
                          </i>
                        </header>
                        <label>
                          <span>Set Page Heading for "{folderEntry.name}" folder <b>Required for upload</b></span>
                          <input
                            type="text"
                            value={folderHeadings[folderEntry.temporaryId] ?? ''}
                            onChange={(event) => setFolderHeadings((prev) => ({ ...prev, [folderEntry.temporaryId]: event.target.value }))}
                            placeholder={`Enter page heading for ${folderEntry.name}...`}
                          />
                        </label>
                        {!isFolderValid ? (
                          <p className="pf-publish-location-warning">
                            <AlertCircle /> Content upload is locked until this folder location is given a valid page heading.
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                  <fieldset className="pf-publish-access"><legend>Access type</legend><label className={activeFile.accessType === 'FREE' ? 'is-active' : ''}><input type="radio" name="access" checked={activeFile.accessType === 'FREE'} onChange={() => updateEntry(activeFile.temporaryId, { accessType: 'FREE', price: null, validityMode: 'PERMANENT', validityOffsetDays: null, sampleImages: [], storeSections: [] })} /><span><CheckCircle2 /><strong>Free</strong><small>Available immediately in the library</small></span></label><label className={activeFile.accessType === 'PAID' ? 'is-active' : ''}><input type="radio" name="access" checked={activeFile.accessType === 'PAID'} onChange={() => updateEntry(activeFile.temporaryId, { accessType: 'PAID' })} /><span><LockKeyhole /><strong>Paid</strong><small>Requires Store metadata before publishing</small></span></label></fieldset>
                  {activeFile.accessType === 'PAID' ? <div className="pf-publish-paid">
                    <label><span>Price (₹) <b>Required</b></span><input type="number" min="1" step="1" value={activeFile.price ?? ''} onChange={(event) => updateEntry(activeFile.temporaryId, { price: event.target.value ? Number(event.target.value) : null })} placeholder="499" /></label>
                    <label><span>Access validity</span><select value={activeFile.validityMode ?? 'PERMANENT'} onChange={(event) => updateEntry(activeFile.temporaryId, { validityMode: event.target.value as 'PERMANENT' | 'EXAM_DATE_OFFSET', validityOffsetDays: event.target.value === 'PERMANENT' ? null : (activeFile.validityOffsetDays ?? 0) })}><option value="PERMANENT">Permanent</option><option value="EXAM_DATE_OFFSET">Exam date + days</option></select><small>{(activeFile.validityMode ?? 'PERMANENT') === 'PERMANENT' ? 'Access does not expire.' : 'Calculated from each learner’s saved exam date.'}</small></label>
                    {activeFile.validityMode === 'EXAM_DATE_OFFSET' ? <label><span>Days after exam date <b>Required</b></span><input type="number" min="0" max="3650" step="1" value={activeFile.validityOffsetDays ?? 0} onChange={(event) => updateEntry(activeFile.temporaryId, { validityOffsetDays: event.target.value === '' ? null : Number(event.target.value) })} /><small>0 keeps access through the exam date; 30 keeps it for 30 additional days.</small></label> : null}
                    <label><span>Store description <b>Required</b></span><textarea rows={4} value={activeFile.description} onChange={(event) => updateEntry(activeFile.temporaryId, { description: event.target.value })} placeholder="Explain what the learner receives and why it is useful." /></label>
                    <section className="pf-publish-samples"><header><div><strong>Sample images</strong><small>{activeFile.sampleImages.length} / {MAX_SAMPLE_IMAGES} · JPG, PNG, WebP, or JFIF</small></div><label className={activeFile.sampleImages.length >= MAX_SAMPLE_IMAGES ? 'is-disabled' : ''}><ImagePlus /> Add images<input className="pf-admin-sr-only" type="file" accept="image/*,.jpg,.jpeg,.png,.webp,.jfif,.gif,.svg" multiple disabled={activeFile.sampleImages.length >= MAX_SAMPLE_IMAGES} onChange={(event) => { void addSampleImages([...(event.target.files ?? [])]); event.target.value = ''; }} /></label></header>{activeFile.sampleImages.length >= MAX_SAMPLE_IMAGES ? <p className="pf-publish-limit-note">Maximum 3 sample images reached.</p> : null}{imageError ? <p className="pf-publish-inline-error"><AlertCircle />{imageError}</p> : null}<div>{activeFile.sampleImages.map((image) => <article key={image.id}><img src={image.dataUrl} alt={`Sample preview ${image.order + 1}`} /><span><small>{image.name}</small><div><label>Replace<input className="pf-admin-sr-only" type="file" accept="image/*,.jpg,.jpeg,.png,.webp,.jfif,.gif,.svg" onChange={(event) => { void replaceSampleImage(image.id, event.target.files?.[0]); event.target.value = ''; }} /></label><button type="button" onClick={() => updateEntry(activeFile.temporaryId, { sampleImages: activeFile.sampleImages.filter((current) => current.id !== image.id).map((current, order) => ({ ...current, order })) })}>Remove</button></div></span></article>)}</div></section>
                    <section className="pf-publish-sections"><header><div><strong>Store information</strong><small>{activeFile.storeSections.length} / {MAX_STORE_SECTIONS} · Optional ordered sections</small></div><button type="button" onClick={addSection} disabled={activeFile.storeSections.length >= MAX_STORE_SECTIONS}><Plus /> Add section</button></header>{activeFile.storeSections.length >= MAX_STORE_SECTIONS ? <p className="pf-publish-limit-note">Maximum 3 sections reached.</p> : null}{activeFile.storeSections.map((section, index) => <article key={section.id}><div><span>Section {index + 1}</span><button type="button" onClick={() => moveSection(index, -1)} disabled={index === 0} aria-label="Move section up"><ArrowUp /></button><button type="button" onClick={() => moveSection(index, 1)} disabled={index === activeFile.storeSections.length - 1} aria-label="Move section down"><ArrowDown /></button><button type="button" onClick={() => updateEntry(activeFile.temporaryId, { storeSections: activeFile.storeSections.filter((current) => current.id !== section.id).map((current, order) => ({ ...current, order })) })} aria-label="Remove section"><Trash2 /></button></div><input aria-label={`Store section ${index + 1} heading`} value={section.heading} onChange={(event) => updateSection(section.id, { heading: event.target.value })} placeholder="Heading" /><textarea aria-label={`Store section ${index + 1} content`} rows={3} value={section.content} onChange={(event) => updateSection(section.id, { content: event.target.value })} placeholder="Content" /></article>)}</section>
                  </div> : <div className="pf-publish-free-note"><CheckCircle2 /><div><strong>Ready as free content</strong><p>No Store metadata is required. This file will be available in the selected Content Library destination.</p></div></div>}
                  {(validation.get(activeFile.temporaryId)?.length ?? 0) > 0 ? <div className="pf-publish-validation-note"><AlertCircle /><div><strong>Complete before publishing</strong>{validation.get(activeFile.temporaryId)?.map((issue) => <p key={issue}>{issue}</p>)}</div></div> : null}
                </div>
              </> : <div className="pf-publish-no-file"><FileText /><strong>No file selected</strong></div>}
            </div>
          </motion.section>
        ) : null}

        {step === 'review' ? (
          <motion.section className="pf-publish-review" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>
            <header><div><span className={invalidFiles.length ? 'has-issues' : 'is-ready'}>{invalidFiles.length ? <AlertCircle /> : <CheckCircle2 />}</span><div><h3>{invalidFiles.length ? 'Resolve issues before publishing' : 'Ready to upload & publish'}</h3><p>{invalidFiles.length ? `${invalidFiles.length} file${invalidFiles.length === 1 ? '' : 's'} need attention.` : 'Review the session. The Content Library is still unchanged.'}</p></div></div><strong>{destinationLabel}</strong></header>
            <div className="pf-publish-review-stats"><div><strong>{files.length}</strong><span>Files</span></div><div><strong>{folders.length}</strong><span>Folders</span></div><div><strong>{files.filter((file) => file.accessType === 'FREE').length}</strong><span>Free</span></div><div><strong>{files.filter((file) => file.accessType === 'PAID').length}</strong><span>Paid</span></div><div><strong>₹{files.reduce((sum, file) => sum + (file.accessType === 'PAID' ? file.price ?? 0 : 0), 0).toLocaleString('en-IN')}</strong><span>Combined price</span></div></div>
            <div className="pf-publish-review-list">{files.map((file) => { const issues = validation.get(file.temporaryId) ?? []; return <article key={file.temporaryId} className={issues.length ? 'has-issues' : ''}><FileText /><div><strong>{file.name}</strong><small>{file.relativePath} · {formatBytes(file.size)}</small></div><span>{file.accessType === 'PAID' ? `Paid · ₹${file.price?.toLocaleString('en-IN') ?? '—'} · ${file.validityMode === 'EXAM_DATE_OFFSET' ? `Exam +${file.validityOffsetDays ?? 0}d` : 'Permanent'}` : 'Free'}</span><i>{issues.length ? `${issues.length} issue${issues.length === 1 ? '' : 's'}` : 'Ready'}</i>{issues.length ? <button type="button" onClick={() => openIssue(file.temporaryId)}>Fix</button> : <CheckCircle2 />}</article>; })}</div>
            <p className="pf-publish-review-assurance"><Check /> Publishing creates the complete hierarchy in one operation. Cancelling before that point leaves the library untouched.</p>
          </motion.section>
        ) : null}

        {step === 'publishing' ? <motion.section className={`pf-publish-progress pf-publish-progress--${phase.toLocaleLowerCase()}`} initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }}>
          <span>{phase === 'COMPLETED' ? <CheckCircle2 /> : phase === 'FAILED' ? <AlertCircle /> : <LoaderCircle className="is-spinning" />}</span><h3>{phase === 'PREPARING' ? 'Preparing your upload' : phase === 'UPLOADING' ? 'Uploading files' : phase === 'PUBLISHING' ? 'Publishing to the Content Library' : phase === 'COMPLETED' ? 'Content published successfully' : 'Publishing could not be completed'}</h3><p>{phase === 'COMPLETED' ? `${files.length} file${files.length === 1 ? '' : 's'} and the preserved folder hierarchy are now available.` : phase === 'FAILED' ? publishError : 'Keep this window open while the temporary session is finalized.'}</p><div>{(['PREPARING', 'UPLOADING', 'PUBLISHING', 'COMPLETED'] as PublishPhase[]).map((value) => <i key={value} className={value === phase || (phase === 'COMPLETED') ? 'is-active' : ''} />)}</div>
        </motion.section> : null}

        <AnimatePresence>{discardOpen ? <motion.div className="pf-publish-discard" role="alertdialog" aria-modal="true" aria-labelledby="pf-publish-discard-title" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.div initial={{ y: 8, scale: 0.98 }} animate={{ y: 0, scale: 1 }}><AlertCircle /><h3 id="pf-publish-discard-title">Discard this upload session?</h3><p>Selected files and configuration will be removed. Your existing Content Library will not be changed.</p><div><button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={() => setDiscardOpen(false)}>Keep editing</button><button className="pf-admin-button pf-admin-button--danger" type="button" onClick={onClose}>Discard session</button></div></motion.div></motion.div> : null}</AnimatePresence>
      </div>
    </AdminDialog>
  );
};
