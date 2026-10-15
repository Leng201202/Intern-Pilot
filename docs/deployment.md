# InternPilot AI — Deployment and Operations

**Last reviewed:** 15 October 2026
**Audience:** the single authorized owner/operator

This runbook deploys the React SPA to Cloudflare Pages and the database, Auth, Edge Functions, and schedules to Supabase. Production rollout is deliberately fail-closed: Gmail may be connected after OAuth review, but real Gmail-to-Gemini processing must remain disabled until the provider-policy and residual-risk release gates below are satisfied.

## 1. Release prerequisites

- All commands in `docs/testing-plan.md` pass from a clean checkout.
- Google OAuth is configured for one intended test/owner account. Gmail `gmail.readonly` is a restricted scope; complete any consent-screen, verification, and security-assessment obligations that apply.
- A paid Gemini API project and the intended model have been reviewed against the current Gemini terms and Google Workspace API user-data rules. Do not use unpaid Gemini services with personal recruitment data.
- The owner has read the residual-risk warning: automated sanitization cannot guarantee complete privacy.
- Public Supabase sign-up is disabled and the one owner has server-managed app metadata `{ "internpilot_owner": true }`.

The code does not treat these checks as optional configuration. `AI_EMAIL_ANALYSIS_ENABLED`, `AI_REAL_EMAIL_RISK_ACCEPTED`, and the owner's database acknowledgement must all be present before any Gemini request.

## 2. Supabase database and Auth

1. Create separate Supabase projects for staging and production.
2. Link the CLI to the intended project and review the target before every push:

   ```bash
   npx supabase link --project-ref <project-ref>
   npx supabase migration list --linked
   npx supabase db push --dry-run
   npx supabase db push
   ```

3. Keep public and anonymous sign-up disabled. Configure the normal Supabase Google provider only for application sign-in; this is separate from Gmail authorization.
4. Provision exactly one owner through the Dashboard or Admin API and set `app_metadata.internpilot_owner` to `true`. Sign out and back in so the JWT contains the claim.
5. Add the exact Cloudflare production URL and approved local/staging URLs to the Supabase Auth redirect allowlist. Do not use wildcard production redirects.

Migrations create RLS, column grants, status-history triggers, backend-only OAuth state and sync-lease tables, trusted RPCs, daily reminder generation, and monthly retention cleanup. The browser never receives `service_role` credentials or encrypted Gmail tokens.

## 3. Google Gmail OAuth

Create a dedicated Google OAuth web client for the Gmail integration and configure:

- Scope: `openid email https://www.googleapis.com/auth/gmail.readonly` only.
- Authorized redirect URI: `https://<project-ref>.supabase.co/functions/v1/gmail-oauth-callback`.
- Test users/audience: only the intended owner while the app remains in testing.
- Privacy policy and consent-screen disclosures appropriate for restricted Gmail data.

The callback uses a short-lived hashed `state`, encrypted PKCE verifier, exact stored redirect URI, one-time consumption, and encrypted refresh-token storage. Initial connection records the current Gmail history checkpoint, so earlier messages are not processed. Disconnect attempts provider revocation and always deletes the local connection and token ciphertext.

## 4. Edge Function secrets and deployment

Generate secrets locally without committing their values. The token key must decode to exactly 32 random bytes; scheduler secret should have at least 32 random bytes.

```bash
npx supabase secrets set --env-file <ignored-production-secrets-file>
npx supabase functions deploy gmail-oauth-start
npx supabase functions deploy gmail-oauth-callback
npx supabase functions deploy gmail-connection
npx supabase functions deploy sync-emails
npx supabase functions deploy review-action
npx supabase functions deploy cleanup-data
```

The ignored secrets file must define the names in `supabase/functions/.env.example` plus hosted Supabase runtime secrets. Use exact production URLs. Never put Gmail, Gemini, encryption, scheduler, or service-role secrets in Cloudflare Pages.

Safe first deployment values are:

```dotenv
GMAIL_INITIAL_SYNC_MODE=new_only
GMAIL_MAX_MESSAGES_PER_SYNC=50
AI_EMAIL_ANALYSIS_ENABLED=false
AI_REAL_EMAIL_RISK_ACCEPTED=false
```

Changing frontend variables cannot enable AI or bypass a privacy block.

