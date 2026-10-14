# InternPilot AI

InternPilot AI is a private, single-user internship application tracker. The Phase 0 implementation provides the React application shell and local development foundation; application data, authentication, Gmail, Gemini, and scheduled jobs belong to later phases.

## Phase 0 stack

- React 19, Vite, and strict TypeScript
- Tailwind CSS v4 and shadcn/ui-compatible components
- React Router with lazy-loaded placeholder routes
- Supabase JavaScript client and Supabase CLI configuration
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

4. Copy the local API URL and publishable key reported by Supabase into `frontend/.env.local`.

5. Start the frontend:

   ```bash
   npm run dev
   ```

   Vite prints the local URL, normally `http://localhost:5173`.

The dashboard can also run without Supabase credentials during Phase 0. It shows a **Local setup** badge and does not make database requests.

## Environment separation and secrets

- `frontend/.env.local` is for local browser configuration and is ignored by Git.
- `frontend/.env.production.example` documents the public values configured in Cloudflare Pages.
- Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` are permitted in the browser bundle.
- Supabase service-role keys, database passwords, Gmail tokens, Gemini keys, OAuth client secrets, encryption keys, and scheduler credentials must never use the `VITE_` prefix or appear in frontend files.
- Hosted backend secrets will be configured through Supabase secret management in later phases.

The publishable key is not a substitute for authorization. Phase 1 must implement and test Row Level Security, explicit Data API grants, and protected database operations before user data is added.

## Development commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite development server |
| `npm run lint` | Run ESLint with zero warnings allowed |
| `npm run typecheck` | Run strict TypeScript project checks |
| `npm run test` | Run Vitest once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run format` | Format frontend source with Prettier |
| `npm run format:check` | Verify formatting without changing files |
| `npm run build` | Type-check and create the production bundle |
| `npm run preview` | Preview the production bundle locally |
| `npm run supabase:start` | Start the local Supabase stack |
| `npm run supabase:status` | Show local endpoints and development keys |
| `npm run supabase:stop` | Stop the local Supabase stack |

## Project structure

```text
frontend/
  public/                  Cloudflare Pages SPA and cache rules
  src/
    app/                   Router and application entry point
    components/layout/     Responsive dashboard shell
    components/ui/         shadcn/ui-compatible primitives
    features/              Lazy-loaded feature placeholders
    lib/supabase/          Browser-safe Supabase client
    test/                  Shared Vitest setup
supabase/
  functions/               Edge Functions (empty in Phase 0)
  migrations/              Database migrations (empty in Phase 0)
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
```

For a production smoke test, run `npm run preview` after the build and verify `/` plus a nested route such as `/applications`. Cloudflare Pages uses `frontend/public/_redirects` so direct navigation to client-side routes resolves to `index.html`.

## Cloudflare Pages

Use these project settings when deployment is introduced in Phase 6:

- Root directory: repository root
- Build command: `npm run build`
- Build output directory: `frontend/dist`
- Node.js version: `22`

Do not configure Gmail, Gemini, service-role, or other backend secrets in Cloudflare Pages frontend variables.

## Current scope

Phase 0 intentionally does not implement authentication, database tables, RLS policies, application CRUD, Gmail access, AI processing, synchronization, follow-ups, retention jobs, or deployment. The next milestone is **Phase 1 — Database, Authentication, and Security Foundation** in [`docs/development-plan.md`](docs/development-plan.md).
