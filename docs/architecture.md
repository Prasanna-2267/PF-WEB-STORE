# Architecture

## Runtime composition

```text
main.tsx
└─ App
   └─ ThemeProvider
      └─ LenisProvider
         └─ AppRouter
            ├─ PublicLayout
            │  └─ HomePage
            └─ PublicOnlyRoute
               └─ AuthLayout
                  ├─ LoginPage
                  ├─ RegisterPage
                  └─ ForgotPasswordPage
```

`App` keeps the same neutral layout wrappers previously used by production, but it does not create a canvas or background render loop.

## State

`useThemeStore` persists `light` or `dark` under `pf_theme_mode` and mirrors the mode to the root HTML class.

`useAuthStore` persists the local user/token state under `pf_auth_token`. It is a UI session store, not a server-validated security boundary.

## Presentation

The active CSS is intentionally separated by responsibility:

- `theme.css`
- `navbar.css`
- `hero.css`
- `contact.css`
- `footer.css`
- `login.css`
- `src/styles/index.css`

Responsive rules are co-located at the end of their owning stylesheets. This is intentional: a shared responsive stylesheet was imported before later desktop rules by Vite's module graph, causing desktop navbar/contact declarations to override active mobile breakpoints.

The landing-page navbar and footer live in `HomePage.tsx`. The auth layout contains its own matching header/footer composition.

## SEO

`index.html` supplies crawlable defaults. `SeoHead` updates the title, description, canonical URL, Open Graph, Twitter, and JSON-LD values for the landing page, contact route, login, registration, and forgot-password screens.

## Deployment

Vite 6 builds static assets to `dist`. Cloudflare Pages rewrites only registered routes through `public/_redirects`, serves unknown direct requests through `public/404.html`, and applies the rules in `public/_headers`. Entry HTML is no-store and no-transform; hashed assets remain immutable. There is no Vercel deployment configuration.
