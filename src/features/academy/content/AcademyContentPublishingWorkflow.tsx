import { AppSelect } from '@/components/ui/AppSelect';
import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  FileText,
  Folder,
  FolderInput,
  LoaderCircle,
  LockKeyhole,
  Trash2,
  Upload,
} from 'lucide-react';
import { academyContentApi } from '@/features/academy/api/academyAcademicApi';
import { AdminDialog } from '@/features/admin/AdminUi';
import '@/features/admin/content/content-publishing.css';

export const ACADEMY_UPLOAD_ACCEPT = '.pdf,.zip,.json,.txt,.csv,.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.mp3,.wav';

type UploadStep = 'select' | 'configure' | 'review' | 'publish';
type AcademyEntityType = 'STUDY_MATERIAL' | 'GOVERNMENT_DOCUMENT' | 'QUESTION_PAPER' | 'REFERENCE_MATERIAL' | 'MEDIA' | 'OTHER';

export interface AcademyUploadEntry {
  id: string;
  kind: 'folder' | 'file';
  name: string;
  relativePath: string;
  parentPath: string;
  depth: number;
  file?: File;
  pageHeading: string;
  description: string;
  entityType: AcademyEntityType;
  accessType: 'FREE' | 'PAID';
  price: number | null;
  accessDurationValue: number | null;
  accessDurationUnit: 'DAYS' | 'WEEKS' | 'MONTHS' | null;
}

export interface AcademyContentPublishingWorkflowProps {
  open: boolean;
  files: File[];
  courseId: string;
  destinationId: string | null;
  destinationLabel: string;
  destinationHeading: string;
  onClose: () => void;
  onPublished: (count: number) => Promise<void> | void;
}

