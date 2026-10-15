# InternPilot AI — Testing Plan

**Last updated:** 15 October 2026
**Fixture policy:** synthetic data only unless the owner explicitly authorizes a limited provider test

## 1. Local validation

Run from a clean checkout with Node 22 and Docker Desktop running:

```bash
npm ci
npm run validate
npm run supabase:start
npm run supabase:reset
npm run test:db
npx supabase db lint --local --level error --fail-on error
npx supabase functions serve --env-file supabase/functions/.env.example
```

The Edge serve command uses placeholder values to compile/start functions. Do not invoke provider paths with placeholders. Stop the server after verifying OPTIONS and unauthenticated requests; no Gmail or Gemini call is needed for this check.

## 2. Automated coverage

| Boundary | Coverage |
|---|---|
| Frontend | Protected routing, setup behavior, application utilities, CSV safety |
| Local filter | Generic LinkedIn/job alerts ignored; real recruiter events retained |
| Matching | Multiple roles at one company, position/company signals, established thread |
| Privacy | Names, companies, email, phone, address, student ID, URLs, signatures, quoted threads, high-risk blockers |
| Gemini response | Exact keys/enums/dates, no arbitrary IDs, coherent category/status/action semantics |
| Secret crypto | AES-GCM randomized round trip, wrong-key rejection, URL-safe OAuth state/hash |
| RLS and grants | Owner-only rows, protected fields, backend-only tokens/OAuth states/leases/RPCs |
| Status integrity | AI event provenance, stale/blocked/closed rejection, immutable history, notifications |
| Manual review | Trusted assignment/status/deadline resolution and actor/event history |
| Idempotency | Gmail event uniqueness, processed-event replay, lease contention, reminder uniqueness |
| Retention | Archive at six months, delete at twelve, active record protection, diagnostic expiry |

## 3. Synthetic email matrix

Use fabricated companies, people, addresses, IDs, and message IDs.

| Case | Expected result |
|---|---|
| Newsletter/job recommendations | Local ignore; no Gemini call |
| LinkedIn/ATS interview message | Candidate; platform sender alone does not suppress it |
| One company and one matching role | Unique local application match |
| Two roles with no role evidence | Manual review; no Gemini or status change |
| Name/email/phone/address/student ID | Redact before final allowlist |
| Password, OTP, passport, bank, confidential marker | Privacy block; manual review |
| Quoted thread/signature/tracking URL | Remove; never persist or forward |
| Attachment | Ignore attachment bytes; never include in Gemini payload |
| Prompt injection | Inert text only; schema and backend rules remain authoritative |
| Invalid/extra Gemini fields | Reject; manual review |
| Older event after newer processed event | Reject as stale |
| Closed application event | No automatic reopen |
| Duplicate/retry/partial sync | No duplicate status/history/notification |
| Revoked token | Mark reauthorization required; no repeated provider access |

Provider-facing tests should stub `fetch` and assert request bodies/headers without printing them. Never snapshot raw or sanitized email text into logs.

## 4. Manual local checks

1. Start Supabase, copy only its local URL and publishable key into `frontend/.env.local`, and run `npm run dev`.
2. Verify the unconfigured/setup and signed-out states on mobile and desktop widths.
3. With a synthetic owner account, test application CRUD, duplicate warning, filters, status history, archive/restore, notifications, follow-ups, CSV export, and local follow-up-draft copy.
4. Confirm settings explains that automated sanitization cannot guarantee privacy and that acknowledgement alone does not enable Gemini.
5. Confirm the review queue exposes only metadata and a Gmail deep link, never a stored subject/body preview.
6. Run `npm run build && npm run preview`; directly load nested SPA routes.

## 5. Hosted staging tests

Use a dedicated test inbox and synthetic mail only:

1. Verify OAuth denial, expired state, replayed callback, missing refresh token, insufficient scope, revocation, and reconnect.
2. Confirm initial connection records the current Gmail history ID and does not import old messages.
3. Exercise more messages than one configured batch and an expired Gmail history cursor; ensure recovery pages continue without skipped events.
4. Trigger manual and scheduled sync together; exactly one obtains the lease.
5. Simulate Gmail/Gemini 429, timeout, 5xx, malformed JSON, and partial processing; verify bounded retries and preserved checkpoints.
6. Inspect database rows, Edge logs, browser network responses, and error monitoring for email body text, sanitized excerpts, tokens, provider keys, and personal identifiers. Any occurrence blocks release.
7. Confirm scheduled sync is 01:00 UTC, reminders are idempotent, and monthly cleanup preserves active/reopened applications.

## 6. Live-processing release gate

Real Gmail-to-Gemini processing stays off until every item is true:

- OAuth obligations are satisfied for the deployment audience.
- Gemini/Workspace data-use compatibility is confirmed for this exact sanitized-excerpt workflow.
- A paid provider project/model is selected; unpaid-service data handling is unacceptable for personal recruitment content.
- All automated and staging tests pass.
- Logs have been manually checked to be content-free.
- The owner has explicitly acknowledged the residual privacy risk in the UI and authorized limited testing.

Automated redaction is best-effort and cannot guarantee complete privacy. If the required privacy standard is zero external disclosure, keep Gemini disabled and use manual review.
