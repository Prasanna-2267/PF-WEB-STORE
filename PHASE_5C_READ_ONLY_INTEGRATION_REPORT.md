# Parallax Flow Phase 5C — Typed Frontend Domain Integration, Phase 1

Date: 2026-08-22  
Scope: Academy Students/Courses and Super Admin Students/Academies, read-only  
Backend/database/Supabase/migrations: not modified or accessed  
UI architecture: existing Phase 5B API, authentication, tenant, Query Client, guards, and logout preserved

## 1. Files created

- `src/features/academy/readOnly/academyReadOnlyApi.ts`
- `src/features/academy/readOnly/AcademyStudentsReadOnlyPages.tsx`
- `src/features/academy/readOnly/AcademyCoursesReadOnlyPages.tsx`
- `src/features/admin/readOnly/adminReadOnlyApi.ts`
- `src/features/admin/readOnly/AdminStudentsReadOnlyPages.tsx`
- `src/features/admin/readOnly/AdminAcademiesReadOnlyPages.tsx`
- `src/components/ReadOnlyPagination.tsx`
- `src/components/ReadOnlyQueryState.tsx`
- Four domain contract test files, shared error-state tests, and cache-isolation tests
- This report

## 2. Files modified

- `src/app/router/AppRouter.tsx`: enabled only the eight read-only list/detail routes.
- `src/features/readOnlyCacheIsolation.test.ts`: added Phase 5C identity and retry-policy coverage.

No backend, schema, migration, Supabase, production, or staging file was changed.

## 3. Backend endpoints integrated

| Screen | Request | Method | Query/path contract |
|---|---|---|---|
| Academy Students | `/api/academy/students` | GET | `page`, `limit`, optional `search`, optional `status` |
| Academy Student detail | `/api/academy/students/:studentId` | GET | Student user UUID in path |
| Academy Courses | `/api/academy/courses` | GET | `page`, `limit` only |
| Academy Course detail | `/api/academy/courses/:courseId` | GET | Course UUID in path |
| Super Admin Students | `/api/admin/students` | GET | `page`, `limit`, optional `search`, optional `status`, fixed `role=student` |
| Super Admin Student detail | `/api/admin/students/:userId` | GET | User UUID in path |
| Super Admin Academies | `/api/admin/academies` | GET | `page`, `limit`, optional `search`, optional `status` |
| Super Admin Academy detail | `/api/admin/academies/:academyId` | GET | Academy UUID in path |

Every request is a GET through the Phase 5B client. No mutation request exists in the new modules.

## 4. Academy Students compatibility mapping

`{ data, pagination }` is adapted to `{ items, pagination }`. Membership `id` becomes `membershipId`; `studentId` remains the user UUID used by the detail route; `name`, `email`, nullable `phone`, membership status, account status, and ISO `joinedAt` are preserved. Detail maps the returned student and actual course enrollments only.

The backend supports search across name/email and membership status values `ACTIVE`, `INVITED`, `SUSPENDED`, and `REVOKED`. Ordering is fixed at joined-date descending then membership ID descending. The existing course filter was disabled because the endpoint does not support it. Purchases, progress, subscriptions, sessions, entitlements, and revenue are not rendered.

## 5. Academy Courses compatibility mapping

The backend `Course` projection maps `id`, `code`, `name`, `description`, lifecycle status, ISO dates, and `_count.contentItems/questions/enrollments` to explicit view-model fields. The lifecycle remains `ACTIVE | INACTIVE | ARCHIVED`; no `DRAFT` conversion exists.

The endpoint supports page/limit only and fixes ordering to creation date descending then ID descending. Search, status filtering, and alternate sorting are clearly unavailable rather than emulated locally. Deleted/archived course rows are excluded by the backend query. Detail displays only the course fields and counts returned by the backend.

## 6. Super Admin Students compatibility mapping

The backend endpoint projects platform users. The Student screen pins the backend-supported `role=student`, maps `fullName` to `name`, preserves nested role key/name, account status, nullable phone/last-login, and ISO creation date, and uses the backend pagination envelope.

Detail displays only returned permissions, up to 25 returned sessions, and up to 50 returned Academy memberships. Purchases, study progress, orders, entitlements, revenue, fabricated activity, and mutation actions are absent.

## 7. Super Admin Academies compatibility mapping

The list maps the raw Academy projection and its `_count.memberships` and `_count.tenantCourses`. Search supports backend name/email/slug matching; status supports `ACTIVE`, `PENDING`, and `SUSPENDED`; ordering is backend-fixed newest first.

