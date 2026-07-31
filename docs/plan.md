# Production plan

## Maintained release

The current release is a landing page plus authentication shell. Its visual composition and behavior are considered production assets.

## Maintenance priorities

1. Preserve the landing page, contact section, footer, auth screens, themes, responsive design, SEO, and Cloudflare configuration.
2. Keep the source graph limited to code reachable from current routes.
3. Keep CSS separated by visible responsibility.
4. Run TypeScript and the Vite production build for every change.
5. Validate all six registered paths before deployment.

## Feature expansion

Any new authenticated destination, purchasing capability, guide content, real authentication, or form delivery is a separate feature project. Add those only with approved requirements, routes, API contracts, and access rules.
