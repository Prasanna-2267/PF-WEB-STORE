import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Inbox,
  Info,
  X,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const ADMIN_EASE = [0.22, 1, 0.36, 1] as const;

const getAdminPortalRoot = (): Element | null => {
  if (typeof document === 'undefined') return null;
  return document.querySelector('.pf-admin-portal-host') ?? document.body;
};

const useAdminPortalRoot = (): Element | null => {
  const [portalRoot, setPortalRoot] = useState<Element | null>(null);

  useEffect(() => {
    setPortalRoot(getAdminPortalRoot());
  }, []);

  return portalRoot ?? (typeof document !== 'undefined' ? document.body : null);
};

export interface AdminBreadcrumbItem {
  label: string;
  to?: string;
}

export interface AdminPageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  breadcrumbs?: AdminBreadcrumbItem[];
  actions?: React.ReactNode;
}

export const AdminPageHeader: React.FC<AdminPageHeaderProps> = ({
  title,
  description,
  eyebrow,
  breadcrumbs,
  actions,
}) => (
  <header className="pf-admin-page-header">
    <div className="pf-admin-page-header__copy">
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav className="pf-admin-breadcrumbs" aria-label="Breadcrumbs">
          <ol>
            {breadcrumbs.map((item, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <li key={item.label}>
                  {item.to && !isLast ? (
                    <Link to={item.to}>{item.label}</Link>
                  ) : (
                    <span aria-current={isLast ? 'page' : undefined}>{item.label}</span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      ) : null}
      {eyebrow ? <p className="pf-admin-eyebrow">{eyebrow}</p> : null}
      <h1 className="pf-admin-title">{title}</h1>
      {description ? <p className="pf-admin-page-header__description">{description}</p> : null}
    </div>
    {actions ? <div className="pf-admin-page-header__actions">{actions}</div> : null}
  </header>
);

export interface AdminEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
}

export const AdminEmptyState: React.FC<AdminEmptyStateProps> = ({
  icon = <Inbox size={24} />,
  title,
  description,
  action,
  compact = false,
}) => (
  <div className={`pf-admin-empty ${compact ? 'pf-admin-empty--compact' : ''}`}>
    <div className="pf-admin-empty__icon" aria-hidden="true">
      {icon}
    </div>
    <h3 className="pf-admin-empty__title">{title}</h3>
    {description ? <p className="pf-admin-empty__description">{description}</p> : null}
    {action ? <div className="pf-admin-empty__action">{action}</div> : null}
  </div>
);

export type AdminStatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export interface AdminStatusBadgeProps {
  tone?: AdminStatusTone;
  children: React.ReactNode;
}

export const AdminStatusBadge: React.FC<AdminStatusBadgeProps> = ({ tone = 'neutral', children }) => (
  <span className={`pf-admin-badge pf-admin-badge--${tone}`}>
    <span className="pf-admin-badge__dot" aria-hidden="true" />
    {children}
  </span>
);

export interface AdminSkeletonProps {
  rows?: number;
  variant?: 'table' | 'card' | 'cards' | 'detail';
  label?: string;
}

export const AdminSkeleton: React.FC<AdminSkeletonProps> = ({
  rows = 5,
  variant = 'table',
  label = 'Loading content...',
}) => (
  <div className="pf-admin-skeleton" role="status" aria-label={label}>
    <span className="pf-admin-sr-only">{label}</span>
    <div className={`pf-admin-skeleton__content pf-admin-skeleton--${variant}`}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="pf-admin-skeleton__row" />
      ))}
    </div>
  </div>
);

