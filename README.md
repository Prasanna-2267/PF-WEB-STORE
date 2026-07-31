# Parallax Flow website

Production marketing and authentication website for Parallax Flow, an Android-first learning experience.

## Current production scope

- Animated logo introduction
- Flagship landing-page hero and Android product composition
- Responsive desktop, tablet, and mobile layouts
- Light and dark themes
- Contact section with a local confirmation modal
- Shared production footer
- Login, registration, and password-reset screens
- Route-aware title, description, canonical, Open Graph, Twitter, and JSON-LD metadata
- Cloudflare Pages registered-route rewrites, security headers, stale-entry recovery, and immutable hashed-asset caching

The About us, PALM, and Store labels currently communicate “Coming soon”; they do not have application routes. Signing in returns the visitor to the landing page and changes the main action to Sign Out.

## Routes

| Path | Screen |
| --- | --- |
| `/` | Landing page |
| `/home` | Landing-page alias |
| `/contact` | Landing page scrolled to Connect with us |
| `/login` | Sign in |
| `/register` | Create account |
| `/forgot-password` | Password reset |
| Any other in-app path | React Router redirects to `/` |
| Any unknown direct request | Cloudflare serves the production `404.html` |

## Technology

- React 18 and TypeScript
- Vite 6
- React Router 7
- Zustand persistence for theme and local auth state
- Framer Motion for visible interface transitions
- Lenis for the existing smooth-scroll behavior
- Lucide React icons
- Tailwind base/utilities plus focused page CSS

Three.js, React Three Fiber, global canvas rendering, unused query/form providers, and unused legacy feature code are intentionally not part of the production application.

## Local development

```bash
npm install
npm run dev
```

Production verification:

```bash
npm run build
npm run preview
```

## Deployment

Cloudflare Pages should use:

- Build command: `npm run build`
- Output directory: `dist`

Keep these deployment files:

- `public/_redirects` for exact rewrites of the registered non-root client routes
- `public/_headers` for no-store/no-transform HTML headers and immutable hashed-asset caching
- `public/404.html` so missing bundles and unknown direct requests remain real 404 responses
- `public/robots.txt`
- `public/sitemap.xml`
- `public/manifest.json`

The legacy Vercel deployment configuration has been removed. Cloudflare Pages is the only documented deployment target.

Do not replace the exact route rewrites with `/* /index.html 200`. A catch-all rewrite turns missing hashed JavaScript requests into HTML, and the `/assets/*` cache rule can then preserve that invalid response. The entry document includes a one-time cache-busted retry for a stale bundle reference, but correct 404 behavior remains the primary safeguard.

## Important behavior

Authentication is currently a local mock service. It persists a generated session in local storage; it does not call a production identity API.

The contact form currently validates in the browser, clears after submission, and shows a confirmation modal. It does not transmit a message to a backend.

## Documentation

- [Current state](docs/current-state.md)
- [Architecture](docs/architecture.md)
- [Routing](docs/routing.md)
- [Design system](docs/design-system.md)
- [Animation system](docs/animation-system.md)
- [Component inventory](docs/component-library.md)
- [Integration contract](docs/api-contract.md)
- [Production plan](docs/plan.md)
- [Todo](docs/todo.md)
- [Changelog](docs/changelog.md)
