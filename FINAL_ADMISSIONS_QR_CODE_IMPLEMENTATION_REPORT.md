# FINAL ADMISSIONS QR CODE IMPLEMENTATION REPORT

Date: 25 August 2026  
Scope: Academy Admin Admissions (Bulk Import, rotating QR, Admission Code)  
Verification database: disposable local PostgreSQL 16, `parallax_flow_test` on `127.0.0.1:55432`  
Production/Supabase access: not used

## 1. Changes made

- Converted the Academy admission QR from a manual expiring UI into an automatically rotating, backend-authoritative flow.
- Added immediate revocation of the prior unused QR whenever a new QR is issued.
- Added nullable admission-code capacity and expiry for Unlimited/Limited and Never/Expires-on behavior.
- Replaced application-level pre-check uniqueness with database-enforced insert/retry generation.
- Added attributable failed-admission persistence and audit events.
- Added foreground cache refresh for code usage/status and admission history.
- Preserved Bulk Import and the existing Academy Admin navigation/role boundary.

## 2. Frontend changes

- Admissions starts QR generation automatically when an authorized Academy context is available.
- Each QR response is rendered from a new opaque backend token. A 750 ms safety margin starts refresh before the 10-second server expiry.
- Abort controllers plus monotonically increasing request versions prevent stale responses from replacing newer QR tokens.
- Expired or failed tokens are never presented as valid. Network failure clears the QR and shows `Connection lost — QR paused`, with automatic retry and a manual `Retry now` control.
- The UI shows `Refreshes in Xs`/`Refreshing secure QR…`; normal operation never shows `QR expired`.
- The raw QR capability token is not rendered or offered as a copyable fallback.
- The code dialog now supports Unlimited/Limited usage and Never/Expires-on expiration, with conditional fields and disabled duplicate submission.
- Code history renders `current / Unlimited` and `Never` where applicable.
- Admission history and code state refresh every 10 seconds while the page is in the foreground; admin-owned mutations still invalidate their caches immediately.

## 3. Backend changes

- QR tokens use `crypto.randomBytes(32)` and are persisted only as SHA-256 hashes.
- QR lifetime is exactly 10 seconds and is validated exclusively by the backend.
- Generation takes a PostgreSQL transaction-scoped advisory lock per Academy, revokes all prior unused active sessions, creates one new session, and records an audit event.
- Claim validates existence, revocation, consumption, expiry, Academy state, authenticated student state, duplicate membership, and cross-Academy membership before creating membership/history.
- Successful QR claims atomically set `usedAt`, preventing replay.
- Admission codes use eight characters from a 32-character non-ambiguous alphabet, produced from cryptographically secure bytes without modulo bias.
- Code creation directly attempts the globally unique insert and retries a maximum of 10 times on Prisma `P2002`; it returns a controlled 503 after bounded exhaustion.
- Limited-code redemption uses an atomic conditional update inside a serializable transaction. Unlimited codes omit the capacity predicate.
- Unknown, expired, exhausted, revoked, and unavailable codes share the controlled response `Invalid or unavailable admission code.`
- Attributable rejected QR/code attempts persist `FAILED` admission history and audit records without storing capability values in audit descriptions.

## 4. Database changes

Migration: `20260825110000_harden_admission_qr_and_codes`

- Added nullable `AcademyQrSession.revokedAt` and an Academy/revocation/expiry index.
- Changed `AdmissionCode.maxUses` to nullable; `NULL` means unlimited.
- Changed `AdmissionCode.expiresAt` to nullable; `NULL` means never expires.
- Preserved all existing code, Academy, usage, expiry, creator, and status values.
- Retained the global unique index `AdmissionCode_code_key` on `AdmissionCode.code`.

Disposable-database evidence:

- 20 migrations found; schema up to date.
- `maxUses` nullable: YES.
- `expiresAt` nullable: YES.
- Duplicate admission-code groups: 0.
- Academies with more than one live, unused, unrevoked QR: 0.

## 5. Security changes

- Neither QR generation nor code generation accepts client Academy identity as authority.
- QR bodies are strict-empty; code bodies are strict typed DTOs; student claims reject extra `academyId` fields.
- Academy Admin identity and the sole active Academy membership remain server-authoritative.
- Cross-Academy body/header/resource forgery fails closed.
- Student claims derive identity from authentication and Academy from the persisted token/code record.
- QR tokens contain no student data, Academy ID, credentials, JWT, or database secret.
- Codes contain no Academy identifier or custom admin text.
- Existing application rate limiting protects redemption routes.
- Academy Admin remains unable to access Packages, Orders, Coupons, Store Merchandising, Payments, Revenue, or Paid Content.

