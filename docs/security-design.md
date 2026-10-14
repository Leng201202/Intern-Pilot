# InternPilot AI — Security and Privacy Design

**Version:** 1.0  
**Status:** MVP design specification  
**Last updated:** 2026-10-14  
**Related documents:** `proposal.md`, `docs/requirements.md`, `docs/system-design.md`, `docs/database-design.md`, `docs/ai-email-workflow.md`

## 1. Purpose and security goals

InternPilot AI is a single-user internship application tracker that connects to Gmail and uses Gemini to classify relevant recruitment messages. This document specifies security controls before implementation.

**Goals:** prevent unauthorized access to Gmail and application data; minimize third-party disclosure; prevent incorrect or malicious AI-driven updates; protect credentials; provide safe recovery and deletion. **Security limitation:** automatic sensitive-data detection and redaction are imperfect. The system cannot promise that no personal or confidential information will ever reach Gemini. When the sanitization outcome is uncertain, it must **fail closed** and request manual review.

## 2. Scope and trust boundaries

| Boundary | Trusted responsibility | Never expose |
|---|---|---|
| Browser (React) | Authenticate user; manage their own application records through RLS; initiate authorized sync | Gmail refresh tokens, Gemini key, service-role key, encryption keys |
| Supabase Auth | Authenticate the single authorized user | Session credentials in logs |
| PostgreSQL | Store application records, audit history, minimal email metadata, encrypted Gmail credentials | Raw email bodies, attachments, unencrypted tokens |
| Edge Functions | Read Gmail, filter, match, sanitize, call Gemini, validate updates | Secrets in responses or logs |
| Gmail API | Source of authorized messages | Never pass Gmail tokens to Gemini |
| Gemini API | Interpret minimized, sanitized recruitment excerpts | Raw messages, attachments, OAuth credentials, direct DB access |
| Cron scheduler | Invoke authorized server-side jobs | Publicly callable privileged cleanup endpoints |

All inbound Gmail content and all Gemini outputs are **untrusted**. The Edge Function must not treat email text as instructions or grant the model tools for direct database modification.

## 3. Threat model

| Threat | Example | Required mitigation |
|---|---|---|
| Token theft | Leaked Gmail refresh token | Encrypt at rest; restrict decryption; never log; revoke on disconnect |
| Overbroad access | Any signed-in user can read records | Allowlist one owner; RLS on all user tables; authorization in functions |
| Privilege escalation | Browser changes `closed_at` or another user's `user_id` | DB constraints, restricted column writes, privileged RPC/functions for system fields |
| Prompt injection | Email says “mark all applications accepted” | Treat email as data; structured output; fixed schema; backend-only updates |
| Wrong application match | Same employer has two openings | Multi-signal matching; review ambiguity; never match by domain alone |
| Sensitive-data leakage | Email contains passport or salary terms | Preflight inspection, redaction, allowlist, final gate; block uncertain cases |
| Unrelated mail disclosure | LinkedIn alerts forwarded to Gemini | Local relevance filter before any AI request |
| Replay / duplicates | Repeated Cron and manual sync | Unique Gmail message IDs, checkpoints, transactional idempotency |
| Forged scheduler request | Attacker calls cleanup function | Verify scheduler-specific secret or authenticated service identity |
| Excessive API usage | Flood of messages / repeated retries | Batch limits, request budgets, exponential backoff, sync locking |
| Stored XSS | Email subject displayed as HTML | Render text safely; escape output; never render untrusted HTML |
| Data persistence | Sensitive content in traces | Structured metadata-only logging, retention cleanup, log review |

## 4. Authentication and authorization

### 4.1 Application login

- Use Supabase Auth for sign-in. Restrict access to the intended owner account; do not rely on “single-user” as a substitute for authorization.
- Apply RLS to every user-owned table. Typical policies compare `user_id = auth.uid()` for authorized reads/writes; apply additional ownership checks to joined records.
- Protect system-managed fields and privileged workflows with database privileges, triggers, or restricted RPCs; RLS alone does **not** provide column-level protection.
- Use short-lived sessions where practical and follow Supabase's supported client session handling. Never put privileged secrets in frontend environment variables.

