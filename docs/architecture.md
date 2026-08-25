# Architecture

## Runtime composition

```text
AppRouter
|- PublicExperienceRoute
|  |- PublicLayout -> HomePage
|  `- StoreLayout -> Store pages
|- PublicOnlyRoute -> AuthLayout -> Auth pages
`- RequireSuperAdmin
   `- AdminLayout
      |- Overview
      |- Students -> Student Details
      |- Orders -> Student Details
      |- Content
      |- Packages
      |- Questions
      `- Future-module placeholders
```

## State and adapters

- `useThemeStore` owns the shared light/dark preference.
- `useAuthStore` owns the local UI session and typed role/permission claims.
- `useAdminStore` owns admin request state, queries, selected records, mutations, feedback, and stale-request protection.
- `useContentStore` owns folder navigation history, sorting/view preferences, uploads, content mutations, and stale-request protection.
- `usePackageStore` owns package catalogue request state and create, update, and delete mutations.
- `useBroadcastStore` owns Broadcast list state and the complete draft, scheduling, publication, disable/enable, archive/restore, duplicate, and delete lifecycle.
- `useQuestionStore` owns the Question Bank, editor lifecycle, taxonomy hierarchy, trash, and spreadsheet import state through replaceable local repositories.
- `AdminRepository` defines the data boundary.
- `mockAdminRepository` is the current browser-persistent fictional adapter.
- `ContentRepository` defines a separate content/storage boundary. `mockContentRepository` persists the ID-based hierarchy and metadata locally while holding uploaded binary sources only for the active browser runtime.
- `PackageRepository` defines the package catalogue boundary. `mockPackageRepository` persists package metadata and stable Content item references without duplicating files or folders.
- `BroadcastRepository` defines the communications boundary. `mockBroadcastRepository` persists audience, presentation, scheduling, behavior, and lifecycle state locally for interface development.
- `QuestionRepository` and `TaxonomyRepository` define the backend-ready boundaries for question lifecycle, import publishing, and Course -> Subject -> Chapter -> Lesson -> Topic taxonomy persistence.

The admin stores can be constructed against different repository adapters, allowing the browser-persistent mocks to be replaced by HTTP adapters without rewriting page components.

## Admin isolation

The Admin Console has its own shell, CSS namespace, navigation, route transitions, loading states, dialogs, feedback, and responsive behavior. Admin chunks are lazy-loaded. The admin root uses `data-lenis-prevent` so the public smooth-scroll provider does not control admin tables, drawers, or dialogs.

`RequireSuperAdmin` is a client presentation guard, not the authoritative security layer. Production APIs must independently validate the session, role, and permission for every read and mutation.

## Motion and accessibility

Admin motion is limited to opacity and transforms with a centralized natural ease. Reduced-motion preferences remove spatial movement. The shell provides a skip link, route focus management, an accessible responsive navigation dialog, focus-trapped action dialogs, live feedback, visible focus states, and horizontally scrollable data tables on narrow screens.

## Deployment and indexing

Vite builds static assets to `dist`. Cloudflare Pages serves the SPA. Admin routes receive no-store/noindex response headers and route-level robots metadata.
