export interface StaticSeoMetadata {
  title: string;
  description: string;
  canonicalPath: string;
  robots: string;
}

export const DEFAULT_ROBOTS = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
export const PRIVATE_ROBOTS = 'noindex, nofollow, noarchive, nosnippet';

export const STATIC_SEO = {
  home: {
    title: 'Parallax Flow | Learning, Designed Around You',
    description: 'We transform authentic knowledge into structured, visual, and adaptive learning experiences that improve understanding, retention, and application.',
    canonicalPath: '/',
    robots: DEFAULT_ROBOTS,
  },
  homeAlias: {
    title: 'Parallax Flow | Learning, Designed Around You',
    description: 'We transform authentic knowledge into structured, visual, and adaptive learning experiences that improve understanding, retention, and application.',
    canonicalPath: '/',
    robots: PRIVATE_ROBOTS,
  },
  about: {
    title: 'About Parallax Flow | Our Learning Philosophy',
    description: 'Discover the story, design philosophy, and vision behind Parallax Flow, an adaptive learning ecosystem.',
    canonicalPath: '/about',
    robots: DEFAULT_ROBOTS,
  },
  contact: {
    title: 'Contact Parallax Flow | Connect With Us',
    description: 'Send a message to Parallax Flow and tell us how we can help with your learning journey.',
    canonicalPath: '/contact',
    robots: DEFAULT_ROBOTS,
  },
  store: {
    title: 'Premium Notes Store | Parallax Flow',
    description: 'Discover premium visual notes, revision resources, mind maps, question banks, and learning bundles that unlock inside the Parallax Flow Android app.',
    canonicalPath: '/store',
    robots: DEFAULT_ROBOTS,
  },
  login: {
    title: 'Login | Parallax Flow',
    description: 'Sign in to your Parallax Flow account to access your personalized learning space.',
    canonicalPath: '/login',
    robots: PRIVATE_ROBOTS,
  },
  register: {
    title: 'Create Account | Parallax Flow',
    description: 'Create your Parallax Flow account for visual, adaptive learning experiences.',
    canonicalPath: '/register',
    robots: PRIVATE_ROBOTS,
  },
  forgotPassword: {
    title: 'Forgot Password | Parallax Flow',
    description: 'Reset your Parallax Flow account password securely and regain access to your learning journey.',
    canonicalPath: '/forgot-password',
    robots: PRIVATE_ROBOTS,
  },
} as const satisfies Record<string, StaticSeoMetadata>;

export const INDEXABLE_STATIC_ROUTES = [STATIC_SEO.home, STATIC_SEO.about, STATIC_SEO.contact, STATIC_SEO.store] as const;

export const STATIC_ROUTE_METADATA = new Map<string, StaticSeoMetadata>([
  ['/', STATIC_SEO.home],
  ['/home', STATIC_SEO.homeAlias],
  ['/about', STATIC_SEO.about],
  ['/contact', STATIC_SEO.contact],
  ['/store', STATIC_SEO.store],
  ['/login', STATIC_SEO.login],
  ['/register', STATIC_SEO.register],
  ['/forgot-password', STATIC_SEO.forgotPassword],
]);