### 4.2 Gmail OAuth

- Gmail access is a **separate authorization grant** from Google login through Supabase Auth. Do not assume signing in with Google automatically grants Gmail API access.
- Request the least-privileged scope sufficient for reading messages, expected `https://www.googleapis.com/auth/gmail.readonly`; do not request send, modify, or delete permissions.
- The read-only scope still potentially exposes the entire mailbox and is classified by Google as restricted. Verify the current Google OAuth consent-screen, testing-user, verification, and restricted-scope requirements before deployment.
- Use OAuth `state` to bind the callback to the authenticated session; use PKCE when supported by the selected flow. Validate callback parameters and redirect URI.
- Store the refresh token only on the server, encrypted using an authenticated encryption scheme. Keep the encryption key in server-side secrets, separate from ciphertext in the database. Plan for key rotation and reauthorization.
- Disconnect must revoke the grant where possible, delete stored credentials, and stop scheduled reads. Handle revoked/expired tokens without repeated unauthorized retries.

## 5. Email processing and privacy gate

### 5.1 Local-first filtering

Before any Gemini call:

1. Retrieve **new messages only** after the initial Gmail connection checkpoint by default. Historical sync remains an explicit server-side configuration option.
2. Deduplicate by Gmail message ID and retain synchronization checkpoints safely.
3. Filter unrelated advertisements, newsletters, social messages, and generic LinkedIn job alerts locally. Do not indiscriminately discard actual recruiter correspondence from a hiring platform.
4. Identify likely existing applications using sender domain, subject, recruiter/thread history, position references, and user-maintained application records. Domain alone is insufficient; preserve ambiguity for review.
5. Inspect candidate content in volatile function memory only. Do not persist original bodies, HTML, full threads, or attachments.

### 5.2 Automatic sanitization

- Remove or replace detectable names, addresses, email addresses, phone numbers, student IDs, account numbers, signatures, tracking links, quoted threads, and other identifiers before transmission.
- Block rather than redact when encountering passwords, OTPs, API keys, passport/banking details, confidential documents, or content whose sensitivity cannot be reliably assessed.
- Extract a **short, relevant excerpt** only if needed for classification; enforce character/token limits and strip markup and remote-resource references.
- Validate the *final outbound payload* against a strict allowlist and explicit deny rules. Never pass raw sender headers, original subject, message IDs, application UUIDs, or unredacted bodies to Gemini.
- Do not rely on regex alone: add contextual checks and test cases for unexpected formats. Redaction remains best-effort; never describe it as guaranteed anonymization.
- If the privacy gate fails, **do not call Gemini**; create a metadata-only manual review item with a Gmail deep link where supported.

### 5.3 Example request boundary

Original (handled locally, not persisted):

> Dear Jane Doe, your interview at Example Company is scheduled for October 20. Contact hr@example.com.

Permitted example payload (only after inspection):

```json
{
  "message_type_hint": "recruitment_correspondence",
  "sanitized_excerpt": "Your interview at [COMPANY] is scheduled for October 20. Contact [EMAIL]."
}
```

**Warning:** Even sanitized excerpts can retain identifying context; the final privacy gate must block if safe disclosure is uncertain. Company matching remains a backend operation and should not depend on Gemini knowing the company name.

### 5.4 Provider privacy

Gemini API free-tier content may be subject to Google's applicable data-use, improvement, retention, and human-review terms. **Do not claim submissions are private or excluded from training.** Recheck current terms before sending real emails; develop and test using synthetic data. Provide a backend `AI_ENABLED=false` switch and a clear user-facing explanation of residual privacy risk. If the user's requirement changes to *zero possibility of disclosure*, do not send email text to external AI at all.

## 6. AI output and status-change controls