Detail maps the returned Academy identity/contact/administrator fields plus up to 100 memberships, invitations, and tenant courses. Displayed summary totals are explicitly the lengths returned by that bounded response. No revenue, activity, or membership data is generated.

## 8. Mock repositories removed or deactivated

The four active route pairs no longer import or execute:

- `useAcademyQueries`
- `mockAdminRepository`
- `mockAcademyRepository`
- legacy Academy course/student mutations
- legacy Super Admin Academy/student mutations

Old source remains dormant for later controlled removal because it is shared with future unintegrated domains. The production build emits the new read-only chunks and does not route these four domains through the legacy pages.

## 9. Query-key architecture

- Academy lists: `['academy', authoritativeAcademyId, domain, normalizedFilters]`
- Academy details: `['academy', authoritativeAcademyId, domain, 'detail', resourceId]`
- Super Admin lists: `['admin', authenticatedUserId, domain, normalizedFilters]`
- Super Admin details: `['admin', authenticatedUserId, domain, 'detail', resourceId]`

Academy identity comes from `/api/academy/context` through the existing tenant store. It is not sent as `academyId` or `x-academy-id` by these requests. TanStack cancellation signals are forwarded to every API call.

## 10. Error handling

All pages preserve query failures and render explicit retryable states. The shared classifier distinguishes 401, 403, 404, 409, 422, 429, 503, network, and unknown transport failures. The existing API client performs one single-flight session refresh/replay for eligible 401 responses. The shared Query Client retries network, 429, and 5xx failures once; it does not retry permission or validation failures. No error becomes empty or successful data.

## 11. Cache isolation

Tests prove Academy A keys do not resolve Academy B data and Admin A keys do not resolve Admin B data. Central logout clears every domain query. Auth identity changes continue to clear the shared Query Client through the Phase 5B store. No new cache, local storage, module Map, or server-data persistence layer was added.

## 12. Tests added

Phase 5C coverage includes successful DTO adaptation, server pagination, supported search/status filters, canonical Student role filtering, empty responses, list/detail endpoint paths, backend-only count/enrollment/membership projections, unsupported Academy Course filter exclusion, 401/403/404/409/422/429/503/network UI classification, Academy and user identity query keys, cross-identity isolation, logout cache clearing, and retry policy.

HTTP is mocked at the frontend API boundary. No database or Supabase connection is used.

## 13. Test result

`npm test`: PASS — 12 files, 71 tests, 0 failed.

## 14. Typecheck result

`npm run typecheck`: PASS.

## 15. Build result

`npm run build`: PASS — Vite transformed 1,986 modules and emitted separate Academy Students, Academy Courses, Admin Students, Admin Academies, and typed API chunks.

## 16. Lint result

UNVERIFIED — the repository has no configured `lint` script. No substitute formatter or new lint configuration was invented during this phase.

## 17. Remaining compatibility issues

- Academy Students lacks backend course/enrollment filtering and configurable sorting.
- Academy Courses lacks backend search, lifecycle filtering, and configurable sorting.
- Super Admin Academies lacks configurable sorting.
- Super Admin Student detail caps sessions at 25 and memberships at 50 without pagination.
- Super Admin Academy detail caps memberships, invitations, and courses at 100 without pagination.
- Avatar fields are storage paths rather than display-ready signed URLs and are intentionally not rendered.
- Live browser-to-deployed-backend and staging environment verification remain UNVERIFIED.

## 18. Remaining P1 issues

- Add missing backend read filters/pagination only through an explicitly approved backend phase.
- Remove legacy dormant repositories after their remaining consumers are integrated.
- Add signed-avatar presentation when a safe backend contract exists.
- Complete the remaining frontend domains using the same DTO/adapter/query pattern.
- Perform live staging browser/API verification without weakening tenant or RBAC controls.
- Retain the coordinated HttpOnly refresh-cookie hardening from the Phase 5B report.

## 19. Exact next phase

Phase 5C-2 — typed mutations for these four domains, after live read-only staging smoke verification. Implement one mutation workflow at a time with backend-authoritative RBAC/tenant scope, idempotency where required, field-level validation errors, cache invalidation only after confirmed success, and false-success regression tests. Do not enable currently unavailable actions until their individual contracts and tests pass.

## Final verdict

PHASE 5C READ-ONLY INTEGRATION COMPLETE
