type RouteLoader = () => Promise<unknown>;
type Workspace = 'admin' | 'academy';

const adminRoutes: ReadonlyArray<readonly [string, RouteLoader]> = [
  ['/admin/overview', () => import('@/features/admin/LiveAdminOverviewPage')],
  ['/admin/students', () => import('@/features/admin/readOnly/AdminStudentsReadOnlyPages')],
  ['/admin/orders', () => import('@/features/admin/readOnly/AdminOrdersReadOnlyPages')],
  ['/admin/courses', () => import('@/features/admin/readOnly/AdminCoursesReadOnlyPages')],
  ['/admin/content', () => import('@/features/admin/content/ContentPage')],
  ['/admin/packages', () => import('@/features/admin/packages/PackagesPage')],
  ['/admin/coupons', () => import('@/features/admin/coupons/CouponsPage')],
  ['/admin/store-management', () => import('@/features/admin/store-management/StoreManagementPage')],
  ['/admin/questions', () => import('@/features/admin/questions/QuestionsPage')],
  ['/admin/broadcast', () => import('@/features/admin/broadcast/BroadcastPage')],
  ['/admin/academies', () => import('@/features/admin/academies/AcademiesPage')],
];

const academyRoutes: ReadonlyArray<readonly [string, RouteLoader]> = [
  ['/academy/overview', () => import('@/features/academy/LiveAcademyOverviewPage')],
  ['/academy/admissions', () => import('@/features/academy/admissions/AcademyAdmissionsPage')],
  ['/academy/students', () => import('@/features/academy/readOnly/AcademyStudentsReadOnlyPages')],
  ['/academy/courses', () => import('@/features/academy/readOnly/AcademyCoursesReadOnlyPages')],
  ['/academy/content', () => import('@/features/academy/content/AcademyContentPage')],
  ['/academy/questions', () => import('@/features/academy/questions/AcademyQuestionsPage')],
  ['/academy/broadcast', () => import('@/features/academy/broadcast/AcademyBroadcastPage')],
  ['/academy/settings', () => import('@/features/academy/settings/AcademySettingsPage')],
];

const routeLoaders = [...adminRoutes, ...academyRoutes];
const inFlight = new Map<string, Promise<unknown>>();

const normalizePath = (path: string): string => path.split(/[?#]/, 1)[0].replace(/\/$/, '') || '/';

const findLoader = (path: string): readonly [string, RouteLoader] | undefined => {
  const normalized = normalizePath(path);
  return routeLoaders
    .filter(([base]) => normalized === base || normalized.startsWith(`${base}/`))
    .sort(([left], [right]) => right.length - left.length)[0];
};

export function preloadRoute(path: string): Promise<unknown> | undefined {
  const match = findLoader(path);
  if (!match) return undefined;
  const [key, loader] = match;
  const existing = inFlight.get(key);
  if (existing) return existing;
  const pending = loader().catch(() => {
    inFlight.delete(key);
    return undefined;
  });
  inFlight.set(key, pending);
  return pending;
}

export function scheduleWorkspacePreload(workspace: Workspace): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const routes = workspace === 'admin' ? adminRoutes : academyRoutes;
  let cancelled = false;
  let index = 0;
  let cancelTimer: (() => void) | undefined;
  let idleHandle: number | undefined;

  const loadNext = () => {
    if (cancelled || index >= routes.length) return;
    void preloadRoute(routes[index][0]);
    index += 1;
    const handle = window.setTimeout(loadNext, 180);
    cancelTimer = () => window.clearTimeout(handle);
  };

  if ('requestIdleCallback' in window) {
    idleHandle = window.requestIdleCallback(loadNext, { timeout: 1_000 });
  } else {
    const handle = globalThis.setTimeout(loadNext, 400);
    cancelTimer = () => globalThis.clearTimeout(handle);
  }

  return () => {
    cancelled = true;
    cancelTimer?.();
    if (idleHandle !== undefined && 'cancelIdleCallback' in window) window.cancelIdleCallback(idleHandle);
  };
}
