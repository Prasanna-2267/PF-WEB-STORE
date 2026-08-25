# Parallax Flow — Academy Questions & Broadcast Integration Report

Date: 25 August 2026

## Verdict

The Academy Admin Questions and Broadcast modules are implemented against the same reusable presentation and workflow components as the Super Admin modules, while using Academy-only repositories, authenticated tenant context, and PostgreSQL-backed APIs.

Automated frontend, backend, security, migration, deterministic seed, and disposable PostgreSQL integration verification passed. Production builds and production dependency audits passed.

Live browser visual/click-through verification is **UNVERIFIED** because no controllable browser session was available to the test agent. This report therefore does not claim that the overall product is ready for production solely from these changes.

## Frontend implementation

### Questions

- `QuestionsPage` is now a shared platform/Academy presentation with the same question-bank navigation, search, course/taxonomy/status filters, editor, preview, import, lifecycle actions, trash, and pagination.
- `AcademyQuestionsPage` supplies the authenticated Academy scope to that shared presentation.
- Academy data is loaded only from `/api/academy/questions` and Academy taxonomy endpoints.
- The Academy course selector is populated only from the authenticated Academy's course API.
- Academy question state is keyed by Academy scope to prevent stale data from one Academy being displayed in another Academy session.
- Fixture and local-storage fallbacks are not used for Academy success states.

### Broadcasts

- `BroadcastPage` is now a shared platform/Academy presentation with the same summary cards, search and lifecycle filters, editor, preview, scheduling, duplication, archive/restore, delete, and pagination workflows.
- `AcademyBroadcastPage` creates a tenant-specific store and injects only the authenticated Academy's courses.
- Academy audience options are restricted to Academy students or one Academy-owned course.
- Platform/store/package/other-Academy audience choices and unsafe promotion/store placements are not available in Academy mode.
- Broadcast images use the backend-authorized storage upload and signed-URL flow; removal deletes the persisted image reference rather than showing a false success.
- React Query invalidation occurs after confirmed mutations.

## Backend and database implementation

### Questions

- Academy question CRUD, import, taxonomy, publish, archive, restore, clone, and delete operations remain tenant-derived on the server.
- Course ownership is checked in the same Academy scope as the question.
- Student reads of Academy questions now require an active membership in that Academy.
- Direct Parallax Flow students query only platform questions (`academyId = null`).
- Arbitrary Academy identifiers cannot be used to read another tenant's question bank.

### Broadcasts

- Academy broadcast create/update supports the safe subset of the Super Admin workflow, including presentation settings, timeline, placements, call-to-action, course targeting, acknowledgement, repeat, and lifecycle data.
- The Academy identifier is derived from authenticated tenant context and is not accepted as an authorization input from the client.
- Academy/course/content CTA targets are ownership-validated.
- Unsafe internal routes such as platform admin, store, packages, Academies, protocol-relative URLs, and foreign Academy resources are rejected.
- Create, update, publish, schedule, cancel, archive, restore, and delete operations persist to PostgreSQL and retain lifecycle history.
- Existing schema foreign keys and indexes were sufficient; no Prisma schema or migration was added.

### Tenant-context hardening

- Super Admin access to Academy routes now requires an explicit `x-academy-id` context instead of silently selecting a default Academy.
- Academy Admin tenant resolution remains server-authoritative.

## API contracts exercised

Questions:

- `GET/POST /api/academy/questions`
- `GET/PUT/DELETE /api/academy/questions/:id`
- `POST /api/academy/questions/:id/publish`
- `POST /api/academy/questions/:id/archive`
- `POST /api/academy/questions/:id/restore`
- `POST /api/academy/questions/:id/clone`
- Academy taxonomy and import endpoints under `/api/academy/questions`

Broadcasts:

- `GET/POST /api/academy/broadcasts`
- `GET/PATCH/DELETE /api/academy/broadcasts/:id`
- `POST /api/academy/broadcasts/:id/publish`
- `POST /api/academy/broadcasts/:id/schedule`
- `POST /api/academy/broadcasts/:id/cancel`
- `POST /api/academy/broadcasts/:id/archive`
- `POST /api/academy/broadcasts/:id/restore`
- Backend-authorized storage upload, signed URL, and deletion endpoints for broadcast imagery

