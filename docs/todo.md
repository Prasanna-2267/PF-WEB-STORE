# Todo

## Before the next production deployment

- Visually compare light and dark modes at desktop, tablet, and mobile widths.
- Test keyboard navigation, focus visibility, form validation, modals, and the mobile menu.
- Test reduced-motion behavior.
- Confirm `/`, `/home`, `/contact`, `/login`, `/register`, and `/forgot-password` through the exact Cloudflare route rewrites.
- Confirm a nonexistent `/assets/*.js` request returns 404 rather than `index.html`, and confirm entry HTML includes `no-store` and `no-transform`.
- Confirm the custom-domain HTML is no longer modified by the automatic Cloudflare Web Analytics injection.
- Run `npm run build`.
- Repeat the full visual matrix in real Chrome, Edge, Firefox, Safari, Android Chrome, and Mobile Safari when browser/device access is available.
- Monitor React Router releases for a version newer than 7.18.1 that resolves the RSC-mode advisory without reintroducing older client-side advisories.

## Static QA findings awaiting an approved UI/behavior fix

- Login and registration submit buttons are wrapped in `.pf-auth-btn-wrap`, while their intended styling targets only a direct form child.
- The auth header can clip at narrow phone widths because the brand, Back to Home link, and theme control remain on one row.
- The initial hard-coded dark HTML class can cause a light-theme first-paint flash and mismatched native control color schemes.
- On `/home`, leaving the contact section can leave the document title as `Contact | Parallax Flow`.
- Coming-soon tooltips are hover-first, and modals do not yet include full dialog focus/Escape behavior.

## Product integrations requiring approval

- Replace mock authentication with a production identity service.
- Connect password reset to an email workflow.
- Connect the contact form to a protected delivery endpoint.
- Decide the post-login destination and authorized experience.
- Define destinations for the visible “Coming soon” navigation labels.

## Not a maintenance task

Do not introduce new sections, routes, providers, animation libraries, or deployment targets as part of routine cleanup.
