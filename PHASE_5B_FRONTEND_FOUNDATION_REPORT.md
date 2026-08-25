# Parallax Flow Phase 5B — Frontend P0 Foundation Report

Date: 2026-08-22  
Scope: frontend security, authentication, tenant context, guarded smoke integration  
Backend/database changes: none  
Supabase/migrations/deployment: not used

## 1. Files created

- `src/lib/api/client.ts`, `contracts.ts`, `credentials.ts`, and `client.test.ts`
- `src/lib/queryClient.ts`
- `src/components/auth/AuthBootstrap.tsx`
- `src/components/IntegrationPendingPage.tsx`
- `src/components/guards/RequireStudent.tsx` and guard regression tests
- `src/features/admin/LiveAdminOverviewPage.tsx`
- `src/features/academy/LiveAcademyOverviewPage.tsx`
- `src/features/academy/api/useLiveAcademyOverviewQuery.ts`
- Auth, tenant-store, and Student-admission test files
- This report

## 2. Files modified

- Dependency/tooling: `package.json`, `package-lock.json`, `vite.config.ts`
- Bootstrap/providers: `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`
- Routing/guards: `src/app/router/AppRouter.tsx`, existing public/auth/Super Admin/Academy Admin guards
- Authentication: `src/services/auth.service.ts`, `src/app/store/useAuthStore.ts`, Login, Register, Forgot Password, and logout call sites
- Tenant: `src/app/store/useAcademyTenantStore.ts`, Admin and Academy layouts
- Safety corrections: Student admission, Academy admissions hooks/page, Academy settings hooks/page, and optional legacy Store profile fields

No file under `server/` was modified in Phase 5B.

## 3. Authentication architecture

- Login, registration, and Google sign-in call `/api/auth/login`, `/api/auth/register`, and `/api/auth/google`.
- Google ID tokens are forwarded to the backend and are never decoded into browser authority.
- Identity, role, and permissions are copied from the backend response without email rules or privilege normalization.
- Application bootstrap restores token material and calls `/api/auth/session`; a persisted profile alone cannot authenticate the application.
- Access and refresh credentials are held in memory and `sessionStorage`. No credential, user, role, permission, or Academy authority is persisted in `localStorage`.
- Password recovery now fails explicitly because the verified backend has no recovery endpoint; it cannot display fabricated success.

## 4. API client architecture

One API client handles base URL selection, bearer injection, request IDs, JSON bodies, structured backend error envelopes, timeout/cancellation, idempotency keys, tenant headers when explicitly supplied by an already-authorized flow, FormData, and signed-URL PUT uploads. It preserves status/code/message/field errors/request ID for 4xx, 429, 5xx, and provider-disabled responses.

The client uses `VITE_API_BASE_URL`, then `VITE_API_URL`, then same-origin as its base. Non-JSON failures are converted into an explicit `ApiError`, not a success payload.

## 5. Refresh architecture

- A single module owns refresh.
- Concurrent 401 responses share one in-flight `/api/auth/refresh` call.
- Rotated access and refresh tokens replace the previous pair.
- Each original request retries at most once.
- Refresh replay/failure clears credentials and authenticated state and causes guards to return the user to an unauthenticated experience.

Current backend contract returns refresh tokens in JSON. The exact later hardening is: backend sets the refresh token in a `Secure; HttpOnly; SameSite=Strict` cookie scoped to `/api/auth`, refresh/logout consume and rotate/revoke that cookie, and the frontend stops reading or storing refresh tokens. That is a coordinated backend contract change and was not invented client-side in this phase.

## 6. Tenant architecture

- `GET /api/academy/context` is the sole source of Academy Admin context.
- A normal Academy Admin sends no arbitrary `x-academy-id`; the backend resolves the authorized membership.
- The tenant store is non-persistent and caches only the server response and display data returned by the protected overview.
- There is no `setActiveAcademyId`, Student membership setter, hardcoded default Academy, or browser Academy selector authority.
- Missing, ambiguous, or foreign context fails closed. Super Admin access to an Academy also follows the backend contract and is denied until an explicit server-approved selection flow exists.

## 7. React Query architecture

- One `QueryClient` is provided at the application root.
- Defaults: 30-second `staleTime`, five-minute `gcTime`, no focus refetch, and one retry only for network/429/5xx conditions.
- Query functions consume TanStack cancellation signals.
- Live Super Admin keys include authoritative user ID; Academy keys include the resolved Academy ID; Student invalidation includes authoritative user ID.
- Authentication/user changes and logout clear the query cache; tenant clearing removes Academy queries.
- Integrated admissions/settings mutations update or invalidate only after backend success.

## 8. Security changes

