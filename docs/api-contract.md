# Integration contract

There is no production backend API connected yet.

## Authentication

`src/services/auth.service.ts` is a development adapter. It simulates email/Google login and maps the configured demonstration administrator email to a `super_admin` profile. Passwords and Google ID tokens are not verified by a trusted server.

Production authentication must return a server-issued session plus trusted role and permission claims. The browser must never promote a user by comparing an email address.

## Admin repository

`src/features/admin/api/adminRepository.ts` defines the required interface:

- overview metrics;
- student list/detail reads;
- order list/detail reads;
- access grants;
- role updates;
- account enable/disable;
- session revocation.

`mockAdminRepository.ts` currently implements that contract with fictional fixtures and local persistence.

## Content repository

`src/features/admin/content/api/contentRepository.ts` defines the UI-facing content contract for child listings, breadcrumbs, nested search, folder summaries, creation, uploads, rename, deep copy, safe move, recursive deletion, descriptions, open tracking, and file-source lookup.

`mockContentRepository.ts` implements the contract with seeded fictional content and browser-local metadata. The hierarchy uses stable IDs and `parentId`, so folders can be nested without a fixed depth. Uploaded `File` objects are intentionally runtime-only in the mock. A production adapter must upload binaries to protected object storage and return authorized, expiring preview/download URLs.

## Package repository

`src/features/admin/packages/api/packageRepository.ts` defines list, create, update, and delete operations for package records. A package stores title, description, INR price, publication status, timestamps, future-facing course/cover fields, and a deduplicated collection of stable Content item references.

`mockPackageRepository.ts` persists package metadata in the browser for interface development. Folders are referenced once and interpreted as including their descendants; binaries and Content records are never duplicated. Deleting a package removes only the package record. A production API must enforce referential integrity, publication rules, price validation, audit history, and safe handling of source content that becomes unavailable.

## Broadcast repository

`src/features/admin/broadcast/api/broadcastRepository.ts` defines list, draft creation, editing, duplication, publication, scheduling, disable/enable, schedule cancellation, archive/restore, and deletion operations.

`mockBroadcastRepository.ts` persists fictional communications in the browser and normalizes scheduled/expired lifecycle state for interface development. A production service must authorize every mutation, validate audience and placement eligibility, execute schedules independently of an open browser, deliver communications idempotently, store banner assets securely, and retain immutable audit history.

## Production requirements

Before connecting real data, provide authenticated endpoints that:

- enforce `SUPER_ADMIN` and the required permission on every operation;
- validate pagination, search, filters, sorting, identifiers, reasons, and expiry dates;
- create immutable audit records for privileged actions;
- make access grants idempotent and reconcile them with the Android library;
- revoke server-side sessions, not merely UI records;
- source order/payment/receipt status from the payment authority;
- validate file type, file signature, size, malware status, storage quota, folder ancestry, and object ownership for every Content mutation;
- validate package prices, statuses, Content references, ancestor/descendant deduplication, and package deletion semantics;
- stream or multipart-upload large files and issue short-lived signed preview/download URLs;
- avoid exposing sensitive student fields unnecessarily;
- support rate limits, structured errors, observability, and CSRF/session protection.

Client-side guards and hidden buttons improve UX only; they are not authorization.