export interface AdminDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'small' | 'medium' | 'large' | 'wide';
  closeLabel?: string;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  bodyClassName?: string;
}

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export const AdminDialog: React.FC<AdminDialogProps> = ({
  open,
  onClose,
  title,
  description,
  icon,
  children,
  footer,
  size = 'medium',
  closeLabel = 'Close modal',
  initialFocusRef,
  bodyClassName,
}) => {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const openRef = useRef(open);
  const onCloseRef = useRef(onClose);
  const releaseInteractionRef = useRef<(() => void) | null>(null);
  const portalRoot = useAdminPortalRoot();

  openRef.current = open;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || !portalRoot) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    const focusFrame = window.requestAnimationFrame(() => {
      const preferredTarget = initialFocusRef?.current;
      const firstTarget = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (preferredTarget ?? firstTarget ?? dialogRef.current)?.focus({ preventScroll: true });
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        .filter((element) => (
          !element.hasAttribute('disabled')
          && element.getAttribute('aria-hidden') !== 'true'
          && element.getClientRects().length > 0
        ));

      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    releaseInteractionRef.current = () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow === 'hidden' ? '' : previousOverflow;
      previousFocusRef.current?.focus({ preventScroll: true });
      releaseInteractionRef.current = null;
    };
  }, [initialFocusRef, open, portalRoot]);

  useEffect(() => () => {
    releaseInteractionRef.current?.();
  }, []);

  if (!portalRoot) return null;

  return createPortal(
    <AnimatePresence
      onExitComplete={() => {
        if (!openRef.current) releaseInteractionRef.current?.();
      }}
    >
      {open ? (
        <motion.div
          className="pf-admin pf-admin-dialog-portal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14, ease: ADMIN_EASE }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={dialogRef}
            className={`pf-admin-dialog pf-admin-dialog--${size}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
            data-lenis-prevent
            initial={{ opacity: 0, y: 12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.99 }}
            transition={{ duration: 0.22, ease: ADMIN_EASE }}
          >
            <header className="pf-admin-dialog__header">
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                {icon ? <div className="pf-admin-dialog__header-icon">{icon}</div> : null}
                <div>
                  <h2 id={titleId}>{title}</h2>
                  {description ? <p id={descriptionId}>{description}</p> : null}
                </div>
              </div>
              <button className="pf-admin-icon-button" type="button" onClick={onClose} aria-label={closeLabel}>
                <X size={19} aria-hidden="true" />
              </button>
            </header>
            <div className={`pf-admin-dialog__body${bodyClassName ? ` ${bodyClassName}` : ''}`} data-lenis-prevent>{children}</div>
            {footer ? <footer className="pf-admin-dialog__footer">{footer}</footer> : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    portalRoot,
  );
};


export type AdminToastTone = 'success' | 'error' | 'warning' | 'info';

export interface AdminToastData {
  id: string | number;
  title: string;
  message?: string;
  tone?: AdminToastTone;
  duration?: number;
}

export interface AdminToastProps {
  toast?: AdminToastData | null;
  toasts?: AdminToastData[];
  onDismiss?: (id?: string | number) => void;
  onClose?: (id?: string | number) => void;
}

const toastIcons: Record<AdminToastTone, React.ReactNode> = {
  success: <CheckCircle2 size={20} />,
  error: <XCircle size={20} />,
  warning: <AlertTriangle size={20} />,
  info: <Info size={20} />,
};

const SingleAdminToast: React.FC<{
  toast: AdminToastData;
  onDismiss: (id: string | number) => void;
}> = ({ toast, onDismiss }) => {
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (toast.duration === 0 || isHovered) return undefined;
    const timeout = window.setTimeout(() => onDismiss(toast.id), toast.duration ?? 3800);
    return () => window.clearTimeout(timeout);
  }, [toast.duration, toast.id, isHovered, onDismiss]);

  const tone = toast.tone ?? 'info';

  return (
    <motion.article
      layout="position"
      key={toast.id}
      className={`pf-admin-toast pf-admin-toast--${tone}`}
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.96 }}
      transition={{ duration: 0.22, ease: ADMIN_EASE }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className="pf-admin-toast__icon" aria-hidden="true">{toastIcons[tone]}</span>
      <div>
        <strong>{toast.title}</strong>
        {toast.message ? <p>{toast.message}</p> : null}
      </div>
      <button type="button" onClick={() => onDismiss(toast.id)} aria-label="Dismiss notification">
        <X size={17} aria-hidden="true" />
      </button>
    </motion.article>
  );
};

export const AdminToast: React.FC<AdminToastProps> = ({ toast, toasts, onDismiss, onClose }) => {
  const portalRoot = useAdminPortalRoot();
  const dismissHandler = onDismiss ?? onClose ?? (() => {});

  const activeToasts: AdminToastData[] = toasts
    ? toasts
    : toast
    ? [toast]
    : [];

  if (!portalRoot) return null;

  return createPortal(
    <div className="pf-admin-toast-region">
      <AnimatePresence initial={false}>
        {activeToasts.map((t) => (
          <SingleAdminToast key={t.id} toast={t} onDismiss={(id) => dismissHandler(id)} />
        ))}
      </AnimatePresence>
    </div>,
    portalRoot,
  );
};