- Removed configured admin emails, `email.includes("admin")`, fake JWTs, browser-generated profiles, and local Google JWT parsing.
- Route guards now consume server-derived user state. Academy content waits for successful backend context resolution.
- Student users cannot enter Academy Admin routes; Academy Admin users cannot enter Super Admin routes.
- Registration password controls match the backend 12–128 character policy.
- Removed the hardcoded Google client-ID fallback.
- Known legacy domain cache keys are cleared during centralized logout.
- Dependency audit fixes upgraded vulnerable packages; final `npm audit --omit=dev` reports zero vulnerabilities.

## 9. False-success removals

- Admissions validation/import, QR session, admission-code creation/revocation, settings updates, and logo upload no longer fall back to generated local results.
- Logo upload follows upload-intent → signed PUT → finalize → signed download URL.
- Unintegrated Admin and Academy domain routes render `IntegrationPendingPage`; they cannot invoke legacy browser repositories or claim server success.
- Checkout explicitly states no charge or entitlement change occurred; it does not simulate payment.
- The production bundle contains the live overview pages and does not contain legacy Admin/Academy CRUD page chunks.

## 10. Student admission corrections

- `/student/join` and `/student/scan-qr` are protected by the Student guard.
- Code claims use `/api/student/admissions/codes/claim`; QR claims use `/api/student/admissions/qr/claim`.
- Requests contain only `{code}` or `{qrToken}`. No `studentUserId` is sent.
- The camera simulator and generated QR token were removed.
- Backend expired/replayed/invalid/exhausted/revoked/unauthorized/provider/network errors remain failures.
- Successful admission routes toward `/store/profile`, not the Academy Admin portal.

## 11. Tests added

Six frontend suites and 35 tests cover:

- Login response/failure, invalid credentials/password, registration-disabled 503, Google backend forwarding, unavailable password recovery
- Server session restoration and server-side role change
- Access-token refresh, rotation, concurrency single-flight, replay/terminal failure, retry-once behavior, and logout cleanup
- Anonymous, Student, Academy Admin, and Super Admin route boundaries
- Own Academy resolution, ambiguous membership, foreign denial, absence of arbitrary switch functions, and logout tenant clearing
- Student code and QR route/body correctness, no client identity field, already admitted, expired/replayed/invalid/exhausted/revoked, 403/503/network failure, and no false success

## 12. Test results

`npm test`: PASS — 6 files, 35 tests, 0 failed.

Vitest discovery is restricted to frontend `src/**/*.test.{ts,tsx}` so it does not incorrectly execute the backend Node/database suite or require a database URL.

## 13. Typecheck result

`npm run typecheck`: PASS.

## 14. Build result

`npm run build`: PASS — 1,976 modules transformed. The isolated live Super Admin and Academy overview chunks were emitted; dormant legacy CRUD chunks were absent.

## 15. Remaining P0 issues

None found within the Phase 5B foundation scope.

Live browser-to-running-backend staging E2E remains unverified and is not being represented as a P0 code pass, a staging verdict, or production readiness.

## 16. Remaining P1 issues

- Replace each route-gated legacy mock repository/page with typed React Query integrations, then delete the dormant fixtures and hardcoded demo Academy IDs.
- Integrate Student membership/library endpoints so the Student experience can show server-owned Academy and entitlement data.
- Integrate Commerce, Orders, Contact, Courses, Content, Questions, Broadcasts, Notifications, Analytics, Settings, Admissions Admin, and Super Admin CRUD domain by domain.
- Sanitize or render trusted rich-text contracts without dormant `dangerouslySetInnerHTML` preview paths.
- Implement a backend-approved multi-Academy/Super Admin selection contract if product requirements need it.
- Consider the coordinated HttpOnly refresh-cookie contract described above.
- Add live staging E2E tests against the verified staging backend, including Google provider configuration and signed storage.

Security-search determination: remaining `acad-abc-001`, mock repositories, direct legacy Analytics fetches, and rich-text preview occurrences exist only in dormant Phase 5C source. Their routes are replaced by the pending page and their chunks are absent from the production build. `x-academy-id` remains only as a centralized client capability and in dormant future-domain code; context resolution itself never invents or sends it. Token occurrences are confined to typed contracts, the credential coordinator, refresh logic, and tests.

## 17. Exact next implementation phase

Phase 5C — typed, domain-by-domain frontend integration using the Phase 5B API/auth/tenant/React Query foundation. Start with read-only Academy Students/Courses and Super Admin Students/Academies, then integrate mutations with RBAC/tenant/false-success tests before enabling each currently gated route. Finish with live staging E2E verification; do not redesign the UI or weaken backend contracts.

## Final verdict

P0 FOUNDATION COMPLETE