## 6. QR lifecycle

1. Academy Admin opens Admissions.
2. Frontend requests a new QR using the authenticated Academy context.
3. Backend serializes issuance for that Academy, revokes the prior live token, and creates a fresh opaque 10-second token.
4. Frontend renders it and counts down using server expiry only as a UX indicator.
5. Frontend requests the next token just before expiry and replaces the old image only with the latest response.
6. A successful claim atomically consumes the token; replay is rejected.
7. If refresh fails, the UI removes the QR, reports the paused state, and retries with a completely new token.

## 7. Admission code lifecycle

1. Admin selects Unlimited or Limited and Never or Expires-on.
2. Backend validates capacity/expiry and derives the Academy from authentication.
3. Backend generates and attempts to insert a random eight-character code.
4. PostgreSQL globally enforces uniqueness; collisions are regenerated and retried.
5. Student submits only the code using an authenticated Student route.
6. Backend resolves the Academy from `AdmissionCode`, validates lifecycle and membership rules, and atomically consumes capacity where limited.
7. Success creates Academy membership, durable admission history, and audit records.
8. Revoke immediately sets `REVOKED`; subsequent claims receive the same generic unavailable response.

## 8. Uniqueness implementation

- Database unique index: `AdmissionCode_code_key`.
- No check-then-insert race is used.
- Collision handling is insert → database conflict → regenerate → bounded retry.
- The QR `tokenHash` also remains globally unique.

## 9. Concurrency protection

- Concurrent QR issuance is serialized per Academy with a PostgreSQL advisory transaction lock.
- Database verification and tests confirm no Academy retains multiple live QR sessions.
- QR consumption uses a conditional update on `usedAt IS NULL`, `revokedAt IS NULL`, and future `expiresAt`.
- Limited code claims atomically require `currentUses < maxUses`; max-use-one concurrency admits exactly one claimant.
- Serializable transaction retry handles PostgreSQL write conflicts.

## 10. Tenant isolation

- Academy A Admin cannot generate, list, or revoke Academy B admission artifacts.
- A student already owned by Academy B cannot join Academy A through its QR.
- Code A resolves only to Academy A; tests verify no Academy B membership/history is created.
- Route tests verify Academy Admin, Student, and Super Admin boundaries and reject Academy identity mass assignment.

## 11. Tests

- Focused backend admissions: 42 passed, 0 failed, 0 skipped.
- Full disposable-database integration: 53 passed, 0 failed, 0 skipped.
- Focused production integration: 14 passed, 0 failed.
- Frontend: 22 test files, 120 passed, 0 failed.
- Admissions UI tests cover automatic QR start, no raw-token/expired rendering, paused failure state, and code-dialog conditional behavior.
- Admissions API tests cover tenant-free contracts, nullable options, cancellation, and pre-expiry rotation scheduling.

## 12. Database verification

- Prisma validation: PASS.
- Prisma generation: PASS.
- Prisma migration deploy/status: PASS; 20/20 migrations applied.
- Deterministic seed executed twice by the integration preparation step: PASS.
- Real PostgreSQL limited-code concurrency: PASS.
- Real PostgreSQL unlimited two-student redemption and Academy-owned membership/history: PASS.
- QR rotation/revocation/replay and cross-Academy membership checks: PASS.

## 13. Production build verification

- Frontend typecheck: PASS.
- Frontend production build: PASS (2,157 modules transformed).
- Backend typecheck: PASS.
- Backend production build and Prisma generation: PASS.
- Frontend production dependency audit: 0 vulnerabilities.
- Backend production dependency audit: 0 vulnerabilities.

## 14. Remaining risks

- Live browser visual verification is UNVERIFIED because no controllable browser session was available. Render-level UI tests and the production build passed, but a human browser smoke test should still confirm responsive appearance and observe at least two visible rotations.
- QR rotation creates short-lived database rows and issuance audit rows continuously while Admissions is open. Production operations should retain the existing durable audit policy and add an age-based cleanup/retention job for expired QR session rows if volume requires it; this must never remove required audit records.
- The student view currently supports authenticated QR-token submission but its camera control remains explicitly marked unconnected. Actual device-camera scanning should be separately enabled/tested if camera capture is a release requirement; this hardening did not introduce an unsafe browser-camera fallback.

## 15. Final verdict

PASS WITH WARNINGS

All backend, database, security, concurrency, tenant-isolation, frontend automated, build, migration, and dependency gates passed in the disposable local environment. The warning is limited to unavailable live-browser visual/device-camera verification and operational QR-session retention planning; production/Supabase was not contacted or modified.
