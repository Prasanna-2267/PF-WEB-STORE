# Routing

The route registry is `src/config/routes.ts`. The router is `src/app/router/AppRouter.tsx`.

| Path | Layout | Page | Access |
| --- | --- | --- | --- |
| `/` | PublicLayout | HomePage | Public |
| `/home` | PublicLayout | HomePage | Public |
| `/about` | PublicLayout | HomePage | Public |
| `/contact` | PublicLayout | HomePage | Public |
| `/login` | AuthLayout | LoginPage | Signed-out visitors |
| `/register` | AuthLayout | RegisterPage | Signed-out visitors |
| `/forgot-password` | AuthLayout | ForgotPasswordPage | Signed-out visitors |
| `*` | — | Redirect to `/` | Public |

`/contact` renders the landing page and scrolls to the contact section after the opening transition.
`/about` renders the landing page and scrolls to the about section with dedicated canonical SEO metadata (`/about`).

`PublicOnlyRoute` sends an already authenticated visitor to `/`. There are no protected content routes in the current release.

Cloudflare rewrites only the registered non-root routes to `index.html`:

- `/home`
- `/contact`
- `/login`
- `/register`
- `/forgot-password`

Both slash and non-slash variants are declared in `public/_redirects`. The root is served normally.

`public/404.html` intentionally disables Cloudflare Pages' implicit catch-all SPA fallback. This ensures a missing hashed asset returns 404 instead of receiving `index.html` with a JavaScript URL and immutable cache headers. React Router still redirects unknown paths reached after the application has booted.