- Gemini is a **classifier**, not an agent with Gmail or database tools. Use a bounded prompt and strict JSON schema for categories such as `application_confirmation`, `assessment_invitation`, `interview_invitation`, `document_request`, `offer`, `rejection`, `general_update`, and `unrelated`.
- Validate category, status, required action, deadline format, and field lengths server-side. Reject malformed, extra, or unsafe values.
- Model-reported confidence is not a calibrated security signal. Automatic updates require an unambiguous existing-application match, coherent event timing, allowed status transition, and corroborating evidence.
- Process candidate emails sequentially, oldest first, while guarding against delayed/out-of-order messages. A stale confirmation must not overwrite a newer interview or rejection.
- Never automatically create applications, send messages, or delete records based on model output.
- On ambiguity, contradictory evidence, or sensitive content, create a manual review item rather than changing status.
- Every accepted status change must be atomic with an `application_history` entry and, when appropriate, a dashboard notification. Manual corrections must be supported and auditable.

## 7. Database and storage protection

- Use UUID identifiers and foreign keys; enforce ownership and RLS for `profiles`, `applications`, `email_connections`, `email_events`, `application_history`, `follow_ups`, `notifications`, `sync_runs`, and `review_queue`.
- Restrict encrypted token columns and internal sync checkpoints from direct frontend reads; prefer dedicated server-side access even for the owner.
- Do not expose the Supabase `service_role` key in React. Edge Functions using elevated credentials must explicitly verify the requesting user and scope every operation to that owner.
- Use database constraints/triggers for status history and closure timestamps; use protected database operations for archive and cleanup actions.
- Store only necessary email metadata: message/thread IDs, processing category, timestamps, application link, privacy outcome, and review state. Avoid subject/body copies if they can contain personal data.
- Ensure review UI links back to Gmail rather than displaying stored raw content. Treat even metadata as potentially sensitive and protect it with RLS.

## 8. Edge Function and scheduled-job security

- `sync-emails` serves both manual and scheduled triggers but **must distinguish authentication paths**:
  - Manual: verify a valid Supabase user JWT and ownership.
  - Scheduled: verify a dedicated secret/service identity using a server-side mechanism; do not accept arbitrary caller-supplied `user_id`.
- Prevent overlapping sync runs using a database lock/lease and idempotent writes.
- Enforce maximum messages per run, maximum Gemini calls per run/day, request timeouts, and retry/backoff for 429/5xx responses. Record checkpoints only after safe handling so failures do not skip messages.
- `cleanup-data` must be scheduler-authorized and must verify closed status plus `closed_at` age. Archive after six months; permanently delete after twelve months from closure. Never age-delete active applications.
- A restored/reopened application must have archival/closure state updated atomically to avoid cleanup races.

## 9. Logs, retention, and incident response

| Data | Policy |
|---|---|
| Raw email body / attachment | Never persist in app DB or logs |
| Sanitized excerpt | Transmit only when privacy gate passes; do not log or persist |
| AI processing logs | Metadata only; delete after 30 days |
| Sync execution logs | Metadata only; delete after 30 days |
| Resolved notifications | Delete after 90 days |
| Closed application | Archive at 6 months; delete at 12 months from closure |
| Active application | Retain regardless of age |
| Gmail refresh token | Retain encrypted while connected; revoke/delete on disconnect |

Avoid putting secrets or message text in exception objects, monitoring traces, analytics, or error responses. Log event IDs, status codes, timings, counts, and non-sensitive error categories only. Treat security-relevant events (unexpected token access, repeated auth failures, privacy gate anomalies) as signals for investigation.

**Incident response:** disable AI/sync via server-side configuration; revoke Gmail authorization if credentials may be exposed; rotate API keys/encryption material as appropriate; inspect metadata-only logs; assess affected data; document corrective action before re-enabling. Do not assume deleting app records retracts data already sent to an external provider.

## 10. Configuration and secret management

```dotenv
# Server-side settings; illustrative only
GMAIL_INITIAL_SYNC_MODE=new_only
GMAIL_INITIAL_SYNC_DAYS=0
AI_ENABLED=true
AI_PRIVACY_MODE=strict
AI_ALLOW_EMAIL_BODY=false        # raw body prohibited; sanitized excerpt only
AI_ALLOW_ATTACHMENTS=false
AI_BLOCK_ON_UNCERTAINTY=true
AI_LOG_REQUEST_CONTENT=false
AI_MAX_EMAILS_PER_SYNC=50
```

