# Production maintenance plan

The live Parallax Flow experience is complete for its current scope. Maintenance work must preserve the rendered design and these capabilities:

- Landing-page introduction, navigation, hero, contact section, and footer
- Login, registration, and forgot-password flows
- Theme persistence and theme toggle
- Responsive behavior
- SEO metadata and structured data
- Cloudflare Pages routing and headers

## Change protocol

1. Make a recoverable snapshot before structural cleanup.
2. Confirm a file is outside the active import and route graph before deleting it.
3. Do not replace the live hero, auth, contact, navigation, or footer markup during maintenance.
4. Run `npm run build` after each structural pass.
5. Verify `/`, `/home`, `/contact`, `/login`, `/register`, and `/forgot-password`.
6. Check light, dark, desktop, tablet, mobile, keyboard, and reduced-motion behavior before deployment.

## Next product work

Backend authentication, contact delivery, and future navigation destinations require separate product approval and API contracts. They are not part of maintenance cleanup.
