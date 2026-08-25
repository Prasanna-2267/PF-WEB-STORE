# Current application state

Last verified: 2026-08-18.

## Public experience

The public website contains the animated introduction, product-led hero, About story, Connect with us experience, footer, responsive navigation, theme switching, authentication screens, and route-specific SEO.

## Store experience

The Store is a separate routed product under `/store`. Public visitors can discover categories and products. Cart, checkout, purchase history, and profile routes require a signed-in user. Store data and purchase behavior are currently browser-side demonstration implementations.

## Super Admin Console

The Admin Console is isolated under `/admin/*` and is not linked from the public navigation. A client-side guard requires an authenticated `super_admin` profile plus the appropriate permission before rendering a module.

Implemented phase-one modules:

- Overview
- Students
- Student Details
- Orders
- Content
- Packages
- Questions
- Broadcast

Implemented privileged student workflows:

- grant learning-resource access;
- change role;
- enable or disable an account; and
- revoke active sessions.

Student Details is canonical: student links from both the Students table and Orders table resolve to `/admin/students/:studentId`.

Content is a general-purpose, ID-based file manager at `/admin/content`. It supports arbitrary folder depth, dynamic breadcrumbs, global nested search, list/grid sorting, multi-selection, folder and file uploads with progress, previews for supported uploaded media, metadata editing, drag/drop moves, deep copies, recursive deletion, and browser-persistent mock metadata. Uploaded binary sources are held only for the current browser runtime by the mock adapter; production object storage remains required.

Packages is a separate catalogue-management module at `/admin/packages`. Administrators can create, search, inspect, edit, publish/archive, and delete package records that reference existing Content Library IDs. Its Drive-style picker supports nested navigation, breadcrumbs, back/forward history, global search, file/folder multi-selection, descendant-aware counts, and automatic removal of redundant child selections when an ancestor folder is selected. Deleting a package never deletes its source content. Package data is browser-persistent demonstration data; the public Store, payments, entitlements, and Android unlocking are intentionally not connected yet.

Broadcast is a dedicated communications workspace at `/admin/broadcast`. Administrators can search, filter, sort, inspect, create, edit, preview, duplicate, publish, schedule, disable, enable, cancel, archive, restore, and safely delete communications. The seven-step editor covers content, optional imagery and CTA, Parallax Flow or Academy audiences, app/website placements, priority, schedule/expiry, frequency, dismiss behavior, and final review. Unsaved editor work is recoverable for the current browser session. Broadcast data is browser-persistent mock data and is not delivered to real users.

Questions is a complete practice-content workspace at `/admin/questions`. It supports normal and case-based MCQ/descriptive authoring, reusable taxonomy classification, per-case or per-sub-question classification, reorderable case questions, rich text and keyword highlighting, draft/published/archived lifecycles, preview, duplication, recoverable trash, permanent deletion, pagination, and full hierarchy filters. Its spreadsheet workflow accepts CSV/XLSX, validates rows before import, groups case rows by Case ID, creates missing lower taxonomy levels only after validating the course, and reports warnings/errors before any Question Bank mutation. Questions and taxonomy currently persist through browser-local repositories and require authoritative backend storage before real production use.

The current `mockAdminRepository` supplies fictional fixtures and browser-persistent mutations. It exists for interface development only. It must be replaced with a trusted server API before production administration.

## Active admin source

```text
src/
  app/store/useAdminStore.ts
  app/store/useContentStore.ts
  app/store/usePackageStore.ts
  app/store/useBroadcastStore.ts
  app/store/useQuestionStore.ts
  components/guards/
    PublicExperienceRoute.tsx
    RequireSuperAdmin.tsx
  features/admin/
    AdminLayout.tsx
    AdminPages.tsx
    AdminUi.tsx
    admin.css
    admin-pages.css
    content/
    packages/
    broadcast/
    questions/
    api/
    data/
    types/
```

## Verification checkpoint

- TypeScript: passed
- Vite production build: passed
- Admin routes are represented in the typed registry and router
- Admin route HTML is configured as no-store/noindex
- Live browser automation was unavailable during the final 2026-08-15 pass; repeat the device and interaction matrix before deployment