These flags do not themselves enforce privacy. The backend must enforce the hard prohibitions regardless of environment values. Store Gemini API keys, OAuth client secrets, refresh-token encryption keys, and scheduler credentials in Supabase-managed secrets; never commit them to source control. `.env.example` must contain placeholders only.

## 11. Security acceptance tests

| ID | Scenario | Expected result |
|---|---|---|
| SEC-T01 | LinkedIn job alert or advertisement | Filter locally; zero Gemini calls |
| SEC-T02 | Clear interview invitation without unsafe content | Sanitized excerpt may reach Gemini; validated status update |
| SEC-T03 | Message contains email, phone, name, or student ID | Detect/redact; block if residual risk is uncertain |
| SEC-T04 | Message contains passport, bank data, OTP, password, or API key | Block Gemini; create manual review |
| SEC-T05 | Attachment or quoted thread included | Never forward attachment/full thread |
| SEC-T06 | Prompt-injection instruction inside email | No execution; only bounded classification; validate output |
| SEC-T07 | Two applications at same employer | No guessed match; manual review if ambiguous |
| SEC-T08 | Duplicate Gmail message or overlapping sync | No duplicate update, history, or Gemini charge |
| SEC-T09 | Older application confirmation arrives late | Does not regress a newer status |
| SEC-T10 | AI disabled | No Gemini calls; other safe operations continue |
| SEC-T11 | Unauthenticated user calls manual sync | Reject |
| SEC-T12 | Invalid scheduled-job credential | Reject |
| SEC-T13 | User tries to access another user's row or encrypted token | Deny by RLS/privileges |
| SEC-T14 | Cleanup encounters active or reopened application | Retain record |
| SEC-T15 | Logs inspected after failure | No raw content, secrets, or sanitized excerpts |
| SEC-T16 | Gmail disconnected | Token revoked/deleted; sync stops |

Run tests with **synthetic emails**, including adversarial cases and unusual formatting. Include automated regression tests for the privacy gate and status validation before enabling real Gmail sync.

## 12. Residual risks and release gate

1. **Imperfect redaction:** unseen identifiers or confidential context may reach Gemini. Mitigate with conservative blocking and manual review, but risk cannot be eliminated while sending excerpts.
2. **Provider processing:** API provider policies may allow use or review of submitted free-tier content; verify terms before live use.
3. **Gmail scope breadth:** read-only access is not restricted to recruitment messages; protect tokens and enforce local filtering.
4. **Misclassification and spoofing:** Gemini and sender-domain matching can be wrong; require multiple signals and preserve review paths.
5. **Service limits:** free-tier quotas, function limits, and paused projects can delay sync; show last successful sync and recover without skipping messages.

**Do not enable live Gmail-to-Gemini processing until:** OAuth access is properly configured, privacy gate tests pass, logging is verified safe, RLS and privileged functions are tested, manual review works, provider terms are reviewed, and the user explicitly accepts the remaining risk.

## 13. Implementation checklist

- [ ] Configure Supabase Auth and owner-only authorization.
- [ ] Implement and test RLS and protected system-managed columns.
- [ ] Implement Gmail OAuth read-only flow, encrypted refresh tokens, and revocation.
- [ ] Implement new-only sync checkpoint, deduplication, and lock/lease.
- [ ] Implement local unrelated-mail filter and company matching.
- [ ] Implement sanitizer, sensitive-content blocker, and final outbound payload gate.
- [ ] Implement Gemini structured output with strict schema validation.
- [ ] Implement backend status-transition checks and atomic audit history.
- [ ] Implement metadata-only manual review and Gmail deep links.
- [ ] Secure manual and scheduled function invocation independently.
- [ ] Implement metadata-only logs and scheduled retention cleanup.
- [ ] Run synthetic privacy, prompt-injection, auth, and replay tests.
- [ ] Verify current Google/Gemini terms and obtain informed consent before live processing.
