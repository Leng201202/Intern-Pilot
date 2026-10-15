# InternPilot AI

InternPilot AI is a private, single-user internship application tracker. The MVP includes protected manual application management, read-only Gmail synchronization, privacy-screened Gemini classification behind explicit release gates, manual review, reminders, retention, and deployment runbooks. Automated sanitization is best-effort and cannot guarantee complete privacy, so Gemini is disabled by default.

## Implemented stack

- React 19, Vite, and strict TypeScript
- Tailwind CSS v4 and shadcn/ui-compatible components
- React Router with lazy-loaded protected routes
- TanStack Query for authenticated Supabase server state
- Supabase JavaScript client and Supabase CLI configuration
- Supabase PostgreSQL migrations, explicit grants, RLS, and pgTAP tests
- Supabase Edge Functions for Gmail OAuth, safe sync, review actions, and maintenance
- Local filtering/matching, conservative sanitization, and strict Gemini response validation
- ESLint, Prettier, Vitest, and Testing Library
- GitHub Actions validation
- Cloudflare Pages SPA redirects and cache headers

## Prerequisites

- Node.js 22 or newer (see `.nvmrc`)
- npm 10 or newer
- Docker Desktop or another Docker-compatible runtime for the local Supabase stack

## Local setup

1. Install the pinned dependencies:

   ```bash
   npm ci
   ```

2. Create a local frontend environment file:

   ```bash
   cp frontend/.env.example frontend/.env.local
   ```

3. Start local Supabase:

   ```bash
   npm run supabase:start
   npm run supabase:status
   ```

4. Rebuild the local database from the committed migration and run its security tests:

   ```bash
   npm run supabase:reset
   npm run test:db
   ```

5. Copy the local API URL and publishable key reported by Supabase into `frontend/.env.local`.

6. Start the frontend:

   ```bash
   npm run dev
   ```

   Vite prints the local URL, normally `http://localhost:5173`.

7. For local Edge Function work, copy the placeholder template to an ignored file, replace only local/test values, and serve the functions:

   ```bash
   cp supabase/functions/.env.example supabase/functions/.env.local
   npx supabase functions serve --env-file supabase/functions/.env.local
   ```

   Keep both AI gates `false` for normal local development. Automated tests use synthetic fixtures and do not call Gmail or Gemini.

The frontend can run without Supabase credentials, but it fails closed to a setup screen and does not expose protected routes or make database requests.

## Environment separation and secrets

- `frontend/.env.local` is for local browser configuration and is ignored by Git.
- `frontend/.env.production.example` documents the public values configured in Cloudflare Pages.
- Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` are permitted in the browser bundle.
- Supabase service-role keys, database passwords, Gmail tokens, Gemini keys, OAuth client secrets, encryption keys, and scheduler credentials must never use the `VITE_` prefix or appear in frontend files.
- Hosted backend secrets are configured through Supabase secret management; see [`docs/deployment.md`](docs/deployment.md).

The publishable key is not a substitute for authorization. The database requires explicit grants, RLS ownership, and the server-managed owner claim for browser access. The service-role key must never appear in the frontend.

## Owner account provisioning

InternPilot uses two checks on every browser-accessible row: the JWT subject must own the row, and `app_metadata.internpilot_owner` must equal `true`. This claim is server-managed; `user_metadata` is intentionally ignored because a user can edit it.

For each hosted environment:

1. Provision exactly one owner through a trusted Supabase Dashboard or Admin API workflow.
2. Set that user's app metadata to `{ "internpilot_owner": true }` from the trusted admin boundary.
3. Keep public sign-up disabled. The local configuration does so by default.
4. Revoke existing sessions or sign out and back in after changing app metadata so a fresh JWT carries the current claim.
5. Configure Google Auth credentials only in Supabase secret/configuration management. Enable the provider only in the environment being tested; committed local configuration keeps it disabled so missing secrets cannot accidentally start an OAuth flow.

Never place an admin/service-role key in a browser, documentation example containing a real value, or a committed environment file. An authenticated account without the owner claim can sign in only if the hosted Auth configuration permits it, but all application-data policies deny that account.

### Testing the authenticated frontend

The setup screen and protected-route redirect work without credentials. To exercise the complete CRUD UI:

1. Configure the Google provider in the selected local or hosted Supabase environment, with `http://127.0.0.1:5173` and/or `http://localhost:5173` in the allowed redirect URLs.
2. Pre-provision the single permitted account and set `app_metadata.internpilot_owner` to `true` through a trusted Dashboard or Admin API workflow.
3. Put only that environment's public URL and publishable key in `frontend/.env.local`.
4. Start the frontend, choose **Continue with Google**, and sign in as the provisioned owner.

