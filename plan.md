# Production maintenance plan

The live Parallax Flow experience is complete for its current scope. Maintenance work must preserve the rendered design and these capabilities:

- Landing-page introduction, navigation, hero, contact section, and footer
- Login, registration, and forgot-password flows
- Theme persistence and theme toggle
- Responsive behavior
- SEO metadata and structured data
- Cloudflare Pages routing and headers

## Change protocol

1. Make a recoverable snapshot before structural cleanup.
2. Confirm a file is outside the active import and route graph before deleting it.
3. Do not replace the live hero, auth, contact, navigation, or footer markup during maintenance.
4. Run `npm run build` after each structural pass.
5. Verify `/`, `/home`, `/contact`, `/login`, `/register`, and `/forgot-password`.
6. Check light, dark, desktop, tablet, mobile, keyboard, and reduced-motion behavior before deployment.

## Next product work

Backend authentication, contact delivery, and future navigation destinations require separate product approval and API contracts. They are not part of maintenance cleanup.

## Current full-stack context — paid resource duration (31 Aug 2026)

The active implementation replaces the legacy learner-exam-relative paid-content policy with a purchase/activation-relative policy across the existing shared Admin, Academy, Store and Student architecture.

- Paid content and Packages support either permanent access or a fixed positive duration in days, weeks or months.
- Fixed access begins when payment succeeds or an administrator activates/grants the entitlement; it does not begin when content is uploaded.
- Each entitlement snapshots `purchasedAt`, `startsAt` and `expiresAt`, so later product-policy edits do not rewrite historical purchases.
- Content, package and Question Bank access continues to flow through the existing entitlement system; Question Banks inherit their commercial policy from their required linked Package.
- Student notes, library and protected-viewer access use the snapshotted entitlement expiry and fail closed for expired access.
- Both Super Admin and Academy Admin content creation/editing expose the same permanent/fixed policy without changing their existing navigation or publishing workflows.
- Legacy `validityMode`/`validityOffsetDays` columns remain temporarily for compatibility, but current APIs write them as permanent/null and no current UI offers “Exam date + days”.
- Unit limits are enforced in UI, API validation, service logic and PostgreSQL constraints: 3650 days, 520 weeks or 120 months.
- Migration `20260831153000_replace_exam_relative_with_purchase_duration` is additive and preserves existing orders and entitlements. It must be applied with `prisma migrate deploy`; never reset the shared database.

Verification completed: web and server TypeScript checks, Prisma validation/client generation, server production build, and focused resource-validity tests. The browser test/build runner can require unrestricted Vite/esbuild filesystem access in the Codex sandbox; this is an environment restriction rather than a TypeScript or policy failure.

## Academy provisioning record and inspection — completed 2 Sep 2026

Academy creation, persistence and inspection now use one complete normalized record across the existing shared PostgreSQL architecture.

- The six-step Super Admin creation wizard submits academy identity, primary administrator, operational contacts, legal/tax data, academy and billing addresses, invoice settings, academic offerings, commercial terms, subscription dates, seat limits and integration metadata through the existing provisioning endpoint.
- `createProvisionedAcademy` persists the complete request atomically into `Academy`, `AcademyProfile`, `AcademyContact`, `AcademyLegalProfile`, `AcademyAddress`, `AcademyBillingProfile`, `AcademyAcademicOffering`, `AcademyCommercialProfile` and `AcademyIntegrationProfile`, together with the first administrator membership and audit record.
- No additional Prisma migration is required for this work: the normalized tables and relationships already exist. Do not reset or replace the shared database.
- Super Admin academy inspection now exposes the complete persisted record instead of the former limited academy summary, including addresses, contacts, legal/GST/PAN data, billing, academic scope, subscription/seat information and integration status.
- Academy Admin Settings retains its existing editable operational settings and adds a complete provisioning record that is strictly read-only.
- Sensitive implementation details such as raw storage paths are not printed in the UI; document/logo availability is shown as an upload status.
- Missing optional fields render explicitly as not provided, rather than disappearing or being replaced with demo values.

Verification completed: frontend typecheck and production build, backend typecheck and production build (including Prisma Client generation), and the academy provisioning validation tests. The Academy Settings database-write suite remains intentionally guarded behind `SETTINGS_TEST_DATABASE=1` and a disposable `TEST_DATABASE_URL`; destructive setup was not run against the shared database.
