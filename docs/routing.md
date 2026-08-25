# Routing

The typed route registry is `src/config/routes.ts`. The router is `src/app/router/AppRouter.tsx`.

## Public and authentication routes

| Path | Experience | Access |
| --- | --- | --- |
| `/`, `/home` | Marketing home | Public |
| `/about` | Marketing page positioned at About | Public |
| `/contact` | Marketing page positioned at Contact | Public |
| `/login` | Sign in | Signed-out visitors |
| `/register` | Create account | Signed-out visitors |
| `/forgot-password` | Password reset | Signed-out visitors |

## Store routes

| Path | Access |
| --- | --- |
| `/store` | Public |
| `/store/category/:categorySlug` | Public |
| `/store/product/:productSlug` | Public |
| `/store/cart` | Authenticated user |
| `/store/checkout` | Authenticated user |
| `/store/checkout/success/:orderId` | Authenticated user |
| `/store/purchases` | Authenticated user |
| `/store/profile` | Authenticated user |

## Admin routes

| Path | Module | Permission |
| --- | --- | --- |
| `/admin` | Redirect to Overview | `overview:read` |
| `/admin/overview` | Overview | `overview:read` |
| `/admin/students` | Students | `students:read` |
| `/admin/students/:studentId` | Student Details | `students:read` |
| `/admin/orders` | Orders | `orders:read` |
| `/admin/content` | Content library | Super Admin |
| `/admin/packages` | Package catalogue and Content Library picker | Super Admin |
| `/admin/coupons` | Future placeholder | Super Admin |
| `/admin/questions` | Question Bank, authoring, spreadsheet import, taxonomy, and trash | Super Admin |
| `/admin/broadcast` | Broadcast communications and scheduling | Super Admin |
| `/admin/account` | Future placeholder | Super Admin |
| `/admin/settings` | Future placeholder | Super Admin |

Anonymous admin access redirects to `/login` and preserves the complete requested path. Authenticated non-admin users are redirected to `/`. Authorized Super Admins are kept inside the isolated console when they manually request a public or Store route.

`public/_redirects` provides the Cloudflare SPA fallback. `/admin` and `/admin/*` receive no-store and noindex headers from `public/_headers`.