## 5. Scheduled jobs

The migration schedules database-local follow-up generation daily at 01:15 UTC and retention cleanup at 01:30 UTC on the first day of each month. For the shared Gmail sync:

1. Add hosted Vault secrets named `project_url`, `publishable_key`, and `scheduler_secret`.
2. Review and run `supabase/schedules.example.sql` once in the hosted SQL editor.
3. Confirm `cron.job` contains exactly one `internpilot-gmail-sync-daily` job at `0 1 * * *` (08:00 Asia/Bangkok).
4. Invoke **Sync emails now** once and compare its metadata-only `sync_runs` result with the first scheduled run.

Manual sync validates the owner JWT. Scheduled sync uses a distinct constant-time scheduler-secret check. Both call the same processing engine and acquire the same expiring mailbox lease.

## 6. Cloudflare Pages

Configure:

- Root directory: repository root
- Build command: `npm ci && npm run build`
- Output directory: `frontend/dist`
- Node version: 22
- Variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` only

`frontend/public/_redirects` supplies SPA route fallback. After deployment, load `/`, `/applications`, and `/settings` directly and confirm the protected-route behavior.

## 7. Release smoke test

1. Sign in as the owner and create a synthetic application.
2. Verify another/non-owner account cannot access rows.
3. Connect a dedicated synthetic Gmail test inbox; verify the connection starts at the current checkpoint and no earlier messages appear.
4. With AI disabled, deliver synthetic job alert, recruiter, interview, sensitive-data, and ambiguous-role messages. Verify filtering/review behavior and confirm zero Gemini requests.
5. Verify disconnect deletes the local connection and scheduled sync reports no connection.
6. Only after the provider review and owner acknowledgement, enable both server-side AI gates in staging and repeat with synthetic messages. Inspect database metadata and platform logs for absence of email text and secrets.
7. Limited real-email testing requires explicit owner authorization. Never use a real mailbox in CI.

## 8. Monitoring and recovery

- Use `sync_runs` counters and bounded error codes, never message text, to monitor failures.
- `reauthorization_required` means the refresh token was revoked/expired; reconnect Gmail. The worker will not repeatedly use the invalid credential.
- A `partial` run preserves its history/recovery cursor. Re-run safely; unique Gmail message IDs and validated event state prevent duplicate application changes.
- If Supabase resumes after a free-tier pause, run one manual sync before relying on the next schedule.
- For a suspected leak, disable both AI and sync server-side, revoke Gmail, rotate relevant keys/secrets, inspect metadata-only logs, and document remediation before re-enabling.
- Restore databases only into an access-controlled environment. Reapply secret values separately; secrets are not part of repository backups.

## 9. Rollback

Frontend releases can be rolled back through Cloudflare Pages deployment history. Edge Functions can be redeployed from a known commit. Database migrations are forward-only in production: take a database backup, prepare a reviewed corrective migration, and test it locally instead of editing migration history or running destructive reset commands.

Disabling `AI_EMAIL_ANALYSIS_ENABLED` immediately stops new Gemini calls without removing manual tracking or Gmail-local filtering. Disconnect Gmail to stop all mailbox access.

## 10. Known limitations and current release gate

- Regex/contextual sanitization is conservative but cannot guarantee anonymization.
- Gmail read-only scope can expose the mailbox to the trusted backend even though unrelated messages are filtered before AI.
- Sender spoofing and ambiguous recruitment wording can force manual review.
- The app has in-product metadata and Gmail deep links, not stored message previews.
- Historical Gmail import and automatic application creation are intentionally absent.
- Production deployment and real-provider smoke tests require operator-owned accounts, billing, credentials, and explicit authorization; they cannot be completed from source code alone.

Current provider references:

- [Gmail API scopes](https://developers.google.com/workspace/gmail/api/auth/scopes)
- [Google OAuth best practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices)
- [Supabase scheduled Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)
- [Supabase Edge Function authorization](https://supabase.com/docs/guides/functions/auth-headers)
- [Gemini API terms](https://ai.google.dev/gemini-api/terms)
- [Gemini zero data retention](https://ai.google.dev/gemini-api/docs/zdr)

See `docs/provider-review.md` for the dated policy review and unresolved production decision.
