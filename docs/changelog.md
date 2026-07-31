# Changelog

## 2026-07-28 — custom-domain boot and responsive repair

- Traced the intermittent custom-domain blank screen to stale entry HTML being able to request a removed hashed bundle while the broad SPA rewrite returned `index.html` as that JavaScript URL with a one-year immutable asset cache policy.
- Replaced the catch-all rewrite with exact rewrites for every registered route and added a production `404.html`, so missing assets remain 404 responses.
- Added no-store/no-transform headers to every entry route, removing the custom-domain-only automatic Cloudflare HTML transformation.
- Added a one-time cache-busted entry retry for stale hashed-script failures and a non-visual timeout fail-safe for the opening overlay.
- Fixed Lenis cleanup by cancelling its animation-frame loop.
- Restored mobile/tablet navbar and contact behavior by co-locating responsive rules with their component styles; desktop declarations and hero breakpoints were not changed.
- Kept the mobile menu's Enter the Flow/Sign Out action functional while hiding only the desktop action at mobile widths.
- Verified the repair with TypeScript and a Vite 6 production build.

## 2026-07-28 — final production verification

- Added route-specific title, description, canonical, Open Graph, Twitter, and JSON-LD updates to `/forgot-password`.
- Removed the unused JetBrains Mono request and Tailwind font alias.
- Removed `vercel.json`; Cloudflare Pages remains the documented production target.
- Upgraded React Router from 6.30.4 to 7.18.1.
- Upgraded Vite from 5.4.21 to the patched 6.4.3 release after the advisory check identified Vite/esbuild development-server findings.
- Ran `npm audit` and `npm audit fix`; no compatible automatic fix was available for the remaining React Router RSC-mode advisory.
- Verified a production build and HTTP 200 SPA fallback for all current routes plus the public manifest, robots, and sitemap files.
- Recorded the browser/device QA limitations and static responsive findings in `docs/todo.md`.

## 2026-07-28 — production source cleanup

- Preserved the live landing page, contact section, footer, authentication screens, theme control, responsive design, SEO, and Cloudflare assets.
- Removed unregistered legacy feature trees and unused generic component trees.
- Removed the hidden global WebGL canvas and continuous background render loop.
- Removed unused query, form, request, 3D, and animation dependencies.
- Kept Lenis because it actively supplies the current smooth-scroll behavior.
- Replaced the combined legacy stylesheet with focused theme, navbar, hero, contact, footer, and login stylesheets.
- Simplified theme state to the persisted light/dark value actually used by the interface.
- Rebuilt the documentation around the current route and import graph.
- Verified the cleanup with TypeScript and a Vite production build.

### Bundle checkpoint

Before cleanup:

- JavaScript: approximately 1.21 MB raw / 343.66 KB gzip
- CSS: 86.14 KB raw / 17.84 KB gzip
- Three.js vendor chunk: 936.14 KB raw / 259.20 KB gzip

After the completed cleanup:

- JavaScript: 344.55 KB raw / 108.89 KB gzip
- CSS: 41.15 KB raw / 9.82 KB gzip

Final values should always be read from the most recent `npm run build` output.
