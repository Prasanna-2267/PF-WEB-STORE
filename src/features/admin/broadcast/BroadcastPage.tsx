import { AppSelect } from '@/components/ui/AppSelect';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Archive,
  BellRing,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Eye,
  FileText,
  ImagePlus,
  Megaphone,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Smartphone,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { useBroadcastStore } from '@/app/store/useBroadcastStore';
import type { BroadcastState } from '@/app/store/useBroadcastStore';
import { useQueryClient } from '@tanstack/react-query';
import { useCourseStore } from '@/app/store/useCourseStore';
import { usePackageStore } from '@/app/store/usePackageStore';
import { useAcademyStore } from '@/app/store/useAcademyStore';
import type { AdminCourse } from '../types/admin';
import type { LearningPackage } from '../packages/types/package';
import type { Academy } from '../academies/types/academy';
import {
  AdminDialog,
  AdminEmptyState,
  AdminPageHeader,
  AdminSkeleton,
  AdminStatusBadge,
  AdminToast,
  type AdminToastData,
} from '../AdminUi';
import { useNavigate } from 'react-router-dom';
import { buildAdminBroadcastPath } from '@/config/routes';
import {
  BROADCAST_AUDIENCE_LABELS,
  BROADCAST_FREQUENCY_LABELS,
  BROADCAST_PLACEMENT_LABELS,
  BROADCAST_TYPE_LABELS,
  BROADCAST_PRESENTATION_LABELS,
  BROADCAST_REPEAT_BEHAVIOR_LABELS,
  allowedPlacementsFor,
  getBroadcastStatus,
  type Broadcast,
  type BroadcastAudienceKind,
  type BroadcastCtaAction,
  type BroadcastFrequency,
  type BroadcastInput,
  type BroadcastPlacement,
  type BroadcastPlatform,
  type BroadcastPriority,
  type BroadcastStatus,
  type BroadcastType,
  type BroadcastPresentation,
  type BroadcastDisplayOrder,
  type BroadcastRepeatBehavior,
} from './types/broadcast';
import './broadcast.css';
import { AdminDateTimePicker } from '../AdminDateTimePicker';

const ease = [0.22, 1, 0.36, 1] as const;
const PAGE_SIZE = 10;
const editorSteps = ['Basic', 'Content', 'Audience', 'Display', 'Schedule', 'Behavior', 'Review'] as const;
type EditorStep = typeof editorSteps[number];
type StatusFilter = 'CURRENT' | 'ALL' | BroadcastStatus;
type SortOption = 'NEWEST' | 'OLDEST' | 'MODIFIED' | 'START' | 'END' | 'PRIORITY';
type DateFilter = 'ANY' | 'TODAY' | 'NEXT_7' | 'LAST_30';
type EditorMode = 'FORM' | 'PREVIEW' | 'DISCARD' | 'CONFIRM';
const BROADCAST_EDITOR_SESSION_PREFIX = 'pf_admin_broadcast_editor_session_v1';

interface BroadcastForm extends BroadcastInput {
  deliveryMode: 'NOW' | 'SCHEDULED';
  expirationMode: 'NONE' | 'AT';
}

interface BroadcastEditorRecovery {
  form: BroadcastForm;
  step: EditorStep;
  savedAt: string;
}

const readEditorRecovery = (key: string): BroadcastEditorRecovery | null => {
  try {
    const stored = window.sessionStorage.getItem(key);
    if (!stored) return null;
    const recovery = JSON.parse(stored) as Partial<BroadcastEditorRecovery>;
    if (!recovery.form || typeof recovery.form.title !== 'string' || !editorSteps.includes(recovery.step as EditorStep)) return null;
    return recovery as BroadcastEditorRecovery;
  } catch {
    return null;
  }
};

interface PendingAction {
  broadcast: Broadcast;
  kind: 'DISABLE' | 'ENABLE' | 'CANCEL_SCHEDULE' | 'PUBLISH' | 'ARCHIVE' | 'RESTORE' | 'DELETE';
}

const emptyForm = (scope: 'platform' | 'academy' = 'platform'): BroadcastForm => ({
  title: '', subtitle: '', message: '', type: 'ANNOUNCEMENT', priority: 'NORMAL', image: null,
  cta: { enabled: false, text: '', action: 'INTERNAL_ROUTE', destination: '' },
  audience: { kind: scope === 'academy' ? 'ACADEMY_STUDENTS' : 'EVERYONE', courseIds: [], packageIds: [], academyIds: [] },
  platform: 'APP', placements: ['NOTIFICATION'], startAt: null, endAt: null,
  frequency: 'ONCE', dismissible: true, deliveryMode: 'NOW', expirationMode: 'NONE',
  presentation: 'NOTIFICATION', displayOrder: 'AUTOMATIC', customOrderWeight: 50,
  acknowledgementRequired: false, repeatBehavior: 'NEVER', showInWhatsNew: false,
});

