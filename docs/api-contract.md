# Integration contract

There is no production backend API connected to this website yet.

## Authentication

`src/services/auth.service.ts` is a deterministic UI mock:

- `login` waits locally, creates a temporary token/user, and persists it through Zustand.
- `register` waits locally, creates a temporary account object, and signs the visitor in.
- `requestPasswordReset` waits locally and reports success.
- No credentials or reset request are transmitted to a server.

`error@parallaxflow.com` is the mock login error case.

## Contact

The contact form uses browser validation, resets the form, and opens a local success modal. It does not send email or make a network request.

## Future backend requirements

Before connecting a real service, define:

- Base URL and environments
- Authentication/session model
- CSRF and token-storage policy
- Login, registration, logout, and reset schemas
- Contact submission schema and abuse controls
- Error and rate-limit response formats
- Privacy, consent, retention, and observability requirements

Do not treat the current local auth store as an authorization boundary.
