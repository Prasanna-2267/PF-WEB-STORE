# Web deployment handoff

This repository contains the marketing website, Store, Super Admin Console, and Academy Admin Console. It is a static Vite application and has no embedded backend.

## Required production configuration

Set these build-time values in the hosting platform:

```text
VITE_API_BASE_URL=https://api.example.com
VITE_GOOGLE_CLIENT_ID=<production Google OAuth client ID>
```

`VITE_API_BASE_URL` is the API origin without a trailing `/api`; the client adds `/api/...` to requests. All production origins must use HTTPS. Vite variables are public and must never contain secrets.

The backend must include the exact deployed web origin in `CORS_ALLOWED_ORIGINS`. The Google OAuth client must authorize the exact production origin and redirect configuration.

## Build and deploy

From a clean checkout of the approved release commit:

```powershell
npm ci
npm test
npm run build
```

Deploy the generated `dist` directory. For Cloudflare Pages, use `npm run build` and output directory `dist`. Keep `public/_redirects` so direct navigation to Store/Admin/Academy routes falls back to the SPA.

Deploy only after the API migrations, API service, and durable worker are healthy. Purge the entry-document cache after promotion if the hosting platform does not do this automatically.

## Browser smoke checks

Verify in a clean browser session:

- marketing, contact, Store catalog, exact product links, cart, checkout, receipts, and previous orders;
- sign-up/email OTP, login, token refresh after the access-token lifetime, logout, and password reset;
- Super Admin and Academy Admin tenant/RBAC boundaries;
- content upload/preview, Questions, admissions, grant/revoke access, device approval, refunds, broadcasts, and notifications;
- direct navigation and refresh for representative public, Store, `/admin/*`, and `/academy/*` routes;
- mobile, tablet, and desktop layouts.

## Rollback

Roll back by promoting the previous immutable static artifact. Keep the backend/database at the forward-compatible version unless a separately reviewed database rollback exists.
