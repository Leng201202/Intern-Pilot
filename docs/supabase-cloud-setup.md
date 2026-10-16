# InternPilot AI — Supabase Cloud Setup

**Last reviewed:** 15 October 2026  
**Audience:** the single authorized owner/operator

This guide moves the existing local Supabase implementation to a hosted Supabase project. It does not enable real Gmail-to-Gemini processing. Complete the basic cloud deployment first, verify it with synthetic data, and keep both AI switches `false` until the provider and privacy release gates are satisfied.

## 1. Before you begin

You need:

- A Supabase account protected with MFA.
- A final frontend URL, for example `https://internpilot.pages.dev` or a custom HTTPS domain.
- Node.js 22+, npm, Git, and this repository on your computer.
- A Google Cloud account if you will use Google sign-in or Gmail.
- A password manager for database passwords, OAuth secrets, encryption keys, and scheduler secrets.

Use separate Supabase projects for staging and production. Perform these instructions on staging first, then repeat them with different secrets for production.

Record these non-secret values:

| Name                       | Example                                    |
| -------------------------- | ------------------------------------------ |
| Supabase project reference | `abcdefghijklmnopqrst`                     |
| Supabase URL               | `https://abcdefghijklmnopqrst.supabase.co` |
| Supabase publishable key   | `sb_publishable_...`                       |
| Frontend URL               | `https://internpilot.pages.dev`            |
| Owner Google email         | Your intended single account               |

Never place the database password, Supabase secret/service-role key, Google client secret, Gmail token-encryption key, scheduler secret, or Gemini API key in the frontend or repository.

## 2. Validate the repository locally

From the repository root:

```bash
npm ci
npm run validate
npm run supabase:start
npm run supabase:reset
npm run test:db
npm exec -- supabase db lint --local --level error --fail-on error
```

Expected result:

- 5 frontend tests pass.
- 32 Edge/shared-module tests pass.
- 83 database assertions pass.
- The frontend production build succeeds.
- Database lint reports no schema errors.

`supabase db reset --local` is for the local Docker database only. Never run a reset against the linked production project.

## 3. Create the hosted Supabase project

