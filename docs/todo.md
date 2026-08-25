# Todo

## Required before real Super Admin production use

- Replace the mock authentication adapter with server-verified email/Google authentication and secure sessions.
- Replace `mockAdminRepository` with a trusted API repository.
- Enforce `SUPER_ADMIN` and per-action permissions server-side.
- Connect orders and receipts to the payment authority.
- Connect grants to the Android entitlement system with idempotency and reconciliation.
- Implement immutable server audit logs and real session revocation.
- Complete privacy, retention, rate-limit, abuse-control, and observability requirements.

## Final device/browser verification

- Verify anonymous `/admin/*` redirect and preserved return destination.
- Verify non-admin denial and authorized Super Admin routing.
- Verify Overview, Students, Student Details, Orders, and both canonical student-detail entry paths.
- Verify all student dialogs and success/error feedback.
- Verify light/dark and reduced-motion modes.
- Verify keyboard focus, mobile drawer, table scrolling, and 320/390/768/1024/1440/1920 widths.
- Repeat in Chrome, Edge, Firefox, Safari, Android Chrome, and Mobile Safari.

## Content production integration

- Replace the mock Content repository with authenticated APIs and private object storage.
- Add server-side file signature validation, malware scanning, storage quotas, audit history, resumable upload, and signed preview/download URLs.
- Re-run the Content interaction matrix in a connected browser: upload, preview, drag/drop, context menu, keyboard selection, deep copy, safe move, recursive delete, search, detail editing, and narrow-screen layouts.

## Packages production integration

- Replace the browser-local Package repository with authenticated APIs and persistent Package/PackageItem records.
- Validate package pricing, lifecycle status, Content references, ancestor/descendant deduplication, and delete semantics server-side.
- Add audit history, cover-image and course associations, and Store publication rules before exposing packages for purchase.
- Keep payments, student ownership, and Android content unlocking outside the Packages module until their authoritative services are connected.

## Later admin phases

- Coupons
- Account
- Settings

## Questions production integration

- Replace browser-local question and taxonomy repositories with authenticated, permission-enforced APIs and durable database storage.
- Perform server-side HTML sanitization, validation, versioning, audit logging, publishing authorization, and referential-integrity checks.
- Move spreadsheet parsing/import into an auditable job flow for large files, with antivirus scanning, row-level error exports, idempotency, and safe rollback.
- Re-run the complete Question Bank matrix in connected browsers: four question types, both case classification modes, reorder/duplicate/delete, preview, publish/archive/trash/restore, hierarchy filters, CSV/XLSX import, keyboard access, dark mode, and narrow screens.

## Broadcast production integration

- Replace the browser-local Broadcast repository with authenticated API endpoints and an authoritative delivery service.
- Enforce audience, platform, placement, priority, schedule, expiry, frequency, and lifecycle rules server-side.
- Store uploaded banners in protected object storage and record immutable audit history for publish, schedule, disable, restore, archive, and delete actions.
- Re-run the Broadcast interaction matrix in a connected browser across desktop, tablet, mobile, keyboard-only, dark mode, and reduced-motion settings.
