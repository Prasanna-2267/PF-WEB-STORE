# Active component inventory

## Application shell

- `App` — theme, scrolling, and router composition
- `AppRouter` — registered production routes
- `PublicLayout` — SEO and public content wrapper
- `AuthLayout` — auth header, editorial panel, theme control, and footer
- `PublicOnlyRoute` — redirects authenticated visitors away from auth screens

## Landing page

`HomePage` owns the current production composition:

- Logo introduction
- Navbar and mobile menu
- Theme toggle
- Hero copy and action
- Android product preview
- Floating learning cards
- Contact form
- Contact success modal
- Android “Coming Soon” modal
- Footer

The local `SimpleHeroPhone`, `HeroShowcase`, and `AndroidIcon` components exist only to organize that page.

## Authentication

- `LoginPage`
- `RegisterPage`
- `ForgotPasswordPage`

They use native React forms and the local `authService`; no generic form-component library is mounted.

## State and providers

- `ThemeProvider`
- `LenisProvider`
- `useThemeStore`
- `useAuthStore`

## SEO

- `SeoHead`
- `generateOrganizationJsonLd`

There is no separate generic UI-kit directory in the current production source. Shared visual behavior is intentionally expressed through the focused CSS files.