const toLocalInput = (value: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const toIso = (value: string): string | null => value ? new Date(value).toISOString() : null;
const formFromBroadcast = (broadcast: Broadcast): BroadcastForm => ({
  title: broadcast.title, subtitle: broadcast.subtitle, message: broadcast.message, type: broadcast.type,
  priority: broadcast.priority, image: broadcast.image, cta: { ...broadcast.cta }, audience: { ...broadcast.audience, courseIds: [...broadcast.audience.courseIds], packageIds: [...broadcast.audience.packageIds], academyIds: [...broadcast.audience.academyIds] },
  platform: broadcast.platform, placements: [...broadcast.placements], startAt: broadcast.startAt, endAt: broadcast.endAt,
  frequency: broadcast.frequency, dismissible: broadcast.dismissible,
  deliveryMode: broadcast.status === 'SCHEDULED' ? 'SCHEDULED' : 'NOW', expirationMode: broadcast.endAt ? 'AT' : 'NONE',
  presentation: broadcast.presentation, displayOrder: broadcast.displayOrder, customOrderWeight: broadcast.customOrderWeight || 50,
  acknowledgementRequired: broadcast.acknowledgementRequired, repeatBehavior: broadcast.repeatBehavior, showInWhatsNew: broadcast.showInWhatsNew,
});

const inputFromForm = (form: BroadcastForm): BroadcastInput => ({
  title: form.title, subtitle: form.subtitle, message: form.message, type: form.type, priority: form.priority,
  image: form.image, cta: { ...form.cta }, audience: { ...form.audience }, platform: form.platform,
  placements: [...form.placements], startAt: form.deliveryMode === 'SCHEDULED' ? form.startAt : null,
  endAt: form.expirationMode === 'AT' ? form.endAt : null, frequency: form.frequency, dismissible: form.dismissible,
  presentation: form.presentation, displayOrder: form.displayOrder, customOrderWeight: form.customOrderWeight,
  acknowledgementRequired: form.acknowledgementRequired, repeatBehavior: form.repeatBehavior, showInWhatsNew: form.showInWhatsNew,
});

const formatDateTime = (value: string | null): string => value
  ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
  : 'No expiry';
const formatDate = (value: string): string => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
const priorityRank: Record<BroadcastPriority, number> = { LOW: 1, NORMAL: 2, HIGH: 3, CRITICAL: 4 };
const statusTone = (status: BroadcastStatus): 'success' | 'warning' | 'danger' | 'info' | 'neutral' => {
  if (status === 'ACTIVE') return 'success';
  if (status === 'SCHEDULED') return 'info';
  if (status === 'DRAFT') return 'warning';
  if (status === 'DISABLED') return 'danger';
  return 'neutral';
};

const getAudienceSummary = (broadcast: Broadcast, courses: AdminCourse[], packages: LearningPackage[], academies: Academy[]): string => {
  const { audience } = broadcast;
  if (audience.kind === 'COURSES') return audience.courseIds.map((id) => courses.find((item) => item.id === id)?.name).filter(Boolean).join(', ') || 'No courses selected';
  if (audience.kind === 'PACKAGES') return audience.packageIds.map((id) => packages.find((item) => item.id === id)?.title).filter(Boolean).join(', ') || 'No packages selected';
  if (audience.kind === 'ACADEMIES' || audience.kind === 'ACADEMY_STUDENTS') {
    const names = audience.academyIds.map((id) => academies.find((item) => item.id === id)?.name).filter(Boolean).join(', ');
    return names || (audience.kind === 'ACADEMY_STUDENTS' ? 'All academy students' : 'No academies selected');
  }
  return BROADCAST_AUDIENCE_LABELS[audience.kind];
};

const validateForm = (form: BroadcastForm): Record<string, string> => {
  const errors: Record<string, string> = {};
  if (!form.title.trim()) errors.title = 'Enter a broadcast title.';
  if (!form.message.trim()) errors.message = 'Enter the message users should see.';
  if (form.cta.enabled) {
    if (!form.cta.text.trim()) errors.ctaText = 'Enter CTA button text.';
    if (!form.cta.destination.trim()) errors.ctaDestination = 'Choose or enter a CTA destination.';
    if (form.cta.action === 'EXTERNAL_URL') {
      try { const url = new URL(form.cta.destination); if (!['http:', 'https:'].includes(url.protocol)) throw new Error(); }
      catch { errors.ctaDestination = 'Enter a valid http:// or https:// URL.'; }
    }
  }
  if (form.audience.kind === 'COURSES' && !form.audience.courseIds.length) errors.audience = 'Select at least one course.';
  if (form.audience.kind === 'PACKAGES' && !form.audience.packageIds.length) errors.audience = 'Select at least one package.';
  if (form.audience.kind === 'ACADEMIES' && !form.audience.academyIds.length) errors.audience = 'Select at least one academy.';
  if (!form.placements.length) errors.placements = 'Select at least one display placement.';
  if (form.deliveryMode === 'SCHEDULED') {
    if (!form.startAt) errors.startAt = 'Choose a publishing date and time.';
    else if (new Date(form.startAt).getTime() <= Date.now()) errors.startAt = 'Scheduled time must be in the future.';
  }
  if (form.expirationMode === 'AT') {
    if (!form.endAt) errors.endAt = 'Choose an expiration date and time.';
    else {
      const startTime = form.deliveryMode === 'SCHEDULED' && form.startAt ? new Date(form.startAt).getTime() : Date.now();
      if (new Date(form.endAt).getTime() <= startTime) errors.endAt = 'Expiration must be after the broadcast starts.';
    }
  }
  return errors;
};

const isTargetedAudience = (kind: BroadcastAudienceKind) => ['COURSES', 'PACKAGES', 'ACADEMIES', 'ACADEMY_STUDENTS'].includes(kind);

const BroadcastPreview: React.FC<{ form: BroadcastForm; mode: 'MOBILE' | 'DESKTOP'; onModeChange?: (mode: 'MOBILE' | 'DESKTOP') => void }> = ({ form, mode, onModeChange }) => (
  <div className="pf-broadcast-preview-wrap">
    {onModeChange ? (
      <div className="pf-broadcast-preview-modes" role="group" aria-label="Preview size">
        {(['MOBILE', 'DESKTOP'] as const).map((item) => <button type="button" key={item} className={mode === item ? 'is-active' : ''} onClick={() => onModeChange(item)}>{item === 'MOBILE' ? 'Mobile' : 'Desktop'}</button>)}
      </div>
    ) : null}
    <div className={`pf-broadcast-device pf-broadcast-device--${mode.toLowerCase()}`}>
      <motion.article key={`${form.title}-${form.image?.name ?? 'text'}`} className={`pf-broadcast-preview pf-broadcast-preview--${form.presentation.toLowerCase().replace('_', '-')} pf-broadcast-preview--${form.priority.toLowerCase()}`} initial={{ opacity: 0, scale: .985 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .22, ease }}>
        {form.image ? <img src={form.image.dataUrl} alt="Broadcast banner preview" /> : null}
        <header className="pf-broadcast-preview-header">
          <span>{BROADCAST_TYPE_LABELS[form.type]}</span>
          {form.priority === 'CRITICAL' ? <span className="pf-broadcast-priority-badge pf-broadcast-priority-badge--critical"><ShieldAlert size={14} /> Critical</span> : form.priority === 'HIGH' ? <span className="pf-broadcast-priority-badge pf-broadcast-priority-badge--high"><ShieldAlert size={14} /> High priority</span> : null}
        </header>
        <h3>{form.title || 'Your broadcast title'}</h3>
        {form.subtitle ? <h4>{form.subtitle}</h4> : null}
        <p>{form.message || 'Your announcement message will appear here.'}</p>
        {(form.cta.enabled || form.acknowledgementRequired) ? <div className="pf-broadcast-preview-actions">
          {form.acknowledgementRequired ? <button type="button" className="pf-broadcast-preview-btn-ack">I understand</button> : null}
          {form.cta.enabled ? <button type="button" className="pf-broadcast-preview-btn-cta">{form.cta.text || 'Call to action'} <ChevronRight size={15} /></button> : null}
        </div> : null}
      </motion.article>
    </div>
  </div>
);

interface EditorProps {
  broadcast: Broadcast | null;
  courses: AdminCourse[];
  packages: LearningPackage[];
  academies: Academy[];
  store: BroadcastState;
  scope: 'platform' | 'academy';
  onClose: () => void;
  onComplete: (message: string) => void;
}

const BroadcastEditor: React.FC<EditorProps> = ({ broadcast, courses, packages, academies, store, scope, onClose, onComplete }) => {
  const sessionKey = `${BROADCAST_EDITOR_SESSION_PREFIX}:${scope}:${broadcast?.id ?? 'new'}`;
  const source = useMemo(() => broadcast ? formFromBroadcast(broadcast) : emptyForm(scope), [broadcast, scope]);
  const recovery = useMemo(() => readEditorRecovery(sessionKey), [sessionKey]);
  const initial = recovery?.form ?? source;
  const [form, setForm] = useState<BroadcastForm>(initial);
  const [baseline, setBaseline] = useState(JSON.stringify(source));
  const [step, setStep] = useState<EditorStep>(recovery?.step ?? 'Basic');
  const [mode, setMode] = useState<EditorMode>('FORM');
  const [previewMode, setPreviewMode] = useState<'MOBILE' | 'DESKTOP'>('MOBILE');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const dirty = JSON.stringify(form) !== baseline;
  const activeWarning = broadcast?.status === 'ACTIVE';

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  useEffect(() => {
    try {
      if (!dirty) {
        window.sessionStorage.removeItem(sessionKey);
        return;
      }
      const value: BroadcastEditorRecovery = { form, step, savedAt: new Date().toISOString() };
      window.sessionStorage.setItem(sessionKey, JSON.stringify(value));
    } catch {
      // Recovery is a convenience only; storage limits must never block editing.
    }
  }, [dirty, form, sessionKey, step]);

  const changeStep = (newStep: EditorStep) => {
    setStep(newStep);
    setSubmitError(null);
    const scrollContainer = editorRef.current?.closest('.pf-admin-dialog__body');
    if (scrollContainer) {
      scrollContainer.scrollTop = 0;
    }
  };

  useEffect(() => {
    setSubmitError(null);
  }, [form]);

  const patchForm = <K extends keyof BroadcastForm>(key: K, value: BroadcastForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const clearRecovery = () => { try { window.sessionStorage.removeItem(sessionKey); } catch { /* no-op */ } };
  const closeEditor = () => { clearRecovery(); onClose(); };
  const requestClose = () => dirty ? setMode('DISCARD') : closeEditor();
  const currentIndex = editorSteps.indexOf(step);
  const allErrors = validateForm(form);

  const chooseAudience = (kind: BroadcastAudienceKind) => patchForm('audience', { kind, courseIds: [], packageIds: [], academyIds: [] });
  const toggleAudienceId = (key: 'courseIds' | 'packageIds' | 'academyIds', id: string) => setForm((current) => {
    const ids = current.audience[key];
    const next = ids.includes(id) ? ids.filter((item) => item !== id) : scope === 'academy' && key === 'courseIds' ? [id] : [...ids, id];
    return { ...current, audience: { ...current.audience, [key]: next } };
  });
  const changePlatform = (platform: BroadcastPlatform) => setForm((current) => {
    const allowed = allowedPlacementsFor(platform);
    const placements = current.placements.filter((placement) => allowed.includes(placement));
    return { ...current, platform, placements: placements.length ? placements : [allowed[0]] };
  });
  const togglePlacement = (placement: BroadcastPlacement) => setForm((current) => ({ ...current, placements: current.placements.includes(placement) ? current.placements.filter((item) => item !== placement) : [...current.placements, placement] }));

  const handleImage = (file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setErrors((current) => ({ ...current, image: 'Use a JPG, PNG, or WebP image.' })); return; }
    if (file.size > 5 * 1024 * 1024) { setErrors((current) => ({ ...current, image: 'Image must be smaller than 5 MB.' })); return; }
    const reader = new FileReader();
    reader.onload = () => { patchForm('image', { name: file.name, mimeType: file.type, size: file.size, dataUrl: String(reader.result) }); setErrors((current) => ({ ...current, image: '' })); };
    reader.readAsDataURL(file);
  };

  const saveDraft = async () => {
    if (saving) return; setSaving(true); setSubmitError(null);
    try {
      if (broadcast) await store.updateBroadcast(broadcast.id, inputFromForm(form));
      else await store.createDraft(inputFromForm(form));
      setBaseline(JSON.stringify(form)); clearRecovery(); onComplete(broadcast?.status === 'ACTIVE' ? 'Active broadcast changes saved.' : 'Broadcast saved as draft.');
    } catch (error) { setSubmitError(error instanceof Error ? error.message : 'The broadcast could not be saved.'); }
    finally { setSaving(false); }
  };

  const beginFinalAction = () => {
    const nextErrors = validateForm(form); setErrors(nextErrors);
    if (Object.keys(nextErrors).length) { setStep('Review'); setSubmitError('Complete the highlighted information before continuing.'); return; }
    setSubmitError(null); setMode('CONFIRM');
  };

  const completeFinalAction = async () => {
    if (saving) return; setSaving(true); setSubmitError(null);
    try {
      const input = inputFromForm(form);
      if (broadcast?.status === 'ACTIVE') {
        await store.updateBroadcast(broadcast.id, input);
        clearRecovery(); onComplete('Active broadcast updated. Changes may affect users immediately.');
      } else {
        let id = broadcast?.id;
        if (!id) id = (await store.createDraft(input)).id;
        else await store.updateBroadcast(id, input);
        if (form.deliveryMode === 'SCHEDULED') await store.scheduleBroadcast(id, input);
        else await store.publishNow(id, input);
        clearRecovery(); onComplete(form.deliveryMode === 'SCHEDULED' ? 'Broadcast scheduled successfully.' : 'Broadcast published successfully.');
      }
    } catch (error) { setMode('FORM'); setSubmitError(error instanceof Error ? error.message : 'The broadcast could not be published.'); }
    finally { setSaving(false); }
  };

  const editorFooter = (
    <div className="pf-broadcast-editor__footer">
      {submitError ? <div className="pf-broadcast-submit-error"><ShieldAlert size={17} /><span>{submitError}</span></div> : null}
      <div className="pf-admin-dialog__actions">
        {mode === 'DISCARD' ? <>
          <button className="pf-admin-button pf-admin-button--secondary" type="button" onClick={() => setMode('FORM')}>Keep editing</button>
          <button className="pf-admin-button pf-admin-button--danger" type="button" onClick={closeEditor}>Discard changes</button>
        </> : mode === 'CONFIRM' ? <>
          <button className="pf-admin-button pf-admin-button--secondary" type="button" disabled={saving} onClick={() => setMode('FORM')}>Back to editor</button>
          <button className="pf-admin-button" type="button" disabled={saving} onClick={() => void completeFinalAction()}><Send size={15} /> {saving ? 'Publishing...' : 'Confirm publish'}</button>
        </> : mode === 'PREVIEW' ? <button className="pf-admin-button pf-admin-button--secondary" type="button" onClick={() => setMode('FORM')}>Back to editor</button>
          : <>
            <button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={requestClose}>Cancel</button>
            <div className="pf-broadcast-footer__right">
              <button className="pf-admin-button pf-admin-button--secondary" type="button" disabled={saving} onClick={() => void saveDraft()}><FileText size={15} /> {broadcast ? 'Save changes' : 'Save draft'}</button>
              <button className="pf-admin-button pf-admin-button--secondary" type="button" onClick={() => setMode('PREVIEW')}><Eye size={15} /> Preview</button>
              <div className="pf-broadcast-footer__nav">
                {currentIndex > 0 ? <button className="pf-admin-button pf-admin-button--secondary" type="button" onClick={() => changeStep(editorSteps[currentIndex - 1])}><ChevronLeft size={15} /> Back</button> : null}
                {currentIndex < editorSteps.length - 1 ? <button className="pf-admin-button" type="button" onClick={() => changeStep(editorSteps[currentIndex + 1])}>Continue <ChevronRight size={15} /></button> : <button className="pf-admin-button" type="button" disabled={saving} onClick={beginFinalAction}>{activeWarning ? 'Review changes' : form.deliveryMode === 'SCHEDULED' ? 'Review schedule' : 'Review publish'} <ChevronRight size={15} /></button>}
              </div>
            </div>
          </>}
      </div>
    </div>
  );

  return (
    <AdminDialog open onClose={requestClose} title={broadcast ? `Edit ${broadcast.title}` : 'New broadcast'} description="Create a controlled communication for a clearly defined audience." size="wide" footer={editorFooter}>
      <div ref={editorRef} className="pf-broadcast-editor">
        {mode === 'DISCARD' ? <div className="pf-broadcast-decision"><ShieldAlert size={28} /><h3>Discard changes?</h3><p>Your unsaved broadcast configuration will be lost. Existing broadcasts and drafts are not affected.</p></div>
          : mode === 'CONFIRM' ? (
            <div className="pf-broadcast-decision pf-broadcast-decision--publish">
              <header className="pf-broadcast-decision__header">
                <Send size={28} />
                <h3>{activeWarning ? 'Save changes to this active broadcast?' : form.deliveryMode === 'SCHEDULED' ? 'Schedule this broadcast?' : 'Publish this broadcast?'}</h3>
                <p className="pf-broadcast-decision__warning">{activeWarning ? 'Once published, changes may affect users immediately according to your settings.' : form.deliveryMode === 'SCHEDULED' ? `Scheduled for ${formatDateTime(form.startAt)}.` : 'This broadcast will become visible immediately after confirmation.'}</p>
              </header>
              <div className="pf-broadcast-decision__split">
                <div className="pf-broadcast-decision__preview-wrap">
                  <BroadcastPreview form={form} mode="DESKTOP" />
                </div>
                <aside className="pf-broadcast-decision__summary">
                  <h4>Publish summary</h4>
                  <dl>
                    <div><dt>Audience</dt><dd>{getAudienceSummary({ audience: form.audience } as any, courses, packages, academies)}</dd></div>
                    <div><dt>Delivery</dt><dd>{form.deliveryMode === 'SCHEDULED' ? 'Scheduled' : 'Immediately'}</dd></div>
                    <div><dt>Priority</dt><dd>{form.priority.charAt(0) + form.priority.slice(1).toLowerCase()}</dd></div>
                    <div><dt>Display</dt><dd>{form.placements.length > 0 ? form.placements.map(p => BROADCAST_PLACEMENT_LABELS[p]).join(', ') : 'None'}</dd></div>
                  </dl>
                </aside>
              </div>
            </div>
          )
            : mode === 'PREVIEW' ? <BroadcastPreview form={form} mode={previewMode} onModeChange={setPreviewMode} />
              : <>
                {recovery ? <p className="pf-broadcast-callout"><RefreshCw size={17} /> Unsaved work from this browser session was restored.</p> : null}
                {activeWarning ? <div className="pf-broadcast-warning"><ShieldAlert size={18} /><span><strong>This broadcast is currently active.</strong> Changes may affect users immediately and require confirmation.</span></div> : null}
                <div className="pf-broadcast-editor__steps-wrapper">
                  <nav className="pf-broadcast-editor__steps" aria-label="Broadcast editor sections">
                    {editorSteps.map((item, index) => <button key={item} type="button" className={step === item ? 'is-active' : ''} onClick={() => changeStep(item)}><span>{index + 1}</span>{item}</button>)}
                  </nav>
                </div>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.section key={step} className="pf-broadcast-editor__section" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }} transition={{ duration: .18, ease }}>
                    {step === 'Basic' ? <BasicStep form={form} patch={patchForm} errors={errors} scope={scope} /> : null}
                    {step === 'Content' ? <ContentStep form={form} patch={patchForm} errors={errors} courses={courses} packages={packages} academies={academies} fileRef={fileRef} onImage={handleImage} scope={scope} /> : null}
                    {step === 'Audience' ? <AudienceStep form={form} choose={chooseAudience} toggle={toggleAudienceId} courses={courses} packages={packages} academies={academies} error={errors.audience} scope={scope} /> : null}
                    {step === 'Display' ? <DisplayStep form={form} patch={patchForm} changePlatform={changePlatform} togglePlacement={togglePlacement} error={errors.placements} scope={scope} /> : null}
                    {step === 'Schedule' ? <ScheduleStep form={form} patch={patchForm} errors={errors} /> : null}
                    {step === 'Behavior' ? <BehaviorStep form={form} patch={patchForm} /> : null}
                    {step === 'Review' ? <ReviewStep form={form} errors={allErrors} courses={courses} packages={packages} academies={academies} onJump={changeStep} /> : null}
                  </motion.section>
                </AnimatePresence>
                {submitError ? <p className="pf-broadcast-submit-error" role="alert">{submitError}</p> : null}
              </>}
      </div>
    </AdminDialog>
  );
};