## Security evidence

The full disposable-database suite verified:

- unauthenticated requests return 401;
- Student-to-Academy and Academy-Admin-to-platform privilege violations return 403;
- missing resources return 404;
- invalid request bodies return 422;
- Academy A cannot read or mutate Academy B courses, questions, or broadcasts;
- foreign course/question/broadcast identifiers do not bypass tenant checks;
- forged `academyId` request data does not change the server-selected tenant;
- platform questions/broadcasts and Academy questions/broadcasts remain separate;
- Student Academy question reads require active membership;
- pagination and lifecycle behavior use persisted records;
- rich broadcast settings, course targets, placements, CTA data, and timeline events round-trip through PostgreSQL;
- broadcast delivery and jobs remain scoped to the persisted audience.

## Verification results

| Gate | Result | Evidence |
|---|---:|---|
| Academy Questions/Broadcast UI parity tests | PASS | 2/2 |
| Complete frontend tests | PASS | 24 files, 129/129 tests |
| Backend tests | PASS | 36/36 tests |
| Frontend typecheck | PASS | `npm.cmd run typecheck` |
| Backend typecheck | PASS | `npm.cmd --prefix server run typecheck` |
| Frontend production build | PASS | TypeScript and Vite build, 2,162 modules transformed |
| Backend production build | PASS | Prisma Client generation and TypeScript build |
| PostgreSQL 16 readiness | PASS | `pf-phase4-postgres`, `pg_isready` accepted connections |
| Migrations | PASS | 20 migrations applied; no pending migration |
| Deterministic seed | PASS | seed executed twice successfully |
| Full disposable DB integration | PASS | 54/54 tests, 0 failed, 0 skipped, 0 todo |
| Frontend production dependency audit | PASS | 0 known vulnerabilities across 167 production dependencies |
| Backend production dependency audit | PASS | 0 known vulnerabilities across 264 production dependencies |
| Live browser visual/click-through | UNVERIFIED | no controllable browser session available |

The database suite used only the disposable PostgreSQL database at `127.0.0.1:55432/parallax_flow_test`, with `TEST_DATABASE_URL`, `DATABASE_URL`, and `DIRECT_URL` set to the same disposable URL and `RUN_BACKEND_INTEGRATION=1`. Supabase and production services were not contacted.

## Files added

- `src/features/academy/questions/academyQuestionRepository.ts`
- `src/features/academy/questions/academyTaxonomyRepository.ts`
- `src/features/academy/questions/academyQuestionStore.ts`
- `src/features/academy/broadcast/academyBroadcastRepository.ts`
- `src/features/academy/academyQuestionsBroadcastParity.test.tsx`

## Principal files modified

- `src/features/admin/questions/QuestionsPage.tsx`
- `src/features/admin/questions/api/questionRepository.ts`
- `src/features/admin/questions/api/questionImportRepository.ts`
- `src/features/admin/questions/components/ImportQuestions.tsx`
- `src/features/academy/questions/AcademyQuestionsPage.tsx`
- `src/app/store/useQuestionStore.ts`
- `src/features/admin/broadcast/BroadcastPage.tsx`
- `src/features/academy/broadcast/AcademyBroadcastPage.tsx`
- `src/app/store/useBroadcastStore.ts`
- `server/src/routes/academyAdminRoutes.ts`
- `server/src/services/academyAdminService.ts`
- `server/src/services/questionService.ts`
- `server/src/auth/tenant-auth.ts`
- `server/src/integration/phase4-production.integration.test.ts`

## Remaining release action

Run a manual or automated browser pass while authenticated as Academy Admin A, Academy Admin B, Student, and Super Admin. Verify responsive layout, modal focus/keyboard behavior, real create/edit/publish/schedule/archive/delete flows, identity switching, and that browser network traffic contains no production or Supabase requests. Until that pass is captured, browser UX and final whole-product production readiness remain **UNVERIFIED**.
