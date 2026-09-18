import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion';
import {
  BadgeHelp,
  BookMarked,
  Building2,
  ChevronRight,
  LayoutDashboard,
  LibraryBig,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  Package,
  ReceiptText,
  ShoppingBag,
  Sun,
  TicketPercent,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { preloadRoute, scheduleWorkspacePreload } from '@/app/router/routePreload';
import { useAuthStore } from '@/app/store/useAuthStore';
import { useThemeStore } from '@/app/store/useThemeStore';
import { SeoHead } from '@/seo/SeoHead';
import { PoweredByNeuralWebLabs } from '@/components/branding/PoweredByNeuralWebLabs';
import { SuperAdminManagementDialog } from './SuperAdminManagementDialog';
import './admin.css';

const ADMIN_EASE = [0.22, 1, 0.36, 1] as const;
const ADMIN_DRAWER_QUERY = '(max-width: 1023px)';
const ADMIN_SIDEBAR_STORAGE_KEY = 'pf_admin_sidebar_open';
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const primaryNavigation = [
  { label: 'Overview', to: '/admin/overview', icon: LayoutDashboard },
  { label: 'Students', to: '/admin/students', icon: UsersRound },
  { label: 'Orders', to: '/admin/orders', icon: ReceiptText },
  { label: 'Courses', to: '/admin/courses', icon: BookMarked },
  { label: 'Content', to: '/admin/content', icon: LibraryBig },
  { label: 'Packages', to: '/admin/packages', icon: Package },
  { label: 'Coupons', to: '/admin/coupons', icon: TicketPercent },
  { label: 'Store Merchandising', to: '/admin/store-management', icon: ShoppingBag },
  { label: 'Questions', to: '/admin/questions', icon: BadgeHelp },
  { label: 'Broadcast', to: '/admin/broadcast', icon: Megaphone },
  { label: 'Academies', to: '/admin/academies', icon: Building2 },
] as const;

const getSectionLabel = (pathname: string): string => {
  if (/^\/admin\/students\/[^/]+\/?$/.test(pathname)) return 'Student details';
  if (/^\/admin\/academies\/[^/]+\/?$/.test(pathname)) return 'Academy details';
  const route = primaryNavigation
    .find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`));
  return route?.label ?? 'Admin Console';
};

const getInitials = (name?: string): string => {
  const words = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (!words.length) return 'PF';
  return words.slice(0, 2).map((word) => word.charAt(0).toUpperCase()).join('');
};

interface AdminNavigationItemProps {
  label: string;
  to: string;
  icon: LucideIcon;
}

const AdminNavigationItem: React.FC<AdminNavigationItemProps> = ({ label, to, icon: Icon }) => (
  <NavLink
    to={to}
    end={to === '/admin/overview'}
    className={({ isActive }) => `pf-admin-nav__link${isActive ? ' is-active' : ''}`}
    onPointerEnter={() => { void preloadRoute(to); }}
    onFocus={() => { void preloadRoute(to); }}
    onPointerDown={() => { void preloadRoute(to); }}
  >
    {({ isActive }) => (
      <>
        {isActive ? (
          <span
            className="pf-admin-nav__active"
            aria-hidden="true"
          />
        ) : null}
        <Icon size={19} aria-hidden={true} />
        <span>{label}</span>
        <ChevronRight className="pf-admin-nav__chevron" size={15} aria-hidden={true} />
      </>
    )}
  </NavLink>
);

const AdminLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const { mode, toggleTheme } = useThemeStore();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(() => (
    typeof window === 'undefined'
      ? true
      : window.localStorage.getItem(ADMIN_SIDEBAR_STORAGE_KEY) !== 'false'
  ));
  const [isCompact, setIsCompact] = useState(() => (
    typeof window === 'undefined' ? false : window.matchMedia(ADMIN_DRAWER_QUERY).matches
  ));
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [accountManagerOpen, setAccountManagerOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => scheduleWorkspacePreload('admin'), []);
  const previousPathRef = useRef(location.pathname);

  const sectionLabel = useMemo(() => getSectionLabel(location.pathname), [location.pathname]);
  const sidebarVisible = isCompact ? drawerOpen : desktopSidebarOpen;

  const setDesktopSidebarVisibility = (visible: boolean) => {
    setDesktopSidebarOpen(visible);
    window.localStorage.setItem(ADMIN_SIDEBAR_STORAGE_KEY, String(visible));
  };

  const openSidebar = () => {
    if (isCompact) setDrawerOpen(true);
    else setDesktopSidebarVisibility(true);
  };

  const closeSidebar = () => {
    setAccountManagerOpen(false);
    if (isCompact) setDrawerOpen(false);
    else setDesktopSidebarVisibility(false);
  };

  useEffect(() => {
    const media = window.matchMedia(ADMIN_DRAWER_QUERY);
    const updateLayout = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsCompact(event.matches);
      if (!event.matches) setDrawerOpen(false);
    };

    updateLayout(media);
    media.addEventListener('change', updateLayout);
    return () => media.removeEventListener('change', updateLayout);
  }, []);

  useEffect(() => {
    if (isCompact) setDrawerOpen(false);

    if (previousPathRef.current !== location.pathname) {
      previousPathRef.current = location.pathname;
      setAccountManagerOpen(false);
      const focusFrame = window.requestAnimationFrame(() => {
        mainRef.current?.focus({ preventScroll: true });
      });
      return () => window.cancelAnimationFrame(focusFrame);
    }

    return undefined;
  }, [isCompact, location.pathname]);

  useEffect(() => {
    if (!sidebarRef.current) return;
    sidebarRef.current.inert = !sidebarVisible;
  }, [sidebarVisible]);

  useEffect(() => {
    if (!isCompact || !drawerOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (workspaceRef.current) workspaceRef.current.inert = true;

    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus({ preventScroll: true });
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setDrawerOpen(false);
        return;
      }

      if (event.key !== 'Tab' || !sidebarRef.current) return;
      const focusable = Array.from(sidebarRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        .filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');
      if (!focusable.length) return;

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

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (workspaceRef.current) workspaceRef.current.inert = false;
      menuButtonRef.current?.focus({ preventScroll: true });
    };
  }, [drawerOpen, isCompact]);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setDrawerOpen(false);
    setIsLoggingOut(true);

    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  const routeMotion = prefersReducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        initial: { opacity: 0, y: 9 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -5 },
      };

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.24, ease: ADMIN_EASE }}>
      <div
        className={`pf-admin${drawerOpen ? ' has-open-drawer' : ''}${!isCompact && !desktopSidebarOpen ? ' is-sidebar-collapsed' : ''}${isLoggingOut ? ' is-logging-out' : ''}`}
        data-lenis-prevent
      >
        <SeoHead
          title={`${sectionLabel} | Parallax Flow Admin`}
          description="Secure Parallax Flow administration workspace."
          canonicalPath={location.pathname}
          robots="noindex, nofollow, noarchive"
        />
        <a className="pf-admin-skip-link" href="#admin-main">Skip to admin content</a>

        <div className="pf-admin-shell">
          <AnimatePresence>
            {isCompact && drawerOpen ? (
              <motion.button
                className="pf-admin-drawer-backdrop"
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setDrawerOpen(false)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: ADMIN_EASE }}
              />
            ) : null}
          </AnimatePresence>

          <aside
            ref={sidebarRef}
            id="pf-admin-navigation"
            className={`pf-admin-sidebar${sidebarVisible ? ' is-open' : ''}`}
            aria-label="Admin navigation"
            role={isCompact ? 'dialog' : undefined}
            aria-modal={isCompact ? true : undefined}
            data-lenis-prevent
          >
            <div className="pf-admin-sidebar__header">
              <NavLink className="pf-admin-brand" to="/admin/overview" aria-label="Parallax Flow Admin overview">
                <span className="pf-admin-brand__mark"><img src="/logo.png" alt="" /></span>
                <span className="pf-admin-brand__copy">
                  <strong>Parallax Flow</strong>
                  <small>Admin Console</small>
                </span>
              </NavLink>
              <button
                ref={closeButtonRef}
                className="pf-admin-icon-button pf-admin-sidebar__close"
                type="button"
                onClick={closeSidebar}
                aria-label="Close navigation menu"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <div className="pf-admin-sidebar__scroll">
              <nav className="pf-admin-nav" aria-label="Console modules">
                <p className="pf-admin-nav__label">Workspace</p>
                {primaryNavigation.map((item) => <AdminNavigationItem key={item.to} {...item} />)}
              </nav>
            </div>

            <div className="pf-admin-sidebar__footer">
              <div className="pf-admin-account-card">
                <button
                  className="pf-admin-account-card__summary"
                  type="button"
                  onClick={() => setAccountManagerOpen(true)}
                  aria-haspopup="dialog"
                >
                  <span className="pf-admin-account-card__avatar" aria-hidden="true">
                    {user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : getInitials(user?.fullName)}
                  </span>
                  <span className="pf-admin-account-card__copy">
                    <strong>{user?.fullName || 'Super Admin'}</strong>
                    <small>{user?.email || 'Administrator'}</small>
                  </span>
                  <ChevronRight className="pf-admin-account-card__chevron" size={16} aria-hidden="true" />
                </button>
                <button
                  className="pf-admin-account-card__logout"
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  aria-label={isLoggingOut ? 'Signing out' : 'Sign out'}
                >
                  <LogOut size={18} aria-hidden="true" />
                </button>
              </div>
              <PoweredByNeuralWebLabs className="pf-admin-powered-by" />
            </div>
          </aside>

          <div ref={workspaceRef} className="pf-admin-workspace">
            <header className="pf-admin-topbar">
              <div className="pf-admin-topbar__section">
                {!sidebarVisible ? (
                  <button
                    ref={menuButtonRef}
                    className="pf-admin-icon-button pf-admin-topbar__menu"
                    type="button"
                    onClick={openSidebar}
                    aria-label="Open navigation menu"
                    aria-controls="pf-admin-navigation"
                    aria-expanded={false}
                  >
                    <Menu size={21} aria-hidden={true} />
                  </button>
                ) : null}
                <div>
                  <strong>{sectionLabel}</strong>
                </div>
              </div>

              <div className="pf-admin-topbar__actions">
                <span className="pf-admin-system-status"><i aria-hidden="true" /> Systems operational</span>
                <button
                  className="pf-admin-theme-toggle"
                  type="button"
                  onClick={toggleTheme}
                  aria-label={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}
                  title={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}
                >
                  <Sun className={mode === 'light' ? 'is-active' : ''} size={17} aria-hidden="true" />
                  <Moon className={mode === 'dark' ? 'is-active' : ''} size={17} aria-hidden="true" />
                  <motion.span
                    className="pf-admin-theme-toggle__thumb"
                    animate={{ x: mode === 'dark' ? 24 : 0 }}
                    transition={{ duration: 0.24, ease: ADMIN_EASE }}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </header>

            <main ref={mainRef} id="admin-main" className="pf-admin-main" tabIndex={-1}>
              <React.Suspense
                fallback={
                  <div role="status" aria-live="polite" className="pf-admin-route-loader">
                    <span aria-hidden="true" />
                    <p>Loading&hellip;</p>
                  </div>
                }
              >
                <motion.div
                  key={location.pathname}
                  className="pf-admin-route"
                  initial={routeMotion.initial}
                  animate={routeMotion.animate}
                  transition={{ duration: prefersReducedMotion ? 0.01 : 0.18, ease: ADMIN_EASE }}
                >
                  <Outlet />
                </motion.div>
              </React.Suspense>
            </main>
          </div>
        </div>

        <AnimatePresence>
          {isLoggingOut ? (
            <motion.div
              className="pf-admin-logout-state"
              role="status"
              aria-live="polite"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              <span aria-hidden="true" />
              <p>Signing out securely&hellip;</p>
            </motion.div>
          ) : null}
        </AnimatePresence>
        <SuperAdminManagementDialog
          open={accountManagerOpen}
          onClose={() => setAccountManagerOpen(false)}
          currentUserId={user?.id}
        />
      </div>

      <div className="pf-admin-portal-host" />
    </MotionConfig>
  );
};


export default AdminLayout;