1. Open the [Supabase Dashboard](https://supabase.com/dashboard).
2. Create a new project in an organization you control.
3. Choose the region closest to the owner. The committed local configuration uses PostgreSQL 17, so select the compatible hosted version offered by Supabase.
4. Generate a strong database password and save it only in your password manager.
5. Wait until the project reports healthy.
6. In **Project Settings → API Keys**, copy:
   - The project URL.
   - The publishable key. A legacy `anon` key also works, but prefer the current publishable key.
7. Copy the project reference from the project URL or project settings.

Do not copy the secret key or legacy `service_role` key into a browser environment. Hosted Edge Functions receive their privileged server key from Supabase automatically.

## 4. Link the CLI to the cloud project

The repository pins the Supabase CLI. Run all commands from the repository root.

1. Create a project-scoped Supabase personal access token with only the permissions needed for this project, then authenticate the CLI:

   ```bash
   npm exec -- supabase login
   ```

   Do not commit the token or save it in a shell profile.

2. Link the repository to the staging project first:

   ```bash
   npm exec -- supabase link --project-ref <STAGING_PROJECT_REF>
   ```

   Enter the hosted database password when prompted. Do not place it directly in the command.

3. Verify the target before changing it:

   ```bash
   npm exec -- supabase migration list --linked
   ```

The link is local CLI state. Before every production database operation, recheck the project reference shown by the CLI and the project open in the Dashboard.

## 5. Apply the database migrations

1. Preview the migrations:

   ```bash
   npm exec -- supabase db push --linked --dry-run
   ```

2. Confirm the preview contains only the committed InternPilot migrations:

   - `20261014092720_phase_1_security_foundation.sql`
   - `20261015081426_phases_3_to_5_backend_foundation.sql`

3. Apply them:

   ```bash
   npm exec -- supabase db push --linked
   ```

   Do not add `--include-seed` in production. The seed file is for development only.

4. Confirm the remote migration state and lint the hosted schema:

   ```bash
   npm exec -- supabase migration list --linked
   npm exec -- supabase db lint --linked --level error --fail-on error
   npm exec -- supabase db advisors --linked --type security --level warn --fail-on warn
   ```

5. In the Dashboard SQL Editor, verify the two database-local jobs created by the migration:

   ```sql
   select jobname, schedule, active
   from cron.job
   where jobname like 'internpilot-%'
   order by jobname;
   ```

At this point you should see:

- `internpilot-follow-ups-daily` at `15 1 * * *`.
- `internpilot-retention-monthly` at `30 1 1 * *`.

The migrations install RLS, grants, protected-field triggers, status history, trusted RPCs, reminders, and retention. Do not recreate these objects manually in the Table Editor.

## 6. Configure frontend access to Supabase

Set only these two build variables in Cloudflare Pages or the frontend host:

```dotenv
VITE_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=<PUBLISHABLE_KEY>
```

Both values are intentionally public and are protected by database grants and RLS. Never create a `VITE_` variable containing a secret/service-role key, database password, Google secret, Gmail token, or Gemini key.

Build and deploy the frontend, then decide which exact HTTPS URL will be canonical. Use that same URL in the remaining steps. If the URL changes later, update Supabase Auth, Google OAuth, `FRONTEND_URL`, and any consent-screen links together.

## 7. Configure Supabase Auth for application sign-in

Application sign-in and Gmail authorization are two different OAuth flows. Configure application sign-in first with a Google OAuth client that requests only basic identity information.

### 7.1 Create the application-sign-in Google client

1. In Google Cloud, create or select a project.
2. Open Google Auth Platform and configure the app audience.
3. While staging, keep the publishing status **Testing** and add only the owner email as a test user.
4. Create an OAuth client of type **Web application** named, for example, `InternPilot Supabase Auth`.
5. Add the frontend origin as an authorized JavaScript origin:

   ```text
   https://<YOUR_FRONTEND_DOMAIN>
   ```

6. Add the Supabase Auth callback as an authorized redirect URI:

   ```text
   https://<PROJECT_REF>.supabase.co/auth/v1/callback
   ```

7. Save the client ID and client secret in your password manager.

Do not add the Gmail scope to this client. Gmail authorization is configured separately in section 9.

### 7.2 Configure the Google provider in Supabase

1. Open **Authentication → Sign In / Providers → Google** in the Supabase Dashboard.
2. Enable Google.
3. Enter the application-sign-in Google client ID and secret.
4. Leave anonymous sign-in disabled.
5. Disable email/password and other providers unless you deliberately need them for owner provisioning.
6. Open **Authentication → URL Configuration**.
7. Set **Site URL** to the exact production frontend origin, with no path:

   ```text
   https://<YOUR_FRONTEND_DOMAIN>
   ```

8. Add that same exact origin to the redirect allowlist. Do not use a wildcard for the production URL.

## Choose the setup path before continuing

Steps 8–11 have different purposes:

| Step | What it does                                      | Needed for the manual tracker? | Needed for Gmail? |
| ---- | ------------------------------------------------- | ------------------------------ | ----------------- |
| 8    | Creates and authorizes the one InternPilot owner  | Yes                            | Yes               |
| 9    | Creates separate Google credentials to read Gmail | No                             | Yes               |
| 10   | Stores private backend configuration in Supabase  | No                             | Yes               |
| 11   | Uploads the trusted backend functions             | No                             | Yes               |

For the simplest first launch, complete step 8 and then go directly to **Stage A — manual tracker only** in step 14. Complete steps 9–12 later when you are ready to test Gmail with a synthetic mailbox.

## 8. Provision exactly one owner

**Purpose:** signing in with Google proves who you are, but it does not automatically authorize you to read InternPilot data. This step creates the only allowed account and adds a server-controlled owner flag.

This step is required even if you do not use Gmail. InternPilot requires both the user's UUID and `app_metadata.internpilot_owner = true`. Do not put the flag in `user_metadata`; users can edit that field themselves.

1. In Google Cloud, keep the sign-in OAuth app from step 7 in **Testing** mode and make your intended Google account its only test user.
2. In the Supabase Dashboard, confirm Google is the only sign-in method enabled for this setup.
3. In **Authentication**, temporarily turn on **Allow new users to sign up**.
4. Open your deployed InternPilot frontend and select **Continue with Google**. Sign in with the intended owner account once.
5. Return immediately to Supabase **Authentication → Users** and turn **Allow new users to sign up** off again.
6. Confirm that the Users page contains only your intended account. Stop and investigate if an unexpected account exists.
7. Open your user record and set its **app metadata** (sometimes shown as **raw app metadata**) to include:

   ```json
   {
     "internpilot_owner": true
   }
   ```

   Use the Dashboard's app-metadata editor if it is available. Otherwise use Supabase's server-only Auth Admin API. Never place a service-role/secret key in the frontend, and never substitute `user_metadata` for this security claim.

8. Sign out of InternPilot completely, then sign in again. The new login issues a JWT containing the owner flag.
9. Confirm that the dashboard loads and lets you create a synthetic application.

You can verify the result without displaying tokens. Open **SQL Editor** in Supabase and run:

```sql
select
  id,
  email,
  raw_app_meta_data ->> 'internpilot_owner' as internpilot_owner
from auth.users;
```

There must be exactly one row, for your account, with `internpilot_owner = 'true'`. A signed-in user without that claim must see the owner-access error and must not see application rows.

## 9. Configure the separate Gmail OAuth client

**Purpose:** this gives only the Supabase backend permission to read Gmail. It is different from the Google client used to sign in to InternPilot.

Skip steps 9–12 if you only want the manual tracker. Do not connect a real mailbox while the Google verification and provider-review requirements remain unresolved.

The two Google clients have separate jobs:

- The step 7 client signs you into InternPilot and redirects through Supabase Auth.
- This step 9 client requests Gmail read-only access and redirects to the `gmail-oauth-callback` Edge Function.

The Gmail integration requests `https://www.googleapis.com/auth/gmail.readonly`, which Google classifies as restricted because it permits access to message content. Before a real production connection:

- Enable the Gmail API in the selected Google Cloud project.
- Publish an accurate home page, privacy policy, terms, data-deletion instructions, and Google Limited Use disclosure on a domain you control.
- Complete any Google brand verification, restricted-scope verification, and security assessment that applies.
- Ensure the disclosure immediately before Gmail connection accurately explains collection, use, sharing, retention, and deletion.
- Confirm that transferring a minimized sanitized excerpt to the selected paid Gemini service is permitted for this exact use. If it is not confirmed, keep Gemini disabled.

For a synthetic staging test:

1. Create a dedicated test Gmail account containing only synthetic messages. Do not use your personal mailbox.
2. In Google Cloud, open **APIs & Services → Library**, find **Gmail API**, and enable it.
3. Open the Google Auth Platform/OAuth consent configuration. Keep the app in **Testing** mode and add only the dedicated synthetic Gmail account as a test user.
4. Open **APIs & Services → Credentials → Create credentials → OAuth client ID**.
5. Choose **Web application** and name it `InternPilot Gmail Integration`.
6. Under **Authorized redirect URIs**, add exactly:

   ```text
   https://<PROJECT_REF>.supabase.co/functions/v1/gmail-oauth-callback
   ```

   Replace `<PROJECT_REF>` with the reference shown in your Supabase project URL. Do not add a trailing slash.

7. Create the client and save its **Client ID** and **Client secret** in your password manager. You will enter them in Supabase in step 10; do not put them in frontend environment variables.

Testing-mode Gmail refresh tokens for external Google apps normally expire after seven days. Testing mode is therefore suitable for staging, not a stable production Gmail connection.

## 10. Configure Edge Function secrets

**Purpose:** Edge Function secrets are private environment values stored by Supabase for backend code. They are not database rows, frontend variables, or values to commit to Git.

Complete this step only when you are continuing with Gmail. The safest method is the Supabase Dashboard:

1. Generate two different random values in Terminal and save both outputs in your password manager:

   ```bash
   openssl rand -base64 32
   openssl rand -hex 32
   ```

   Use the first value as `GMAIL_TOKEN_ENCRYPTION_KEY` and the second as `SCHEDULER_SECRET`. Never reuse one value for both purposes. Use different values in staging and production.

2. Open your Supabase project, then open **Edge Functions → Secrets**.
3. Add the following key/value pairs. Replace placeholders with your own values:

   | Secret                        | Value to enter                                                        |
   | ----------------------------- | --------------------------------------------------------------------- |
   | `FRONTEND_URL`                | Your exact frontend origin, such as `https://app.example.com`         |
   | `GMAIL_OAUTH_CLIENT_ID`       | Client ID created in step 9                                           |
   | `GMAIL_OAUTH_CLIENT_SECRET`   | Client secret created in step 9                                       |
   | `GMAIL_OAUTH_CALLBACK_URL`    | `https://<PROJECT_REF>.supabase.co/functions/v1/gmail-oauth-callback` |
   | `GMAIL_TOKEN_ENCRYPTION_KEY`  | Output of `openssl rand -base64 32`                                   |
   | `GMAIL_TOKEN_KEY_VERSION`     | `1`                                                                   |
   | `GMAIL_MAX_MESSAGES_PER_SYNC` | `50`                                                                  |
   | `GMAIL_INITIAL_SYNC_MODE`     | `new_only`                                                            |
   | `SCHEDULER_SECRET`            | Output of `openssl rand -hex 32`                                      |
   | `AI_EMAIL_ANALYSIS_ENABLED`   | `false`                                                               |
   | `AI_REAL_EMAIL_RISK_ACCEPTED` | `false`                                                               |
   | `AI_MAX_REQUESTS_PER_SYNC`    | `20`                                                                  |

4. Save the secrets. Keep both AI flags exactly `false`; this guarantees the first Gmail test cannot call Gemini.

Do not add `GEMINI_API_KEY` or `GEMINI_MODEL` during the initial deployment. They are unnecessary while AI is disabled.

Do not manually add names beginning with `SUPABASE_`; Supabase reserves and injects its hosted runtime values. Never expose any secret/service-role value to Cloudflare Pages.

CLI alternative: copy `supabase/functions/.env.example` to `supabase/functions/.env.cloud`, replace every placeholder, remove the unused Gemini entries, and upload it with:

```bash
npm exec -- supabase secrets set --env-file supabase/functions/.env.cloud --project-ref <PROJECT_REF>
npm exec -- supabase secrets list --project-ref <PROJECT_REF>
```

The repository's `.gitignore` ignores this file. Confirm before committing with:

```bash
git check-ignore -v supabase/functions/.env.cloud
```

Do not commit that file or paste its contents into an issue, chat, build log, or screenshot. The `secrets list` command shows names/digests, not values.

## 11. Deploy the Edge Functions

**Purpose:** this uploads the trusted backend TypeScript code from `supabase/functions/` to your hosted Supabase project. It does not deploy the React frontend.

1. Confirm Terminal is in the InternPilot repository and that the CLI is linked to the correct project:

   ```bash
   npm exec -- supabase projects list
   ```

   The linked project is marked in the command output. Stop if it is not the project you intend to use.

2. Deploy all committed functions:

   ```bash
   npm exec -- supabase functions deploy --project-ref <PROJECT_REF>
   ```

3. In Supabase **Edge Functions**, confirm these six names appear:

- `gmail-oauth-start`
- `gmail-oauth-callback`
- `gmail-connection`
- `sync-emails`
- `review-action`
- `cleanup-data`

The committed `supabase/config.toml` sets gateway JWT verification to `false` because the functions perform their own appropriate checks: current owner-claim validation, one-time OAuth state, or a constant-time scheduler-secret comparison. This setting does not authorize anonymous privileged operations. Do not remove the application-level checks.

4. Before signing in, test that an anonymous caller is rejected. Find the project's browser-safe publishable key in the Supabase **Connect** dialog or API Keys settings, then run:

   ```bash
   curl --include --request POST \
     'https://<PROJECT_REF>.supabase.co/functions/v1/sync-emails' \
     --header 'apikey: <PUBLISHABLE_KEY>' \
     --header 'Content-Type: application/json' \
     --data '{}'
   ```

   Replace both placeholders. The expected result is `401 Unauthorized` with a generic `request_rejected` response. This `401` is a successful security test. Do not test with a secret/service-role key.

After that check passes, continue to step 12 to configure the scheduled calls. The React frontend remains a separate Cloudflare Pages deployment.

## 12. Configure the daily Gmail schedule

The database migration already created the follow-up and retention jobs. The Gmail HTTP schedule needs three Vault secrets.

1. Open **Database → Vault** in the Supabase Dashboard.
2. Create these named secrets through the Vault UI so their values do not appear in SQL history:

   | Vault name         | Value                                                          |
   | ------------------ | -------------------------------------------------------------- |
   | `project_url`      | `https://<PROJECT_REF>.supabase.co`                            |
   | `publishable_key`  | The hosted publishable key                                     |
   | `scheduler_secret` | Exactly the same value as the Edge Function `SCHEDULER_SECRET` |

3. Open `supabase/schedules.example.sql`, review it, and run it once in the hosted SQL Editor.
4. Verify all three jobs:

   ```sql
   select jobname, schedule, active
   from cron.job
   where jobname like 'internpilot-%'
   order by jobname;
   ```

Expected schedules, all in UTC:

| Job                             | Schedule     | Thailand time  |
| ------------------------------- | ------------ | -------------- |
| `internpilot-gmail-sync-daily`  | `0 1 * * *`  | 08:00 daily    |
| `internpilot-follow-ups-daily`  | `15 1 * * *` | 08:15 daily    |
| `internpilot-retention-monthly` | `30 1 1 * *` | 08:30 on day 1 |

Use **Integrations → Cron → History** to inspect job outcomes. Never put email text or decrypted Vault values into diagnostics.

## 13. Harden the hosted project

Before adding real application data:

1. Resolve every warning/error in Supabase Security Advisor or explicitly document why it is safe.
2. Confirm RLS is enabled on every application table in `public`.
3. Confirm anonymous sign-in and public signup are disabled.
4. Confirm only the owner has `app_metadata.internpilot_owner = true`.
5. Enable database SSL enforcement.
6. Configure database network restrictions if you can preserve a tested administrative path for future migrations. These restrictions protect direct Postgres connections, not the HTTPS APIs used by the frontend.
7. Enable an appropriate backup/PITR plan for the data you cannot afford to lose.
8. Enable MFA on Supabase, Google Cloud, Cloudflare, and source-control accounts.
9. Review usage/billing alerts for Supabase, Google Cloud, Gmail, and Gemini.
10. Keep the database and Edge Function logs free of raw email content, excerpts, identifiers, tokens, and secrets.

## 14. Run the cloud smoke test in stages

### Stage A — manual tracker only

1. Sign in as the owner.
2. Create, edit, change status, archive, restore, and delete a synthetic application.
3. Confirm status history and notifications appear.
4. Confirm direct navigation to `/applications` and `/settings` works.
5. Confirm a non-owner or signed-out browser cannot read any application row.

### Stage B — Gmail with AI disabled

Only after the Gmail OAuth obligations are understood:

1. Use a dedicated synthetic Gmail account, never the real mailbox.
2. Connect Gmail from Settings.
3. Confirm the connection begins at the current Gmail history checkpoint; old messages must not import.
4. Send synthetic irrelevant, recruiter, ambiguous, and sensitive messages after connection.
5. Run **Sync emails now**.
6. Confirm irrelevant messages are filtered locally and sensitive/ambiguous candidates go to manual review.
7. Confirm no Gemini request occurs because both AI flags are `false` and no Gemini key is installed.
8. Disconnect Gmail and confirm future sync reports no connection.
9. Reconnect and verify the revoked/expired-token recovery path.

### Stage C — optional Gemini staging test

Do not perform this stage until `docs/provider-review.md` is resolved for the actual account, region, model, billing tier, and Google Workspace data policy.

1. In Google AI Studio, import or create a dedicated Cloud project and move it to the **Paid** tier. Confirm the project is shown as paid, configure a small spend cap, and do not use unpaid Gemini services with recruitment correspondence.
2. Create a new Gemini **authorization key** in that project. Do not reuse the Gmail OAuth client, its client secret, a browser key, or a legacy standard API key. Never paste this key into chat, source control, Cloudflare, or a `VITE_` variable.
3. Select a currently supported stable model and verify its retention/data-use terms. As reviewed on 16 October 2026, the recommended classification model is `gemini-3.8-flash`, which supports structured output; recheck before setup because model availability changes.
4. Deploy the current frontend so the complete transfer disclosure appears before consent.
5. In **Supabase Dashboard → Edge Functions → Secrets**, add `GEMINI_MODEL=gemini-3.8-flash` and `GEMINI_API_KEY=<the dedicated authorization key>`. Supabase applies secret changes without a function redeploy. Keep both AI flags `false` while checking this configuration.
6. Sign in to InternPilot, read the Settings transfer disclosure and residual-risk warning, then set the owner acknowledgement. The acknowledgement is affirmative, revocable consent for the disclosed sanitized-excerpt transfer; it does not bypass any privacy block.
7. Confirm the connected Gmail account contains synthetic test messages only. Then set `AI_REAL_EMAIL_RISK_ACCEPTED=true` in Supabase Edge Function secrets.
8. Set `AI_EMAIL_ANALYSIS_ENABLED=true` last. This is the immediate emergency-off switch, so be ready to return it to `false` if any check fails.
9. Send a new synthetic interview or assessment message that uniquely matches one synthetic application, run **Sync emails now**, and confirm a validated update/history/notification is created.
10. Send new synthetic irrelevant, ambiguous-role, sensitive-data, prompt-injection, and malformed-event cases. Confirm irrelevant mail causes no Gemini call and every unsafe or uncertain case goes to manual review without changing status.
11. Inspect only metadata rows, Supabase function logs, and browser responses for accidental email text, sanitized excerpts, identifiers, tokens, or keys. Any occurrence fails the stage: immediately set `AI_EMAIL_ANALYSIS_ENABLED=false`, remove the key if exposure is suspected, and investigate using metadata only.
12. Leave real personal-email testing disabled after this stage. It requires a separate explicit owner authorization; synthetic staging completion is not that authorization.

Automated sanitization cannot guarantee complete privacy. If zero external disclosure is required, leave Gemini disabled and use manual review.

## 15. Emergency disable and rollback

To stop new Gemini calls immediately, change the hosted Edge Function secret:

```text
AI_EMAIL_ANALYSIS_ENABLED=false
```

To stop Gmail access, disconnect it in Settings and revoke the app in the Google account. If compromise is suspected:

1. Disable AI and the Gmail schedule.
2. Revoke the Google OAuth grant.
3. Rotate the Gmail OAuth client secret, scheduler secret, and any exposed provider key.
4. Rotating `GMAIL_TOKEN_ENCRYPTION_KEY` requires reconnecting Gmail because existing ciphertext cannot be decrypted by the new key.
5. Review only metadata-safe logs and document the incident before re-enabling anything.

Database migrations are forward-only in production. Do not run `db reset`, edit an already-applied migration, or delete production rows to roll back code. Prepare and test a corrective migration instead.

## 16. Completion checklist

- [ ] Local validation passes.
- [ ] The correct staging/production Supabase project is linked.
- [ ] Both migrations are applied without production seed data.
- [ ] Remote database lint and security advisors are clean or reviewed.
- [ ] Only public Supabase URL/key values reach the frontend.
- [ ] Google application sign-in works.
- [ ] Public signup is disabled after the single owner is created.
- [ ] Exactly one owner has the server-managed owner claim.
- [ ] Edge Function secrets are installed with both AI flags `false`.
- [ ] All six functions are deployed and unauthenticated privileged calls return `401`.
- [ ] Three cron jobs exist with the expected UTC schedules.
- [ ] Manual tracker smoke testing passes.
- [ ] Gmail testing uses a synthetic inbox and satisfies the provider release gate.
- [ ] Gemini remains disabled unless every provider, policy, billing, consent, and residual-risk gate is complete.

## Official references

- [Supabase database migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase Edge Function deployment](https://supabase.com/docs/guides/functions/deploy)
- [Supabase Edge Function secrets](https://supabase.com/docs/guides/functions/secrets)
- [Supabase Auth redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase Vault](https://supabase.com/docs/guides/database/vault)
- [Supabase Cron](https://supabase.com/docs/guides/cron)
- [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Google Gmail API scopes](https://developers.google.com/workspace/gmail/api/auth/scopes)
- [Google restricted-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)
- [Google Workspace user-data policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy)
- [Gemini API terms](https://ai.google.dev/gemini-api/terms)