interface StepProps { form: BroadcastForm; patch: <K extends keyof BroadcastForm>(key: K, value: BroadcastForm[K]) => void; errors?: Record<string, string>; scope?: 'platform' | 'academy'; }

const BasicStep: React.FC<StepProps> = ({ form, patch, errors = {}, scope = 'platform' }) => <>
  <header><span>Basic information</span><h3>What are you communicating?</h3><p>Give the message a clear identity before choosing who will receive it.</p></header>
  <div className="pf-broadcast-form-grid">
    <label className="pf-broadcast-field pf-broadcast-field--wide"><span>Title *</span><input className="pf-admin-input" value={form.title} maxLength={140} onChange={(event) => patch('title', event.target.value)} placeholder="e.g. New CA Foundation notes are available" />{errors.title ? <em>{errors.title}</em> : <small>{form.title.length}/140</small>}</label>
    <label className="pf-broadcast-field"><span>Short subtitle <small>Optional</small></span><input className="pf-admin-input" value={form.subtitle} maxLength={100} onChange={(event) => patch('subtitle', event.target.value)} placeholder="A short supporting line" /></label>
    <label className="pf-broadcast-field"><span>Broadcast type *</span><AppSelect className="pf-admin-select" value={form.type} onChange={(event) => patch('type', event.target.value as BroadcastType)}>{Object.entries(BROADCAST_TYPE_LABELS).filter(([value]) => scope === 'platform' || !['PROMOTION', 'STORE'].includes(value)).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</AppSelect></label>
    <label className="pf-broadcast-field pf-broadcast-field--wide"><span>Main message *</span><textarea className="pf-admin-textarea" rows={7} maxLength={1200} value={form.message} onChange={(event) => patch('message', event.target.value)} placeholder="Write the announcement exactly as users should see it." />{errors.message ? <em>{errors.message}</em> : <small>{form.message.length}/1200</small>}</label>
  </div>
</>;

interface ContentStepProps extends StepProps { courses: AdminCourse[]; packages: LearningPackage[]; academies: Academy[]; fileRef: React.RefObject<HTMLInputElement>; onImage: (file?: File) => void; }
const ContentStep: React.FC<ContentStepProps> = ({ form, patch, errors = {}, courses, packages, academies, fileRef, onImage, scope = 'platform' }) => {
  const destinationOptions = form.cta.action === 'COURSE' ? courses.map((item) => ({ id: item.id, label: item.name })) : form.cta.action === 'PACKAGE' ? packages.map((item) => ({ id: item.id, label: item.title })) : form.cta.action === 'ACADEMY' ? academies.map((item) => ({ id: item.id, label: item.name })) : [];
  const ctaAction = (action: BroadcastCtaAction) => patch('cta', { ...form.cta, action, destination: action === 'STORE' ? '/store' : '' });
  return <>
    <header><span>Content & presentation</span><h3>Shape the announcement.</h3><p>Images and calls to action are optional. Text-only broadcasts remain fully supported.</p></header>
    <div className="pf-broadcast-content-grid">
      <div className="pf-broadcast-image-field">
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => onImage(event.target.files?.[0])} />
        {form.image ? <><img src={form.image.dataUrl} alt="Selected broadcast banner" /><div className="pf-broadcast-image-meta"><div><strong>{form.image.name}</strong><small>{Math.round(form.image.size / 1024)} KB · {form.image.mimeType}</small></div><span><button type="button" onClick={() => fileRef.current?.click()}><Upload size={14} /> Replace</button><button type="button" onClick={() => patch('image', null)}><Trash2 size={14} /> Remove</button></span></div></> : <button type="button" onClick={() => fileRef.current?.click()}><ImagePlus size={24} /><strong>Add an optional banner</strong><small>JPG, PNG or WebP · maximum 5 MB</small></button>}
        {errors.image ? <em>{errors.image}</em> : null}
      </div>
      <fieldset className="pf-broadcast-fieldset">
        <legend>Call to action</legend>
        <label className="pf-broadcast-switch"><input type="checkbox" checked={form.cta.enabled} onChange={(event) => patch('cta', { ...form.cta, enabled: event.target.checked })} /><span aria-hidden="true" /><strong>{form.cta.enabled ? 'CTA enabled' : 'No CTA'}</strong></label>
        {form.cta.enabled ? <div className="pf-broadcast-form-grid">
          <label className="pf-broadcast-field"><span>Button text *</span><input className="pf-admin-input" value={form.cta.text} onChange={(event) => patch('cta', { ...form.cta, text: event.target.value })} placeholder="e.g. View notes" />{errors.ctaText ? <em>{errors.ctaText}</em> : null}</label>
          <label className="pf-broadcast-field"><span>Button action *</span><AppSelect className="pf-admin-select" value={form.cta.action} onChange={(event) => ctaAction(event.target.value as BroadcastCtaAction)}><option value="INTERNAL_ROUTE">Open inside Parallax Flow</option><option value="EXTERNAL_URL">Open external website</option>{scope === 'platform' ? <option value="STORE">Open Store</option> : null}<option value="COURSE">Open Course</option>{scope === 'platform' ? <option value="PACKAGE">Open Package</option> : null}{scope === 'platform' ? <option value="ACADEMY">Open Academy</option> : null}<option value="CONTENT">Open specific content</option></AppSelect></label>
          {form.cta.action === 'COURSE' || form.cta.action === 'PACKAGE' || form.cta.action === 'ACADEMY' ? <label className="pf-broadcast-field pf-broadcast-field--wide"><span>Select destination *</span><AppSelect className="pf-admin-select" value={form.cta.destination} onChange={(event) => patch('cta', { ...form.cta, destination: event.target.value })}><option value="">Choose…</option>{destinationOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</AppSelect>{errors.ctaDestination ? <em>{errors.ctaDestination}</em> : null}</label>
            : form.cta.action !== 'STORE' ? <label className="pf-broadcast-field pf-broadcast-field--wide"><span>{form.cta.action === 'EXTERNAL_URL' ? 'External URL' : form.cta.action === 'CONTENT' ? scope === 'academy' ? 'Academy content ID' : 'Content ID or path' : 'Internal route'} *</span><input className="pf-admin-input" value={form.cta.destination} onChange={(event) => patch('cta', { ...form.cta, destination: event.target.value })} placeholder={form.cta.action === 'EXTERNAL_URL' ? 'https://example.com' : form.cta.action === 'CONTENT' && scope === 'academy' ? 'Academy content UUID' : scope === 'academy' ? '/academy/courses' : '/store or content identifier'} />{errors.ctaDestination ? <em>{errors.ctaDestination}</em> : null}</label> : null}
        </div> : <p className="pf-broadcast-help">Users will only receive the announcement content, with no action button.</p>}
      </fieldset>
    </div>
  </>;
};

interface AudienceStepProps { form: BroadcastForm; choose: (kind: BroadcastAudienceKind) => void; toggle: (key: 'courseIds' | 'packageIds' | 'academyIds', id: string) => void; courses: AdminCourse[]; packages: LearningPackage[]; academies: Academy[]; error?: string; scope: 'platform' | 'academy'; }
const AudienceStep: React.FC<AudienceStepProps> = ({ form, choose, toggle, courses, packages, academies, error, scope }) => {
  const options = (Object.entries(BROADCAST_AUDIENCE_LABELS) as [BroadcastAudienceKind, string][]).filter(([kind]) => scope === 'platform' || ['ACADEMY_STUDENTS', 'COURSES'].includes(kind));
  const key = form.audience.kind === 'COURSES' ? 'courseIds' : form.audience.kind === 'PACKAGES' ? 'packageIds' : 'academyIds';
  const items = form.audience.kind === 'COURSES' ? courses.map((item) => ({ id: item.id, label: item.name, detail: item.code })) : form.audience.kind === 'PACKAGES' ? packages.map((item) => ({ id: item.id, label: item.title, detail: item.status })) : academies.map((item) => ({ id: item.id, label: item.name, detail: `${item.studentCount} students` }));
  return <>
    <header><span>Audience targeting</span><h3>Who should receive this?</h3><p>{scope === 'academy' ? 'Audience selection is limited to students in the authenticated Academy.' : 'Parallax Flow and Academy audiences are kept deliberately separate to prevent accidental exposure.'}</p></header>
    {form.audience.kind === 'ACADEMY_STUDENTS' || form.audience.kind === 'ACADEMIES' ? <div className="pf-broadcast-warning"><ShieldAlert size={18} /><span><strong>Academy targeting active.</strong> This broadcast will not be visible to general Parallax Flow users.</span></div> : null}
    <div className="pf-broadcast-choice-grid pf-broadcast-choice-grid--audience">{options.map(([kind, label]) => <button key={kind} type="button" className={form.audience.kind === kind ? 'is-active' : ''} onClick={() => choose(kind)}><Users size={18} /><strong>{label}</strong><small>{kind === 'EVERYONE' ? 'Every Parallax Flow account' : kind === 'STUDENTS' ? 'Direct platform learners only' : kind === 'ACADEMY_STUDENTS' ? 'Students inside selected academies, or all academies' : 'Choose one or multiple below'}</small></button>)}</div>
    {form.audience.kind === 'COURSES' || scope === 'platform' && isTargetedAudience(form.audience.kind) ? <div className="pf-broadcast-targets"><header><strong>{form.audience.kind === 'COURSES' ? 'Courses' : form.audience.kind === 'PACKAGES' ? 'Packages' : 'Academies'}</strong><small>{scope === 'academy' ? 'Select one course owned by this Academy.' : form.audience.kind === 'ACADEMY_STUDENTS' ? 'Leave empty to reach students across all academies.' : 'Select one or multiple.'}</small></header>{items.length ? <div>{items.map((item) => { const selected = form.audience[key].includes(item.id); return <button type="button" key={item.id} className={selected ? 'is-selected' : ''} onClick={() => toggle(key, item.id)}><span>{selected ? <Check size={15} /> : null}</span><strong>{item.label}</strong><small>{item.detail}</small></button>; })}</div> : <p>No eligible options are available yet.</p>}{error ? <em>{error}</em> : null}</div> : null}
  </>;
};

interface DisplayStepProps extends StepProps { changePlatform: (platform: BroadcastPlatform) => void; togglePlacement: (placement: BroadcastPlacement) => void; error?: string; }
const DisplayStep: React.FC<DisplayStepProps> = ({ form, patch, changePlatform, togglePlacement, error, scope = 'platform' }) => <>
  <header><span>Display</span><h3>Where should it appear?</h3><p>Only placements supported by the selected platform can be enabled.</p></header>
  <label className="pf-broadcast-field"><span>Presentation style *</span><AppSelect className="pf-admin-select" value={form.presentation} onChange={(event) => patch('presentation', event.target.value as BroadcastPresentation)}>{Object.entries(BROADCAST_PRESENTATION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</AppSelect></label>
  <fieldset className="pf-broadcast-fieldset">
    <legend>Delivery channel</legend>
    <div className="pf-broadcast-channel-card">
      <Smartphone size={20} />
      <div>
        <strong>Mobile app</strong>
        <small>Delivered to eligible learners in Parallax Flow.</small>
      </div>
      <Check size={16} className="pf-broadcast-channel-check" />
    </div>
  </fieldset>
  <fieldset className="pf-broadcast-fieldset"><legend>Placement</legend><div className="pf-broadcast-choice-grid">{(Object.entries(BROADCAST_PLACEMENT_LABELS) as [BroadcastPlacement, string][]).filter(([placement]) => scope === 'platform' || placement !== 'STORE').map(([placement, label]) => { const allowed = allowedPlacementsFor(form.platform).includes(placement); const selected = form.placements.includes(placement); return <button type="button" key={placement} disabled={!allowed} className={selected ? 'is-active' : ''} onClick={() => togglePlacement(placement)}><BellRing size={18} /><strong>{label}</strong><small>{allowed ? selected ? 'Selected' : 'Available' : `Unavailable for ${form.platform.toLocaleLowerCase()}`}</small></button>; })}</div>{error ? <em className="pf-broadcast-field-error">{error}</em> : null}</fieldset>
  <label className="pf-broadcast-field"><span>Priority</span><AppSelect className="pf-admin-select" value={form.priority} onChange={(event) => patch('priority', event.target.value as BroadcastPriority)}><option value="LOW">Low — minor information</option><option value="NORMAL">Normal — general update</option><option value="HIGH">High — important announcement</option><option value="CRITICAL">Critical — emergency or maintenance</option></AppSelect></label>
  <fieldset className="pf-broadcast-fieldset"><legend>Display order</legend><div className="pf-broadcast-segments"><button type="button" className={form.displayOrder === 'AUTOMATIC' ? 'is-active' : ''} onClick={() => patch('displayOrder', 'AUTOMATIC')}>Automatic</button><button type="button" className={form.displayOrder === 'PINNED' ? 'is-active' : ''} onClick={() => patch('displayOrder', 'PINNED')}>Pinned</button><button type="button" className={form.displayOrder === 'CUSTOM' ? 'is-active' : ''} onClick={() => patch('displayOrder', 'CUSTOM')}>Custom weight</button></div></fieldset>
  {form.displayOrder === 'CUSTOM' ? <label className="pf-broadcast-field"><span>Display Order Weight (1-100)</span><input type="number" min={1} max={100} className="pf-admin-input" value={form.customOrderWeight} onChange={(event) => patch('customOrderWeight', parseInt(event.target.value) || 50)} /><small>Higher values appear before lower values.</small></label> : null}
  <div className="pf-broadcast-dismiss-card"><div><strong>Show in What's New feed</strong><p>{form.showInWhatsNew ? 'This broadcast will be included in the What\'s New timeline.' : 'This broadcast is excluded from the What\'s New feed.'}</p></div><label className="pf-broadcast-switch"><input type="checkbox" checked={form.showInWhatsNew} onChange={(event) => patch('showInWhatsNew', event.target.checked)} /><span aria-hidden="true" /><strong>{form.showInWhatsNew ? 'Yes' : 'No'}</strong></label></div>
</>;

const ScheduleStep: React.FC<StepProps> = ({ form, patch, errors = {} }) => <>
  <header><span>Schedule & expiration</span><h3>When should users see it?</h3><p>Publishing remains an explicit action. Opening this editor never makes a broadcast visible.</p></header>
  <fieldset className="pf-broadcast-fieldset"><legend>Delivery</legend><div className="pf-broadcast-choice-grid pf-broadcast-choice-grid--two"><button type="button" className={form.deliveryMode === 'NOW' ? 'is-active' : ''} onClick={() => patch('deliveryMode', 'NOW')}><Send size={18} /><strong>Publish immediately</strong><small>Becomes active only after final confirmation.</small></button><button type="button" className={form.deliveryMode === 'SCHEDULED' ? 'is-active' : ''} onClick={() => patch('deliveryMode', 'SCHEDULED')}><CalendarClock size={18} /><strong>Schedule for later</strong><small>Choose a future date and time.</small></button></div></fieldset>
  {form.deliveryMode === 'SCHEDULED' ? <label className="pf-broadcast-field" style={{ overflow: 'visible' }}><span>Start date and time (IST / Asia/Kolkata) *</span><AdminDateTimePicker value={form.startAt} min={new Date(Date.now() + 60_000).toISOString()} onChange={(iso) => patch('startAt', iso)} />{errors.startAt ? <em>{errors.startAt}</em> : null}</label> : <p className="pf-broadcast-callout"><Clock3 size={17} /> It will publish immediately after you review and confirm.</p>}
  <fieldset className="pf-broadcast-fieldset"><legend>Expiration</legend><div className="pf-broadcast-segments"><button type="button" className={form.expirationMode === 'NONE' ? 'is-active' : ''} onClick={() => patch('expirationMode', 'NONE')}>No expiry</button><button type="button" className={form.expirationMode === 'AT' ? 'is-active' : ''} onClick={() => patch('expirationMode', 'AT')}>Set expiration</button></div></fieldset>
  {form.expirationMode === 'AT' ? <label className="pf-broadcast-field" style={{ overflow: 'visible' }}><span>End date and time (IST / Asia/Kolkata) *</span><AdminDateTimePicker value={form.endAt} onChange={(iso) => patch('endAt', iso)} />{errors.endAt ? <em>{errors.endAt}</em> : null}</label> : null}
</>;

const BehaviorStep: React.FC<StepProps> = ({ form, patch }) => <>
  <header><span>Behavior</span><h3>How should the message behave?</h3><p>Frequency controls repeat visibility. Dismissibility determines whether users can close it.</p></header>
  <div className="pf-broadcast-form-grid">
    <label className="pf-broadcast-field"><span>Display frequency</span><AppSelect className="pf-admin-select" value={form.frequency} onChange={(event) => patch('frequency', event.target.value as BroadcastFrequency)}>{Object.entries(BROADCAST_FREQUENCY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</AppSelect><small>{form.frequency === 'ONCE' ? 'Shown once to each eligible user.' : form.frequency === 'DAILY' ? 'May appear once per calendar day.' : form.frequency === 'EVERY_VISIT' ? 'Appears at each eligible session.' : form.frequency === 'UNTIL_DISMISSED' ? 'Repeats until the user dismisses it.' : 'Remains visible for the entire active period.'}</small></label>
    <label className="pf-broadcast-field"><span>Repeat behavior</span><AppSelect className="pf-admin-select" value={form.repeatBehavior} onChange={(event) => patch('repeatBehavior', event.target.value as BroadcastRepeatBehavior)}>{Object.entries(BROADCAST_REPEAT_BEHAVIOR_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</AppSelect></label>
  </div>
  <div className="pf-broadcast-dismiss-card"><div><strong>User dismissal</strong><p>{form.dismissible ? 'Users can close this announcement.' : 'The announcement remains visible while active.'}</p></div><label className="pf-broadcast-switch"><input type="checkbox" checked={form.dismissible} onChange={(event) => patch('dismissible', event.target.checked)} /><span aria-hidden="true" /><strong>{form.dismissible ? 'Dismissible' : 'Non-dismissible'}</strong></label></div>
  <div className="pf-broadcast-dismiss-card"><div><strong>User acknowledgement</strong><p>{form.acknowledgementRequired ? 'Users must explicitly acknowledge this announcement.' : 'No acknowledgement required.'}</p></div><label className="pf-broadcast-switch"><input type="checkbox" checked={form.acknowledgementRequired} onChange={(event) => patch('acknowledgementRequired', event.target.checked)} /><span aria-hidden="true" /><strong>{form.acknowledgementRequired ? 'Required' : 'Optional'}</strong></label></div>
  {form.priority === 'CRITICAL' && form.dismissible ? <p className="pf-broadcast-warning"><ShieldAlert size={17} /> Critical announcements are usually clearer when configured as non-dismissible.</p> : null}
  {form.acknowledgementRequired && !form.dismissible ? <p className="pf-broadcast-warning"><ShieldAlert size={17} /> If acknowledgement is required, the broadcast should usually be dismissible so users can close it after acknowledging.</p> : null}
</>;

interface ReviewStepProps { form: BroadcastForm; errors: Record<string, string>; courses: AdminCourse[]; packages: LearningPackage[]; academies: Academy[]; onJump: (step: EditorStep) => void; }
const ReviewStep: React.FC<ReviewStepProps> = ({ form, errors, courses, packages, academies, onJump }) => {
  const pseudo: Broadcast = { id: 'preview', ...inputFromForm(form), status: 'DRAFT', disabledFrom: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), timeline: [], analytics: { reached: 0, viewed: 0, uniqueViews: 0, clicked: 0, dismissed: 0, acknowledged: 0, ctr: 0 } };
  const rows = [
    ['Broadcast', `${BROADCAST_TYPE_LABELS[form.type]} · ${form.priority} priority`, 'Basic'],
    ['Audience', getAudienceSummary(pseudo, courses, packages, academies), 'Audience'],
    ['Display', `${BROADCAST_PRESENTATION_LABELS[form.presentation]} on ${form.platform} · ${form.placements.map((item) => BROADCAST_PLACEMENT_LABELS[item]).join(', ') || 'No placement'}`, 'Display'],
    ['Display Order', form.displayOrder === 'CUSTOM' ? `Custom (Weight: ${form.customOrderWeight})` : form.displayOrder === 'PINNED' ? 'Pinned (Top)' : 'Automatic', 'Display'],
    ["What's New", form.showInWhatsNew ? 'Include in feed' : 'Do not include', 'Display'],
    ['Delivery', form.deliveryMode === 'SCHEDULED' ? formatDateTime(form.startAt) : 'Immediately after confirmation', 'Schedule'],
    ['Expiration', form.expirationMode === 'AT' ? formatDateTime(form.endAt) : 'No expiry', 'Schedule'],
    ['CTA', form.cta.enabled ? `${form.cta.text || 'Missing text'} · ${form.cta.destination || 'Missing destination'}` : 'No CTA', 'Content'],
    ['Behavior', `${BROADCAST_FREQUENCY_LABELS[form.frequency]} · ${form.dismissible ? 'Dismissible' : 'Non-dismissible'}`, 'Behavior'],
    ['Acknowledgement', form.acknowledgementRequired ? 'Required' : 'Not required', 'Behavior'],
  ] as [string, string, EditorStep][];
  return <>
    <header><span>Final review</span><h3>{Object.keys(errors).length ? 'Missing required information' : 'Ready to publish'}</h3><p>Confirm who will see this message, where it appears, and when it becomes active.</p></header>
    {Object.keys(errors).length ? <div className="pf-broadcast-review-errors"><ShieldAlert size={20} /><div><strong>Resolve {Object.keys(errors).length} issue{Object.keys(errors).length === 1 ? '' : 's'} before publishing.</strong>{Object.values(errors).map((error) => <p key={error}>{error}</p>)}</div></div> : <div className="pf-broadcast-ready"><Check size={19} /><span><strong>Configuration complete</strong><small>Nothing is visible until you confirm Publish or Schedule.</small></span></div>}
    <dl className="pf-broadcast-review-list">{rows.map(([label, value, target]) => <div key={label}><dt>{label}</dt><dd>{value}</dd><button type="button" onClick={() => onJump(target)}>Edit</button></div>)}</dl>
  </>;
};

export interface BroadcastPageProps {
  scope?: 'platform' | 'academy';
  academyId?: string | null;
  academyName?: string;
  storeOverride?: BroadcastState;
  academyCourses?: AdminCourse[];
}

export const BroadcastPage: React.FC<BroadcastPageProps> = ({ scope = 'platform', academyId, academyName, storeOverride, academyCourses = [] }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const platformStore = useBroadcastStore();
  const store = storeOverride ?? platformStore;
  const platformCourses = useCourseStore((state) => state.courses);
  const initializeCourses = useCourseStore((state) => state.initialize);
  const platformPackages = usePackageStore((state) => state.packages);
  const initializePackages = usePackageStore((state) => state.initialize);
  const platformAcademies = useAcademyStore((state) => state.academies);
  const initializeAcademies = useAcademyStore((state) => state.initialize);
  const courses = scope === 'academy' ? academyCourses : platformCourses;
  const packages = scope === 'academy' ? [] : platformPackages;
  const academies = scope === 'academy' ? [] : platformAcademies;
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('CURRENT');
  const [typeFilter, setTypeFilter] = useState<'ALL' | BroadcastType>('ALL');
  const [audienceFilter, setAudienceFilter] = useState<'ALL' | BroadcastAudienceKind>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | BroadcastPriority>('ALL');
  const [dateFilter, setDateFilter] = useState<DateFilter>('ANY');
  const [sort, setSort] = useState<SortOption>('MODIFIED');
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<Broadcast | null | undefined>(undefined);
  const [details, setDetails] = useState<Broadcast | null>(null);
  const [preview, setPreview] = useState<Broadcast | null>(null);
  const [previewMode, setPreviewMode] = useState<'MOBILE' | 'DESKTOP'>('MOBILE');
  const [actionMenu, setActionMenu] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [toast, setToast] = useState<AdminToastData | null>(null);

  useEffect(() => {
    if (scope === 'academy') void store.initialize();
    else void Promise.all([store.initialize(), initializeCourses(), initializePackages(), initializeAcademies()]);
  }, [initializeAcademies, initializeCourses, initializePackages, scope, store]);
  useEffect(() => { setPage(1); }, [query, statusFilter, typeFilter, audienceFilter, priorityFilter, dateFilter, sort]);
  useEffect(() => { const close = () => setActionMenu(null); window.addEventListener('click', close); return () => window.removeEventListener('click', close); }, []);

  const broadcasts = useMemo(() => store.broadcasts.map((item) => ({ ...item, status: getBroadcastStatus(item) })), [store.broadcasts]);
  const counts = useMemo(() => ({ total: broadcasts.length, active: broadcasts.filter((item) => item.status === 'ACTIVE').length, scheduled: broadcasts.filter((item) => item.status === 'SCHEDULED').length, draft: broadcasts.filter((item) => item.status === 'DRAFT').length, expired: broadcasts.filter((item) => item.status === 'EXPIRED').length, archived: broadcasts.filter((item) => item.status === 'ARCHIVED').length }), [broadcasts]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(); const now = Date.now(); const day = 86_400_000;
    const result = broadcasts.filter((broadcast) => {
      const audience = getAudienceSummary(broadcast, courses, packages, academies);
      const matchesQuery = !needle || [broadcast.title, broadcast.subtitle, broadcast.message, BROADCAST_TYPE_LABELS[broadcast.type], audience].some((value) => value.toLocaleLowerCase().includes(needle));
      const matchesStatus = statusFilter === 'ALL' || statusFilter === 'CURRENT' ? statusFilter === 'ALL' || broadcast.status !== 'ARCHIVED' : broadcast.status === statusFilter;
      const matchesType = typeFilter === 'ALL' || broadcast.type === typeFilter;
      const matchesAudience = audienceFilter === 'ALL' || broadcast.audience.kind === audienceFilter;
      const matchesPriority = priorityFilter === 'ALL' || broadcast.priority === priorityFilter;
      const reference = new Date(broadcast.startAt ?? broadcast.createdAt).getTime();
      const matchesDate = dateFilter === 'ANY' || dateFilter === 'TODAY' && Math.abs(reference - now) < day || dateFilter === 'NEXT_7' && reference >= now && reference <= now + day * 7 || dateFilter === 'LAST_30' && reference <= now && reference >= now - day * 30;
      return matchesQuery && matchesStatus && matchesType && matchesAudience && matchesPriority && matchesDate;
    });
    return result.sort((a, b) => {
      if (sort === 'OLDEST') return a.createdAt.localeCompare(b.createdAt);
      if (sort === 'MODIFIED') return b.updatedAt.localeCompare(a.updatedAt);
      if (sort === 'START') return (a.startAt ?? '9999').localeCompare(b.startAt ?? '9999');
      if (sort === 'END') return (a.endAt ?? '9999').localeCompare(b.endAt ?? '9999');
      if (sort === 'PRIORITY') {
        const orderA = a.displayOrder === 'CUSTOM' ? (a.customOrderWeight || 50) : a.displayOrder === 'PINNED' ? 1000 : 0;
        const orderB = b.displayOrder === 'CUSTOM' ? (b.customOrderWeight || 50) : b.displayOrder === 'PINNED' ? 1000 : 0;
        if (orderA !== orderB) return orderB - orderA;
        if (priorityRank[a.priority] !== priorityRank[b.priority]) return priorityRank[b.priority] - priorityRank[a.priority];
        return b.updatedAt.localeCompare(a.updatedAt);
      }
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [academies, audienceFilter, broadcasts, courses, dateFilter, packages, priorityFilter, query, sort, statusFilter, typeFilter]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const showToast = (title: string, tone: AdminToastData['tone'] = 'success', message?: string) => setToast({ id: Date.now(), title, message, tone });
  const invalidateScope = async () => {
    if (scope !== 'academy' || !academyId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['academy', academyId, 'broadcasts'] }),
      queryClient.invalidateQueries({ queryKey: ['academy', academyId, 'overview'] }),
    ]);
  };
  const duplicate = async (broadcast: Broadcast) => { try { await store.duplicateBroadcast(broadcast.id); await invalidateScope(); showToast('Broadcast duplicated as draft.'); } catch (error) { showToast(error instanceof Error ? error.message : 'Could not duplicate.', 'error'); } };
  const executeAction = async () => {
    if (!pendingAction) return; const { broadcast, kind } = pendingAction;
    try {
      if (kind === 'DISABLE') await store.disableBroadcast(broadcast.id);
      if (kind === 'ENABLE') await store.enableBroadcast(broadcast.id);
      if (kind === 'CANCEL_SCHEDULE') await store.cancelSchedule(broadcast.id);
      if (kind === 'PUBLISH') await store.publishNow(broadcast.id);
      if (kind === 'ARCHIVE') await store.archiveBroadcast(broadcast.id);
      if (kind === 'RESTORE') await store.restoreBroadcast(broadcast.id);
      if (kind === 'DELETE') await store.deleteBroadcast(broadcast.id);
      await invalidateScope();
      const messages: Record<PendingAction['kind'], string> = { DISABLE: 'Broadcast disabled.', ENABLE: 'Broadcast enabled.', CANCEL_SCHEDULE: 'Schedule cancelled. Broadcast returned to drafts.', PUBLISH: 'Broadcast published successfully.', ARCHIVE: 'Broadcast archived.', RESTORE: 'Broadcast restored as disabled.', DELETE: 'Broadcast deleted.' };
      showToast(messages[kind]); setPendingAction(null); setDetails(null);
    } catch (error) { showToast(error instanceof Error ? error.message : 'The action could not be completed.', 'error'); }
  };

  const openEdit = (broadcast: Broadcast) => { setDetails(null); setEditor(broadcast); };
  const openPreview = (broadcast: Broadcast) => { setDetails(null); setPreview(broadcast); };
  const actionItems = (broadcast: Broadcast) => {
    const items: Array<{ label: string; icon: React.ReactNode; run: () => void; danger?: boolean }> = [];
    const edit = () => items.push({ label: 'Edit', icon: <Pencil size={14} />, run: () => openEdit(broadcast) });
    const view = () => items.push({ label: 'View details', icon: <Eye size={14} />, run: () => scope === 'academy' ? setDetails(broadcast) : navigate(buildAdminBroadcastPath(broadcast.id)) });
    const previewItem = () => items.push({ label: 'Preview', icon: <Eye size={14} />, run: () => openPreview(broadcast) });
    const duplicateItem = () => items.push({ label: 'Duplicate', icon: <Copy size={14} />, run: () => void duplicate(broadcast) });
    if (broadcast.status === 'DRAFT') {
      edit(); previewItem(); duplicateItem();
      items.push({ label: 'Delete', icon: <Trash2 size={14} />, run: () => setPendingAction({ broadcast, kind: 'DELETE' }), danger: true });
    } else if (broadcast.status === 'SCHEDULED') {
      edit(); previewItem(); duplicateItem();
      items.push({ label: 'Publish now', icon: <Send size={14} />, run: () => setPendingAction({ broadcast, kind: 'PUBLISH' }) });
      items.push({ label: 'Cancel schedule', icon: <X size={14} />, run: () => setPendingAction({ broadcast, kind: 'CANCEL_SCHEDULE' }) });
    } else if (broadcast.status === 'ACTIVE') {
      view(); previewItem(); duplicateItem();
      items.push({ label: 'Disable / End', icon: <ShieldAlert size={14} />, run: () => setPendingAction({ broadcast, kind: 'DISABLE' }) });
      items.push({ label: 'View analytics', icon: <FileText size={14} />, run: () => showToast('Analytics coming in Phase 2.', 'info') });
    } else if (broadcast.status === 'EXPIRED') {
      view(); duplicateItem();
      items.push({ label: 'Archive', icon: <Archive size={14} />, run: () => setPendingAction({ broadcast, kind: 'ARCHIVE' }) });
    } else if (broadcast.status === 'ARCHIVED') {
      view(); duplicateItem();
      items.push({ label: 'Restore', icon: <RefreshCw size={14} />, run: () => setPendingAction({ broadcast, kind: 'RESTORE' }) });
    } else {
      edit(); previewItem(); duplicateItem();
      items.push({ label: 'Enable', icon: <Check size={14} />, run: () => setPendingAction({ broadcast, kind: 'ENABLE' }) });
      items.push({ label: 'Archive', icon: <Archive size={14} />, run: () => setPendingAction({ broadcast, kind: 'ARCHIVE' }) });
      items.push({ label: 'Delete', icon: <Trash2 size={14} />, run: () => setPendingAction({ broadcast, kind: 'DELETE' }), danger: true });
    }
    return items;
  };

  const summaryCards = [
    { label: 'Total', value: Number(counts.total || 0), filter: 'ALL' as StatusFilter, icon: <Megaphone size={18} /> },
    { label: 'Active', value: Number(counts.active || 0), filter: 'ACTIVE' as StatusFilter, icon: <BellRing size={18} /> },
    { label: 'Scheduled', value: Number(counts.scheduled || 0), filter: 'SCHEDULED' as StatusFilter, icon: <CalendarClock size={18} /> },
    { label: 'Drafts', value: Number(counts.draft || 0), filter: 'DRAFT' as StatusFilter, icon: <FileText size={18} /> },
    { label: 'Expired', value: Number(counts.expired || 0), filter: 'EXPIRED' as StatusFilter, icon: <Clock3 size={18} /> },
    { label: 'Archived', value: Number(counts.archived || 0), filter: 'ARCHIVED' as StatusFilter, icon: <Archive size={18} /> },
  ];

  const description = scope === 'academy' ? `Create and manage communications only for students in ${academyName ?? 'your Academy'}.` : 'Direct Parallax Flow broadcasts. Academy broadcasts remain in their Academy details page.';
  if (store.status === 'loading' || store.status === 'idle') return <div className="pf-admin-page"><AdminPageHeader title="Broadcast" description={description} /><AdminSkeleton variant="table" rows={7} /></div>;

  return <div className="pf-admin-page pf-broadcast-page">
    <AdminPageHeader title="Broadcast" description={description} actions={<button className="pf-admin-button" type="button" onClick={() => setEditor(null)}><Plus size={16} /> New broadcast</button>} />
    {store.status === 'error' ? <AdminEmptyState title="Broadcasts could not be loaded" description={store.error ?? 'Try loading the workspace again.'} icon={<ShieldAlert size={22} />} action={<button className="pf-admin-button" onClick={() => void store.refresh()}><RefreshCw size={15} /> Try again</button>} /> : <>
      <section className="pf-broadcast-summary" aria-label="Broadcast summary">{summaryCards.map((card, index) => <motion.button key={card.label} type="button" className={statusFilter === card.filter ? 'is-active' : ''} onClick={() => setStatusFilter(card.filter)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .24, delay: index * .035, ease }}><span>{card.icon}</span><small>{card.label}</small><strong>{card.value}</strong></motion.button>)}</section>
      {broadcasts.length === 0 ? <AdminEmptyState title="No broadcasts yet" description={scope === 'academy' ? 'Create the first announcement for this Academy. No fixture broadcasts are displayed.' : 'Create your first announcement, update, promotion or important notice.'} icon={<Megaphone size={22} />} action={<button className="pf-admin-button" onClick={() => setEditor(null)}><Plus size={15} /> New broadcast</button>} /> : <section className="pf-broadcast-library">
        <div className="pf-broadcast-toolbar">
          <label className="pf-admin-search-field"><Search size={16} /><input className="pf-admin-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, message, type, or audience" aria-label="Search broadcasts" /></label>
          <label><span>Status</span><AppSelect className="pf-admin-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}><option value="CURRENT">Current (excludes archived)</option><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="SCHEDULED">Scheduled</option><option value="DRAFT">Draft</option><option value="DISABLED">Disabled</option><option value="EXPIRED">Expired</option><option value="ARCHIVED">Archived</option></AppSelect></label>
          <label><span>Type</span><AppSelect className="pf-admin-select" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'ALL' | BroadcastType)}><option value="ALL">All types</option>{Object.entries(BROADCAST_TYPE_LABELS).filter(([value]) => scope === 'platform' || !['PROMOTION', 'STORE'].includes(value)).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</AppSelect></label>
          <label><span>Audience</span><AppSelect className="pf-admin-select" value={audienceFilter} onChange={(event) => setAudienceFilter(event.target.value as 'ALL' | BroadcastAudienceKind)}><option value="ALL">All audiences</option>{Object.entries(BROADCAST_AUDIENCE_LABELS).filter(([value]) => scope === 'platform' || ['ACADEMY_STUDENTS', 'COURSES'].includes(value)).map(([value, label]) => <option key={value} value={value}>{scope === 'academy' && value === 'ACADEMY_STUDENTS' ? 'All Academy students' : label}</option>)}</AppSelect></label>
          <label><span>Priority</span><AppSelect className="pf-admin-select" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as 'ALL' | BroadcastPriority)}><option value="ALL">All priorities</option><option value="CRITICAL">Critical</option><option value="HIGH">High</option><option value="NORMAL">Normal</option><option value="LOW">Low</option></AppSelect></label>
          <label><span>Date</span><AppSelect className="pf-admin-select" value={dateFilter} onChange={(event) => setDateFilter(event.target.value as DateFilter)}><option value="ANY">Any date</option><option value="TODAY">Today</option><option value="NEXT_7">Next 7 days</option><option value="LAST_30">Past 30 days</option></AppSelect></label>
          <label><span>Sort</span><AppSelect className="pf-admin-select" value={sort} onChange={(event) => setSort(event.target.value as SortOption)}><option value="NEWEST">Newest</option><option value="OLDEST">Oldest</option><option value="MODIFIED">Recently modified</option><option value="START">Start date</option><option value="END">End date</option><option value="PRIORITY">Priority</option></AppSelect></label>
        </div>
        {visible.length ? <>
          <div className="pf-broadcast-table-wrap"><table className="pf-broadcast-table"><thead><tr><th>Broadcast</th><th>Type</th><th>Audience</th><th>Status</th><th>Schedule</th><th>Priority</th><th>Created / modified</th><th><span className="pf-admin-sr-only">Actions</span></th></tr></thead><tbody>{visible.map((broadcast) => <tr key={broadcast.id}><td><button className="pf-broadcast-title-button" onClick={() => setDetails(broadcast)}><strong>{broadcast.title}</strong><small>{broadcast.subtitle || broadcast.message}</small></button></td><td>{BROADCAST_TYPE_LABELS[broadcast.type]}</td><td><span title={getAudienceSummary(broadcast, courses, packages, academies)}>{getAudienceSummary(broadcast, courses, packages, academies)}</span></td><td><AdminStatusBadge tone={statusTone(broadcast.status)}>{broadcast.status}</AdminStatusBadge></td><td><strong>{broadcast.startAt ? formatDateTime(broadcast.startAt) : 'Not scheduled'}</strong><small>{broadcast.endAt ? `Ends ${formatDateTime(broadcast.endAt)}` : 'No expiry'}</small></td><td><span className={`pf-broadcast-priority pf-broadcast-priority--${broadcast.priority.toLowerCase()}`}>{broadcast.priority}</span></td><td><strong>{formatDate(broadcast.createdAt)}</strong><small>Edited {formatDate(broadcast.updatedAt)}</small></td><td className="pf-broadcast-actions-cell"><button className="pf-admin-icon-button" type="button" aria-label={`Actions for ${broadcast.title}`} onClick={(event) => { event.stopPropagation(); setActionMenu((current) => current === broadcast.id ? null : broadcast.id); }}><MoreHorizontal size={17} /></button>{actionMenu === broadcast.id ? <div className="pf-broadcast-action-menu" onClick={(event) => event.stopPropagation()}>{actionItems(broadcast).map((item) => <button key={item.label} type="button" className={item.danger ? 'is-danger' : ''} onClick={() => { setActionMenu(null); item.run(); }}>{item.icon}{item.label}</button>)}</div> : null}</td></tr>)}</tbody></table></div>
          <div className="pf-broadcast-card-list">{visible.map((broadcast) => <motion.article key={broadcast.id} layout><header><div><button onClick={() => setDetails(broadcast)}>{broadcast.title}</button><small>{BROADCAST_TYPE_LABELS[broadcast.type]}</small></div><AdminStatusBadge tone={statusTone(broadcast.status)}>{broadcast.status}</AdminStatusBadge></header><p>{broadcast.message}</p><dl><div><dt>Audience</dt><dd>{getAudienceSummary(broadcast, courses, packages, academies)}</dd></div><div><dt>Priority</dt><dd>{broadcast.priority}</dd></div><div><dt>Starts</dt><dd>{broadcast.startAt ? formatDateTime(broadcast.startAt) : 'Not scheduled'}</dd></div><div><dt>Ends</dt><dd>{broadcast.endAt ? formatDateTime(broadcast.endAt) : 'No expiry'}</dd></div></dl><footer>{actionItems(broadcast).slice(0, 4).map((item) => <button key={item.label} type="button" className={item.danger ? 'is-danger' : ''} onClick={item.run}>{item.icon}{item.label}</button>)}</footer></motion.article>)}</div>
          <footer className="pf-broadcast-pagination"><p>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</p><div><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page} of {pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>Next</button></div></footer>
        </> : <AdminEmptyState compact title={statusFilter === 'ACTIVE' ? 'No active broadcasts' : statusFilter === 'SCHEDULED' ? 'No scheduled broadcasts' : statusFilter === 'DRAFT' ? 'No drafts' : statusFilter === 'EXPIRED' ? 'No expired broadcasts' : statusFilter === 'ARCHIVED' ? 'No archived broadcasts' : 'No matching broadcasts'} description="Adjust the search or filters to see other communications." icon={<Search size={20} />} action={<button className="pf-admin-button pf-admin-button--secondary" onClick={() => { setQuery(''); setStatusFilter('CURRENT'); setTypeFilter('ALL'); setAudienceFilter('ALL'); setPriorityFilter('ALL'); setDateFilter('ANY'); }}>Clear filters</button>} />}
      </section>}
    </>}

    {editor !== undefined ? <BroadcastEditor broadcast={editor} courses={courses} packages={packages} academies={academies} store={store} scope={scope} onClose={() => setEditor(undefined)} onComplete={(message) => { setEditor(undefined); void invalidateScope(); showToast(message); }} /> : null}
    <AdminDialog open={Boolean(preview)} onClose={() => setPreview(null)} title="Broadcast preview" description="This is a preview only. It does not publish or modify the broadcast." size="large" footer={<button className="pf-admin-button pf-admin-button--secondary" onClick={() => setPreview(null)}>Close preview</button>}>
      {preview ? <BroadcastPreview form={formFromBroadcast(preview)} mode={previewMode} onModeChange={setPreviewMode} /> : null}
    </AdminDialog>
    <AdminDialog open={Boolean(details)} onClose={() => setDetails(null)} title={details?.title ?? 'Broadcast details'} description={scope === 'academy' ? 'Live Academy-scoped broadcast data returned by the backend.' : 'Broadcast details'} size="large" footer={<button className="pf-admin-button pf-admin-button--secondary" onClick={() => setDetails(null)}>Close</button>}>
      {details ? <><BroadcastPreview form={formFromBroadcast(details)} mode="DESKTOP" /><dl className="pf-broadcast-review-list"><div><dt>Audience</dt><dd>{getAudienceSummary(details, courses, packages, academies)}</dd></div><div><dt>Status</dt><dd>{details.status}</dd></div><div><dt>Priority</dt><dd>{details.priority}</dd></div><div><dt>Starts</dt><dd>{details.startAt ? formatDateTime(details.startAt) : 'Not scheduled'}</dd></div><div><dt>Ends</dt><dd>{details.endAt ? formatDateTime(details.endAt) : 'No expiry'}</dd></div></dl></> : null}
    </AdminDialog>
    <AdminDialog open={Boolean(pendingAction)} onClose={() => setPendingAction(null)} title={pendingAction ? `${pendingAction.kind.split('_').map((word) => word[0] + word.slice(1).toLocaleLowerCase()).join(' ')} broadcast?` : 'Confirm action'} description={pendingAction?.kind === 'DELETE' ? 'This action cannot be undone.' : pendingAction?.kind === 'PUBLISH' ? 'This announcement will become visible to the selected audience immediately.' : 'The broadcast lifecycle will be updated immediately.'} size="small" footer={<><button className="pf-admin-button pf-admin-button--secondary" onClick={() => setPendingAction(null)}>Cancel</button><button className={`pf-admin-button${pendingAction?.kind === 'DELETE' ? ' pf-admin-button--danger' : ''}`} disabled={Boolean(store.pendingId)} onClick={() => void executeAction()}>{store.pendingId ? 'Working…' : 'Confirm'}</button></>}>
      {pendingAction ? <div className="pf-broadcast-confirm"><strong>{pendingAction.broadcast.title}</strong><p>Current status: {pendingAction.broadcast.status}</p></div> : null}
    </AdminDialog>
    <AdminToast toast={toast} onDismiss={() => setToast(null)} />
  </div>;
};

export default BroadcastPage;
