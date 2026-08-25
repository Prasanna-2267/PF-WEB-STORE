# Changelog

## 2026-08-18 — Super Admin Questions workspace

- Replaced the Questions placeholder with a complete responsive Question Bank and authoring workspace.
- Added normal MCQ, case MCQ, case descriptive, and normal descriptive models with rich text, keyword highlighting, explanations, learner preview, and draft/published/archived lifecycles.
- Added dynamic case sub-questions with add, duplicate, remove, drag reorder, entire-case classification, and per-sub-question classification.
- Added Course → Subject → Chapter → Lesson → Topic taxonomy management and full hierarchy filtering without allowing ad-hoc taxonomy creation inside the editor.
- Added CSV/XLSX upload, validation, preview, Case ID grouping, warnings/errors, lower-taxonomy creation safeguards, and a downloadable template.
- Added pagination, sorting, search, duplicate, archive, trash, restore, permanent deletion, unsaved-change protection, browser-persistent mock repositories, responsive layouts, and reduced-motion-compatible transitions.
- Kept the public website, Store, and unrelated Admin modules unchanged. TypeScript and the Vite production build pass.

## 2026-08-17 — Super Admin Broadcast workspace

- Replaced the Broadcast placeholder with a complete responsive communications workspace.
- Added summary filters, advanced search/filter/sort controls, desktop and mobile result views, pagination, detail inspection, and status-specific action menus.
- Added a seven-step editor for content, optional image and CTA, audience targeting, platform placement, priority, schedule/expiry, frequency, dismiss behavior, preview, review, and explicit confirmation.
- Added browser-persistent mock lifecycle handling for drafts, scheduled and active broadcasts, expiration, disable/enable, schedule cancellation, duplication, archive/restore, and safe deletion.
- Added unsaved-change protection, session refresh recovery, loading/empty/error/success feedback, responsive styling, keyboard focus support, and reduced-motion behavior.
- Connected `/admin/broadcast` through the existing protected Admin shell without modifying public or Store routes. TypeScript and the production Vite build pass.

## 2026-08-15 — Super Admin Packages catalogue

- Replaced the Packages placeholder with a complete responsive catalogue-management module.
- Added package creation and editing with title, INR price, description, draft/published/archived status, stable Content Library references, and browser-persistent mock data behind a replaceable repository contract.
- Added a Drive-style content picker with full hierarchy browsing, breadcrumbs, back/forward navigation, global search with source paths, file/folder multi-selection, select-all, effective descendant counts, and automatic ancestor/child deduplication.
- Added searchable package cards, metadata and status summaries, expandable included-content details, missing-source feedback, and safe package deletion that never removes underlying Content Library records.
- Added responsive desktop/tablet/mobile layouts, loading/empty/error/success states, accessible dialogs, and reduced-motion-compatible transitions.
- Kept the public website, Store, Admin shell, authentication, student/order workflows, and Content module behavior unchanged. TypeScript and the production Vite build pass.

## 2026-08-15 — Super Admin Content library

- Replaced the Content placeholder with a responsive Drive-style file and folder manager.
- Added unlimited ID-based nesting, dynamic breadcrumbs, back/forward navigation, sorting, persisted grid/list views, and nested search with source paths.
- Added folder creation, multi-file/folder uploads with progress, rename with extension preservation, safe move, deep copy, recursive delete warnings, drag/drop, multi-select and batch actions.
- Added supported file previews, downloads, a metadata/details drawer with editable descriptions, responsive menus/dialogs, empty/loading/error states, and local mock persistence behind a replaceable repository contract.
- Kept the existing Admin shell, authentication, Overview, Students, Student Details, Orders, and every public route unchanged. TypeScript and the production Vite build pass.

## 2026-08-15 — Super Admin Console phase one

- Added an isolated, role-protected `/admin/*` application shell with responsive sidebar navigation, theme support, route transitions, focus management, and logout feedback.
- Added Overview metrics, 30-day trend visualizations, recent orders, and content inventory.
- Added the searchable, filterable, sortable, paginated Students directory and canonical Student Details workflow.
- Added audited demonstration actions for access grants, role changes, account enable/disable, and active-session revocation.
- Added searchable, filterable, sortable, paginated Orders with receipt metadata and buyer-to-student navigation.
- Added typed admin domain models, repository boundary, fictional fixtures, browser-persistent mock adapter, per-module request-race protection, loading/empty/error/success states, time-limited entitlement expiry, resilient post-action refreshes, and in-memory state clearing on logout.
- Added frontend permission gating, admin noindex metadata/headers, and future-module placeholders without exposing the console in public navigation.
- Verified TypeScript and the Vite production build. A trusted backend remains required before real administration.

## 2026-08-01 — About Parallax Flow chapter

- Added an in-page About us destination between the hero and Connect with us.
- Added a five-stage glass-card story with contained wheel, keyboard, touch, and direct progress-control navigation.
- Reworked the story into one large persistent card that rises over the pinned About introduction instead of rendering five separate card surfaces.
- Added five original stage-specific editorial images and optimized the complete image set to approximately 417 KB for production delivery.
- Tightened the About heading spacing, exposed three labelled story layers behind the active card, and added hover-gated wheel progression with restrained image movement.
- Moved the three background layers above the active card, increased their visual separation, and made every exposed layer directly clickable for stage navigation.
- Split the About introduction and card stack into consecutive sticky chapters so the editorial heading releases before the cards pin, eliminating navbar, headline, and card-layer overlaps.
- Reduced the transition gap between the About introduction and cards, and increased each exposed stage tab to a fixed responsive height so the nearest next stage remains fully readable and clickable.
- Kept regular page scrolling outside the cards, so visitors can move directly to Connect with us at any stage.
- Added the final-stage light bloom and continuation treatment.

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
