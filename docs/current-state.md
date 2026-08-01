# Current production state

Last verified: 2026-07-28.

## Live experience

The website contains one landing-page experience and one authentication experience.

The landing page includes:

- Timed Parallax Flow wordmark introduction
- Fixed responsive navigation
- Light/dark theme control
- Product-led hero with a CSS-rendered Android interface and floating learning panels
- About Parallax Flow chapter with a pinned introduction, one large five-stage glass story card, and stage-specific editorial imagery
- Contact form and local success modal
- “Coming soon” modal for the Android application call to action
- Production footer and external contact links

The authentication experience includes:

- Login
- Create account
- Forgot password
- Route-specific metadata for every authentication route
- Shared auth header, theme toggle, editorial side panel, and footer

## Current functional boundaries

- Home, About us, and Connect with us are active same-page destinations.
- PALM and Store are visible future labels and intentionally have no route.
- Login and registration persist a mock session through Zustand.
- An authenticated visitor returns to the landing page; no separate signed-in screen exists.
- The contact form does not call an API.
- Android download actions open a local “Coming Soon” modal.

## Active source

```text
src/
  app/
    router/AppRouter.tsx
    store/useAuthStore.ts
    store/useThemeStore.ts
  components/guards/PublicOnlyRoute.tsx
  config/
    constants.ts
    routes.ts
    theme.ts
  features/
    auth/
    home/
  layouts/
    AuthLayout.tsx
    PublicLayout.tsx
  providers/
    LenisProvider.tsx
    ThemeProvider.tsx
  seo/
    SeoHead.tsx
    structuredData.ts
  services/auth.service.ts
  styles/index.css
```

No global WebGL canvas is mounted. The visible product composition is regular React markup styled with CSS.

Responsive navbar, contact, and footer breakpoints are co-located with their base rules so production bundling cannot reverse the intended mobile cascade. The mobile menu retains access to Enter the Flow or Sign Out.

## Production safeguards

Do not remove Lenis without accepting a scrolling-behavior change. Do not remove either SEO layer without checking route-specific titles and canonical URLs. Do not hand-edit `dist`; regenerate it with `npm run build`.

Cloudflare rewrites only registered application paths. A real `404.html` prevents missing hashed assets from being rewritten to the entry document. HTML routes are no-store/no-transform, and the entry document performs at most one cache-busted retry if a stale HTML page references a missing bundle.

React Router is upgraded to 7.18.1 and Vite to 6.4.3. The Vite/esbuild advisories reported before this pass are resolved.

The latest runtime audit still reports one React Router advisory as two high-severity package entries. It concerns React Server Components action handling. This application is a client-rendered declarative SPA and does not use React Server Components, server actions, SSR hydration, loaders, or actions, so the affected execution path is absent. No published React Router release currently resolves that advisory without reintroducing older client-side advisories; remain on 7.18.1 until a patched release is published.

JetBrains Mono and the Vercel deployment file are no longer part of the project. Inter remains the production web font, and Cloudflare Pages remains the deployment target.