This OAuth flow is application authentication only. It does not request Gmail scopes. Gmail authorization is a separate backend-controlled flow started from Settings.

## Development commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite development server |
| `npm run lint` | Run ESLint with zero warnings allowed |
| `npm run typecheck` | Run strict TypeScript project checks |
| `npm run test` | Run frontend and Edge/shared-module Vitest suites |
| `npm run test:frontend` | Run frontend Vitest tests |
| `npm run test:functions` | Run filtering, privacy, response-validation, and crypto tests |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run format` | Format frontend and Edge Function TypeScript with Prettier |
| `npm run format:check` | Verify formatting without changing files |
| `npm run build` | Type-check and create the production bundle |
| `npm run preview` | Preview the production bundle locally |
| `npm run supabase:start` | Start the local Supabase stack |
| `npm run supabase:reset` | Recreate the local database from committed migrations and the synthetic-only seed file |
| `npm run supabase:status` | Show local endpoints and development keys |
| `npm run supabase:stop` | Stop the local Supabase stack |
| `npm run test:db` | Run the pgTAP ownership, privilege, and lifecycle tests |
| `npm run validate` | Run formatting, linting, type checking, all Vitest suites, and production build |

## Project structure

```text
frontend/
  public/                  Cloudflare Pages SPA and cache rules
  src/
    app/                   Router and application entry point
    components/layout/     Responsive dashboard shell
    components/ui/         shadcn/ui-compatible primitives
    features/              Auth, tracker, dashboard, review, activity, archive, and settings
    lib/supabase/          Typed browser-safe Supabase client
    test/                  Shared Vitest setup
supabase/
  functions/               Gmail OAuth/sync, privacy/AI pipeline, review, and cleanup
  migrations/              Versioned schema, RLS, trusted operations, cron, and retention
  tests/                   pgTAP RLS, lifecycle, trusted workflow, and retention tests
  schedules.example.sql    Hosted daily Gmail-sync schedule template
  seed.sql                 Intentionally empty of personal data
  config.toml              Local Supabase configuration
docs/                      Approved product and architecture documents
```

## Validation

Run the same checks used by CI:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run supabase:start
npm run supabase:reset
npm run test:db
npx supabase db lint --local --level error --fail-on error
```

The last three commands require Docker Desktop or another running Docker-compatible daemon. Database tests use synthetic records in rolled-back transactions and never connect to Gmail or Gemini.

For a production smoke test, run `npm run preview` after the build and verify `/` plus a nested route such as `/applications`. Cloudflare Pages uses `frontend/public/_redirects` so direct navigation to client-side routes resolves to `index.html`.

## Cloudflare Pages

Use these project settings for Cloudflare Pages:

- Root directory: repository root
- Build command: `npm run build`
- Build output directory: `frontend/dist`
- Node.js version: `22`

Do not configure Gmail, Gemini, service-role, or other backend secrets in Cloudflare Pages frontend variables.

## Privacy and release status

Raw email bodies, full threads, attachments, tokens, and sanitized excerpts are never persisted. Unrelated messages are filtered locally; ambiguous matches and uncertain/sensitive content go to metadata-only manual review. Gemini receives only an allowlisted, minimized sanitized excerpt after all gates pass, and its output cannot directly select database IDs or bypass trusted transition rules.

Real Gmail-to-Gemini processing is not enabled merely by deploying the code. Review [`docs/provider-review.md`](docs/provider-review.md), complete [`docs/testing-plan.md`](docs/testing-plan.md), follow [`docs/deployment.md`](docs/deployment.md), and explicitly accept the remaining privacy risk. If zero external disclosure is required, leave Gemini disabled and use manual review.
