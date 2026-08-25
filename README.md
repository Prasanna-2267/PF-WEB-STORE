# Parallax Flow website

Parallax Flow is an Android-first learning ecosystem with three connected web experiences:

- the public marketing website;
- the premium learning-resource Store; and
- an isolated Super Admin Console.

## Current scope

### Marketing website

- Animated logo introduction
- Product-led landing hero
- Five-stage About Parallax Flow story
- Contact experience and production footer
- Responsive light and dark themes

### Store

- Public discovery, category, and product pages
- Cart, checkout, purchase-success, purchases, and profile routes
- Authentication-gated commerce actions
- Browser-persistent demonstration catalog/cart data

### Super Admin Console

- Protected `/admin/*` route hierarchy
- Responsive sidebar shell with light/dark themes
- Overview metrics, trend charts, recent orders, and inventory totals
- Searchable/filterable/sortable/paginated student directory
- Canonical student details reached from Students or Orders
- Grant access, change role, enable/disable account, and force-logout workflows
- Searchable/filterable/sortable/paginated order management
- Drive-style Content library with unlimited folder nesting, search, uploads, previews, details, drag/drop, multi-select, copy/move, and recursive deletion
- Package catalogue with reusable Content Library file/folder selection, INR pricing, lifecycle status, preview, editing, and safe deletion
- Complete Question Bank with normal/case MCQ and descriptive authoring, rich text, classification, lifecycle controls, trash recovery, and learner preview
- Spreadsheet question import with validation, Case ID grouping, preview, taxonomy safeguards, and CSV template download
- Broadcast workspace with audience targeting, app/website placement controls, scheduling, preview, lifecycle actions, and browser-persistent draft data
- Loading, empty, error, success, dialog, and reduced-motion states
- Placeholder routes remain only for later Account and Settings phases

## Technology

- React 18 and TypeScript
- Vite 6
- React Router 7
- Zustand
- Framer Motion
- Lenis for the public experience
- Lucide React icons

The Admin Console is lazy-loaded and isolated from the public and Store layouts. It opts out of the public Lenis scroll controller.

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

Cloudflare Pages:

- Build command: `npm run build`
- Output directory: `dist`

`public/_redirects` provides the SPA fallback. `public/_headers` applies entry-document cache protection and prevents indexing of `/admin` and `/admin/*`. Admin screens also emit `noindex, nofollow, noarchive` metadata.

## Security and data boundary

Authentication and admin data currently use explicitly labelled browser-side development adapters. The console is fully navigable and its actions persist locally for product review, but this is not a production security boundary.

Before real administrators or student records are used, a trusted backend must:

- verify passwords and Google ID tokens server-side;
- issue secure sessions;
- enforce `SUPER_ADMIN` and per-action permissions on every endpoint;
- own students, orders, entitlements, sessions, receipts, and audit records;
- validate, rate-limit, and audit every privileged mutation.

Never expose real student, order, or payment data through the current mock repository.

## Documentation

- [Current state](docs/current-state.md)
- [Architecture](docs/architecture.md)
- [Routing](docs/routing.md)
- [Integration contract](docs/api-contract.md)
- [Design system](docs/design-system.md)
- [Animation system](docs/animation-system.md)
- [Component inventory](docs/component-library.md)
- [Todo](docs/todo.md)
- [Changelog](docs/changelog.md)