const validHeading = (value: string) => {
  const normalized = value.trim().toLowerCase().replaceAll('_', ' ');
  return Boolean(normalized && normalized !== 'untitled' && normalized !== 'untitled page');
};

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** unit).toFixed(unit ? 1 : 0)} ${units[unit]}`;
};

const normalizeRelativePath = (file: File) => {
  const value = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
  return value.replaceAll('\\', '/').split('/').filter(Boolean).join('/');
};

export function buildAcademyUploadEntries(files: File[]): AcademyUploadEntry[] {
  const folders = new Map<string, AcademyUploadEntry>();
  const fileEntries: AcademyUploadEntry[] = [];

  files.forEach((file, fileIndex) => {
    const relativePath = normalizeRelativePath(file);
    const parts = relativePath.split('/');
    let folderPath = '';
    parts.slice(0, -1).forEach((segment, segmentIndex) => {
      folderPath = folderPath ? `${folderPath}/${segment}` : segment;
      if (!folders.has(folderPath)) {
        const parentPath = folderPath.includes('/') ? folderPath.slice(0, folderPath.lastIndexOf('/')) : '';
        folders.set(folderPath, {
          id: `folder:${folderPath}`,
          kind: 'folder',
          name: segment,
          relativePath: folderPath,
          parentPath,
          depth: segmentIndex,
          pageHeading: segment,
          description: '',
          entityType: 'STUDY_MATERIAL',
          accessType: 'FREE',
          price: null,
          accessDurationValue: null,
          accessDurationUnit: null,
        });
      }
    });
    const parentPath = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
    fileEntries.push({
      id: `file:${fileIndex}:${relativePath}`,
      kind: 'file',
      name: file.name,
      relativePath,
      parentPath,
      depth: Math.max(parts.length - 1, 0),
      file,
      pageHeading: '',
      description: '',
      entityType: file.type.startsWith('video/') || file.type.startsWith('audio/') ? 'MEDIA' : 'STUDY_MATERIAL',
      accessType: 'FREE',
      price: null,
      accessDurationValue: null,
      accessDurationUnit: null,
    });
  });

  return [
    ...Array.from(folders.values()).sort((a, b) => a.depth - b.depth || a.relativePath.localeCompare(b.relativePath)),
    ...fileEntries,
  ];
}

const steps: Array<{ id: UploadStep; label: string }> = [
  { id: 'select', label: 'Select' },
  { id: 'configure', label: 'Configure' },
  { id: 'review', label: 'Review' },
  { id: 'publish', label: 'Publish' },
];

export const AcademyContentPublishingWorkflow: React.FC<AcademyContentPublishingWorkflowProps> = ({
  open,
  files,
  courseId,
  destinationId,
  destinationLabel,
  destinationHeading,
  onClose,
  onPublished,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState<UploadStep>('select');
  const [entries, setEntries] = useState<AcademyUploadEntry[]>(() => buildAcademyUploadEntries(files));
  const [rootHeading, setRootHeading] = useState(destinationHeading);
  const [selectedId, setSelectedId] = useState<string | null>(() => buildAcademyUploadEntries(files).find((entry) => entry.kind === 'file')?.id ?? null);
  const [discarding, setDiscarding] = useState(false);
  const [publishState, setPublishState] = useState<'idle' | 'working' | 'complete' | 'failed'>('idle');
  const [publishMessage, setPublishMessage] = useState('');

  const fileEntries = useMemo(() => entries.filter((entry) => entry.kind === 'file'), [entries]);
  const folderEntries = useMemo(() => entries.filter((entry) => entry.kind === 'folder'), [entries]);
  const selectedEntry = entries.find((entry) => entry.id === selectedId) ?? null;
  const totalSize = fileEntries.reduce((sum, entry) => sum + (entry.file?.size ?? 0), 0);
  const entryValid = (_entry: AcademyUploadEntry) => true;
  const configurationValid = validHeading(rootHeading) && folderEntries.every((entry) => validHeading(entry.pageHeading)) && fileEntries.every(entryValid);
  const stepIndex = steps.findIndex((candidate) => candidate.id === step);

  const appendFiles = (next: File[]) => {
    if (!next.length) return;
    setEntries((current) => buildAcademyUploadEntries([
      ...current.filter((entry) => entry.kind === 'file').map((entry) => entry.file!).filter(Boolean),
      ...next,
    ]));
  };

  const setFolderInput = (node: HTMLInputElement | null) => {
    folderInputRef.current = node;
    if (!node) return;
    node.setAttribute('webkitdirectory', '');
    node.setAttribute('directory', '');
    (node as HTMLInputElement & { webkitdirectory?: boolean }).webkitdirectory = true;
  };

  const updateEntry = (id: string, patch: Partial<AcademyUploadEntry>) => {
    setEntries((current) => current.map((entry) => entry.id === id ? { ...entry, ...patch } : entry));
  };

  const removeFile = (id: string) => {
    setEntries((current) => {
      const remainingFiles = current.filter((entry) => entry.kind === 'file' && entry.id !== id).map((entry) => entry.file!).filter(Boolean);
      return buildAcademyUploadEntries(remainingFiles);
    });
    if (selectedId === id) setSelectedId(null);
  };

  const requestClose = () => {
    if (publishState === 'working') return;
    if (publishState === 'complete' || !entries.length) onClose();
    else setDiscarding(true);
  };

  const publish = async () => {
    if (!configurationValid || !fileEntries.length) return;
    setStep('publish');
    setPublishState('working');
    setPublishMessage('Preparing the Academy destination…');
    try {
      await academyContentApi.updateLocation(courseId, destinationId, rootHeading.trim());
      const folderIds = new Map<string, string | null>([['', destinationId]]);
      for (const folder of folderEntries) {
        setPublishMessage(`Creating ${folder.relativePath}…`);
        const parentId = folderIds.get(folder.parentPath) ?? destinationId;
        const created = await academyContentApi.createFolder(courseId, parentId, folder.name);
        folderIds.set(folder.relativePath, created.id);
        await academyContentApi.updateLocation(courseId, created.id, folder.pageHeading.trim());
      }
      for (const [index, entry] of fileEntries.entries()) {
        setPublishMessage(`Publishing ${index + 1} of ${fileEntries.length}: ${entry.name}`);
        await academyContentApi.upload(courseId, folderIds.get(entry.parentPath) ?? destinationId, entry.file!, {
          description: entry.description.trim() || undefined,
          entityType: entry.entityType,
          displayOrder: index,
        });
      }
      setPublishState('complete');
      setPublishMessage(`${fileEntries.length} file${fileEntries.length === 1 ? '' : 's'} published to this Academy.`);
      await onPublished(fileEntries.length);
    } catch (error) {
      setPublishState('failed');
      setPublishMessage(error instanceof Error ? error.message : 'The backend rejected the publish request.');
    }
  };

  const footer = publishState === 'complete' ? (
    <button className="pf-admin-button pf-admin-button--primary" type="button" onClick={onClose}>Done</button>
  ) : step === 'select' ? <>
    <button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={requestClose}>Cancel</button>
    <button className="pf-admin-button pf-admin-button--primary" type="button" disabled={!fileEntries.length} onClick={() => setStep('configure')}>Continue to Configure</button>
  </> : step === 'configure' ? <>
    <button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={() => setStep('select')}>Back</button>
    <button className="pf-admin-button pf-admin-button--primary" type="button" disabled={!configurationValid} onClick={() => setStep('review')}>Continue to Review</button>
  </> : step === 'review' ? <>
    <button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={() => setStep('configure')}>Back</button>
    <button className="pf-admin-button pf-admin-button--primary" type="button" disabled={!configurationValid || !fileEntries.length} onClick={() => void publish()}>Publish content</button>
  </> : publishState === 'failed' ? <>
    <button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={() => setStep('review')}>Back to review</button>
    <button className="pf-admin-button pf-admin-button--primary" type="button" onClick={() => void publish()}>Retry publish</button>
  </> : null;

  return <AdminDialog
    open={open}
    onClose={requestClose}
    title="Upload & publish content"
    description={`Temporary upload session · Destination: ${destinationLabel}`}
    size="wide"
    footer={footer}
  >
    <div className="pf-publish-workflow">
      <ol className="pf-publish-steps">
        {steps.map((candidate, index) => <li key={candidate.id} className={index === stepIndex ? 'is-active' : index < stepIndex ? 'is-complete' : ''}><span>{index < stepIndex ? <Check /> : index + 1}</span><strong>{candidate.label}</strong></li>)}
      </ol>

      {step === 'select' ? <section className="pf-publish-select">
        <div className="pf-publish-dropzone">
          <span><Upload /></span>
          <div><h3>Files are staged, not published</h3><p>Add more files or folders. Their original hierarchy is preserved until you explicitly publish.</p></div>
          <div>
            <button className="pf-admin-button" type="button" onClick={() => fileInputRef.current?.click()}><FileText /> Add files</button>
            <button className="pf-admin-button" type="button" onClick={() => folderInputRef.current?.click()}><FolderInput /> Add folder</button>
          </div>
        </div>
        <input ref={fileInputRef} hidden multiple type="file" accept={ACADEMY_UPLOAD_ACCEPT} onChange={(event) => { appendFiles(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = ''; }} />
        <input ref={setFolderInput} hidden multiple type="file" onChange={(event) => { appendFiles(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = ''; }} />
        <div className="pf-publish-session-summary">
          <div><FileText /><span><strong>{fileEntries.length}</strong><small>Files selected</small></span></div>
          <div><Folder /><span><strong>{folderEntries.length}</strong><small>Folders preserved</small></span></div>
          <div><Upload /><span><strong>{formatBytes(totalSize)}</strong><small>Session size</small></span></div>
          <div><LockKeyhole /><span><strong>Academy only</strong><small>Server-enforced scope</small></span></div>
        </div>
        <div className="pf-publish-selection-list">
          <header><div><strong>Temporary upload session</strong><small>Nothing has changed in the library</small></div><span>Folder hierarchy preserved</span></header>
          {fileEntries.map((entry) => <div key={entry.id}><FileText /><span><strong>{entry.name}</strong><small>{entry.relativePath} · {formatBytes(entry.file?.size ?? 0)}</small></span><button type="button" aria-label={`Remove ${entry.name}`} onClick={() => removeFile(entry.id)}><Trash2 /></button></div>)}
        </div>
      </section> : null}

      {step === 'configure' ? <section className="pf-publish-configure">
        <aside className="pf-publish-tree">
          <header><div><strong>Upload structure</strong><small>{fileEntries.length} files · {folderEntries.length} folders</small></div></header>
          <div className="pf-publish-tree-scroll">
            {entries.map((entry) => entry.kind === 'folder' ? <button key={entry.id} className="pf-publish-tree-folder" style={{ '--tree-depth': entry.depth } as React.CSSProperties} type="button" onClick={() => setSelectedId(entry.id)}><span /><Folder /><strong>{entry.name}</strong><small>{validHeading(entry.pageHeading) ? 'Ready' : 'Heading required'}</small></button> : <div key={entry.id} className={`pf-publish-tree-file${selectedId === entry.id ? ' is-active' : ''}`} style={{ '--tree-depth': entry.depth } as React.CSSProperties}><span /><button type="button" onClick={() => setSelectedId(entry.id)}><FileText /><span><strong>{entry.name}</strong><small>{entry.relativePath}</small></span></button><i className="ready"><Check /> Ready</i></div>)}
          </div>
        </aside>
        <div className="pf-publish-editor">
          <header><div>{selectedEntry?.kind === 'folder' ? <Folder /> : <FileText />}<span><strong>{selectedEntry?.name ?? 'Destination settings'}</strong><small>Academy-scoped publishing configuration</small></span></div><i className={configurationValid ? 'ready' : 'needs-attention'}>{configurationValid ? 'Ready' : 'Needs attention'}</i></header>
          <div className="pf-publish-editor-scroll">
            <div className="pf-publish-location-card">
              <header><div><Folder /><span><strong>{destinationLabel}</strong><small>Destination page heading</small></span></div><i className={validHeading(rootHeading) ? 'ready' : 'needs-attention'}>{validHeading(rootHeading) ? 'Ready' : 'Required'}</i></header>
              <label>Page heading <b>Required</b><input value={rootHeading} maxLength={160} onChange={(event) => setRootHeading(event.target.value)} /></label>
              {!validHeading(rootHeading) ? <p className="pf-publish-location-warning"><AlertTriangle /> Enter a valid heading before review.</p> : null}
            </div>
            {selectedEntry?.kind === 'folder' ? <div className="pf-publish-location-card">
              <header><div><Folder /><span><strong>{selectedEntry.relativePath}</strong><small>New folder page</small></span></div><i className={validHeading(selectedEntry.pageHeading) ? 'ready' : 'needs-attention'}>{validHeading(selectedEntry.pageHeading) ? 'Ready' : 'Required'}</i></header>
              <label>Page heading <b>Required</b><input value={selectedEntry.pageHeading} maxLength={160} onChange={(event) => updateEntry(selectedEntry.id, { pageHeading: event.target.value })} /></label>
            </div> : selectedEntry?.kind === 'file' ? <div className="pf-publish-bulk">
              <label>Content type<AppSelect value={selectedEntry.entityType} onChange={(event) => updateEntry(selectedEntry.id, { entityType: event.target.value as AcademyEntityType })}><option value="STUDY_MATERIAL">Study material</option><option value="GOVERNMENT_DOCUMENT">Government document</option><option value="QUESTION_PAPER">Question paper</option><option value="REFERENCE_MATERIAL">Reference material</option><option value="MEDIA">Media</option><option value="OTHER">Other</option></AppSelect></label>
              <label>Description<textarea rows={5} maxLength={2000} value={selectedEntry.description} onChange={(event) => updateEntry(selectedEntry.id, { description: event.target.value })} placeholder="Optional description" /></label>
            </div> : <div className="pf-publish-no-file"><p>Select a file or folder to configure it.</p></div>}
            <div className="pf-publish-free-note"><LockKeyhole /><div><strong>Academy-owned content</strong><p>Publishing and commercial access are authorized by the backend and remain limited to this Academy and course.</p></div></div>
          </div>
        </div>
      </section> : null}

      {step === 'review' ? <section className="pf-publish-review">
        <header><div><span className={configurationValid ? 'is-ready' : 'has-issues'}>{configurationValid ? <CheckCircle2 /> : <AlertTriangle />}</span><div><h3>{configurationValid ? 'Ready to publish' : 'Configuration needs attention'}</h3><p>Review the server-authoritative Academy destination before committing.</p></div></div><strong>{destinationLabel}</strong></header>
        <div className="pf-publish-review-stats"><div><strong>{fileEntries.length}</strong><span>Files</span></div><div><strong>{folderEntries.length}</strong><span>Folders</span></div><div><strong>{formatBytes(totalSize)}</strong><span>Total size</span></div><div><strong>Academy</strong><span>Access scope</span></div><div><strong>{configurationValid ? 'Ready' : 'Blocked'}</strong><span>Validation</span></div></div>
        <div className="pf-publish-review-list">{fileEntries.map((entry) => <article key={entry.id}><FileText /><div><strong>{entry.name}</strong><small>{entry.relativePath}</small></div><span>Academy access</span><i>{entryValid(entry) ? 'Ready' : 'Needs attention'}</i>{entryValid(entry) ? <CheckCircle2 /> : <AlertTriangle />}</article>)}</div>
        <p className="pf-publish-review-assurance"><LockKeyhole /> No file, folder, or metadata is written until you select Publish content.</p>
      </section> : null}

      {step === 'publish' ? <section className={`pf-publish-progress pf-publish-progress--${publishState}`}>
        <span>{publishState === 'working' ? <LoaderCircle className="is-spinning" /> : publishState === 'complete' ? <CheckCircle2 /> : <AlertTriangle />}</span>
        <h3>{publishState === 'working' ? 'Publishing Academy content' : publishState === 'complete' ? 'Publishing complete' : 'Publishing stopped'}</h3>
        <p>{publishMessage}</p>
        <div>{[0, 1, 2, 3].map((part) => <i key={part} className={publishState === 'complete' || (publishState === 'working' && part <= 2) ? 'is-active' : ''} />)}</div>
      </section> : null}

      {discarding ? <div className="pf-publish-discard"><div><AlertTriangle /><h3>Discard upload session?</h3><p>The selected files and configuration will be removed. Nothing has been published.</p><div><button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={() => setDiscarding(false)}>Keep editing</button><button className="pf-admin-button pf-admin-button--danger" type="button" onClick={onClose}>Discard session</button></div></div></div> : null}
    </div>
  </AdminDialog>;
};
