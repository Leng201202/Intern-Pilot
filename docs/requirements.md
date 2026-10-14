# InternPilot AI — Software Requirements Specification

**Version:** 1.2 (sanitized-excerpt privacy baseline)  
**Date:** 14 October 2026  
**Status:** Approved requirements baseline  
**Project type:** Single-user personal internship application tracker

## 1. Purpose and Scope

InternPilot AI helps one user track internship applications, monitor recruitment-related Gmail messages, use Gemini on privacy-validated, minimized, sanitized recruitment excerpts, and safely update existing applications. The system is designed for low-cost operation using React, Supabase, Gmail API, Gemini API, and Cloudflare Pages.

### 1.1 MVP goals

- Maintain a reliable, searchable record of internship applications.
- Synchronize **new Gmail messages only** after the account is connected, with daily scheduled and manual sync.
- Prevent unsafe Gemini calls through local filtering, explicit payload allowlisting, and fail-closed privacy validation.
- Automatically update **existing** applications only when a message can be reliably matched and validated.
- Surface deadlines, follow-ups, ambiguous emails, and processing outcomes in the dashboard.
- Archive closed applications after six months and delete them after twelve months, measured from closure.

### 1.2 Out of scope for MVP

Automatic application creation or submission; sending emails automatically; multi-user/team functionality; browser push/email notifications; LinkedIn integration; native mobile apps; Google Calendar integration; attachment ingestion or storage; historical Gmail import (configurable future capability, **off by default**).

## 2. Actors and External Systems

| Actor / system | Responsibility |
|---|---|
| User | Creates and manages applications; reviews ambiguous email matches; handles follow-ups. |
| React web app | Presents tracker, dashboard, notifications, and sync controls. |
| Supabase Auth | Authenticates the authorized user. |
| Supabase PostgreSQL | Stores applications, activity, email metadata, reminders, and sync state. |
| Supabase Edge Functions | Performs Gmail sync, filtering, AI orchestration, and cleanup. |
| Gmail API | Provides read-only access to authorized mailbox messages. |
| Gemini API | Classifies explicitly allowlisted, minimized, sanitized recruitment excerpts; it has no direct access to Gmail or Supabase. |
| Supabase Cron | Triggers daily synchronization and monthly retention cleanup. |

## 3. Functional Requirements

**Priority definitions:** **Must** = MVP launch requirement; **Should** = desirable shortly after MVP; **Could** = optional enhancement; **Future** = explicitly outside MVP.

### 3.1 Application Management

| ID | Priority | Requirement |
|---|---|---|
| FR-001 | Must | User can manually create an internship application. |
| FR-002 | Must | User can list and view applications. |
| FR-003 | Must | User can edit application fields and status. |
| FR-004 | Must | User can manually delete an application after confirmation. |
| FR-005 | Must | User can filter applications by recruitment status and archive state. |
| FR-006 | Must | User can search by company and position. |
| FR-007 | Must | User can view application details and chronological activity history. |
| FR-008 | Must | System warns about possible duplicates using normalized company, position, and relevant application details; user can still proceed. |
| FR-009 | Should | User can store a job description as text. |
| FR-010 | Could | User can record the CV/document version used; uploading documents is not required. |

**Application fields**

| Field | Required | Notes |
|---|---|---|
| `company_name` | Yes | Nonempty text. |
| `position_title` | Yes | Nonempty text. |
| `application_date` | Yes | Date, user-editable. |
| `status` | Yes | Defaults to `Applied` when recording a submitted application; `Interested` is allowed for unsent opportunities. |
| `application_deadline` | No | Submission deadline. |
| `job_url` | No | Valid URL if supplied. |
| `application_method` | No | E.g., company portal, email, referral. |
| `location` | No | City/remote details. |
| `notes` | No | Free text. |
| `job_description` | No | Plain text, optional. |
| `closed_at` | System-managed | Set when transitioning into a closed status. |
| `archived_at` | System-managed | Set by scheduled archival; cleared when restored/reopened. |

**Recruitment statuses:** `Interested`, `Applied`, `Assessment`, `Interview`, `Offer`, `Accepted`, `Rejected`, `Withdrawn`. Closed statuses are `Accepted`, `Rejected`, and `Withdrawn`; all others are active. Recruitment steps are **not** assumed to be linear. Communication/action flags such as `Waiting for Response`, `Follow-up Required`, `Long-term Pending`, and `Action Required` are separate from recruitment status.

### 3.2 Gmail Connection and Synchronization

| ID | Priority | Requirement |
|---|---|---|
| FR-011 | Must | User can connect Gmail using Google OAuth with minimum necessary read permissions. |
| FR-012 | Must | System retrieves eligible incoming Gmail messages without modifying mailbox content. |
| FR-013 | Must | System initiates synchronization daily (default target: 08:00 Asia/Bangkok). |
| FR-014 | Must | User can trigger **Sync Emails Now**. |
| FR-015 | Must | System deduplicates processing by Gmail message ID and safely handles repeated sync calls. |
| FR-016 | Must | System applies local relevance and privacy filters before constructing any external AI request. |
| FR-017 | Must | System records sync attempts, outcomes, counts, and errors. |
| FR-018 | Must | System can retry failures and resume from a durable checkpoint without silently skipping messages. |
| FR-019 | Must | User can disconnect Gmail; stored OAuth credentials are revoked where feasible and deleted. |
| FR-020 | Should | Dashboard displays connection health and last successful sync. |

**Initial sync decision:** Default mode is `new_only`. When Gmail is connected, the system establishes a starting checkpoint and does not analyze pre-connection messages. Historical import is disabled for MVP; environment configuration may reserve `historical` mode for future implementation. A checkpoint must not advance past messages that have not been durably recorded or safely queued for retry.

**Resource controls:** Environment-configurable AI candidate limit per run (initial proposed default: 50), rate-limit handling, batching, and retries. If the cap is reached, pending eligible messages must remain recoverable for later runs. Gmail API retrieval does not itself consume Gemini tokens; only calls to Gemini do.

### 3.3 AI Classification and Application Matching

| ID | Priority | Requirement |
|---|---|---|
| FR-021 | Must | Gemini classifies candidate messages using only privacy-validated, allowlisted, minimized, sanitized recruitment excerpts. |
| FR-022 | Must | System locally extracts a company name when available; company identifiers are removed or replaced before external AI processing. |
| FR-023 | Must | System extracts a position title when available and sanitizes identifying details before external AI processing. |
| FR-024 | Must | System extracts explicit deadlines and their context when available from validated Gemini output and verifies them in backend logic. |
| FR-025 | Must | System identifies required user actions from validated Gemini output, such as completing an assessment or submitting documents. |
| FR-026 | Must | System locally matches a recruitment message to an **existing** application using sender/thread/context and extracted identifiers. |
| FR-027 | Must | System updates application status automatically **only** for unambiguous, validated matches and supported transitions. |
| FR-028 | Must | Every automatic update creates a timestamped history record with source email reference and before/after values. |
| FR-029 | Must | Unmatched, ambiguous, or unsafe-to-apply messages are queued for user review rather than changing application state. |
| FR-030 | Must | User can correct a classification or status; the correction is recorded in history. |
| FR-031 | Future | Automatically create an application from a confirmation email. **Not implemented in MVP.** |
| FR-032 | Should | User can inspect a concise history of AI classifications and decisions. |

**Supported email categories:** `Application Confirmation`, `Assessment Invitation`, `Interview Invitation`, `Document Request`, `Application Update`, `Offer`, `Rejection`, `General Recruitment`, `Unrelated`.

**Decision safeguards:**

1. Validate Gemini input against an explicit allowlist and Gemini output against a strict schema; treat unknown input fields and malformed or missing output fields as non-actionable.
2. Never assume a model-provided confidence number is a calibrated probability.
3. Do not infer rejection from silence or a long waiting period.
4. Do not overwrite a newer status with an older email discovered during a retry or replay.
5. Do not force numerical/linear status progression; assessment and interview sequences vary.
6. Never automatically reopen a closed application based on uncertain messages; request review.
7. If multiple applications at the same company are plausible, require review.
8. Do not create a new application when no reliable existing match is found.
9. Never submit raw subjects, messages, bodies, threads, attachments, identifiers, confidential content, or credentials to Gemini.
10. Do not store raw email content in application or AI-processing logs; retain only minimal non-sensitive metadata and necessary locally extracted facts.

### 3.4 Follow-ups and Deadlines

| ID | Priority | Requirement |
|---|---|---|
| FR-033 | Must | System calculates elapsed time since the last meaningful recruitment interaction. |
| FR-034 | Must | System identifies active applications eligible for follow-up. |
| FR-035 | Must | System creates dashboard follow-up reminders. |
| FR-036 | Must | User can view follow-up activity/history. |
| FR-037 | Must | System records upcoming assessment, interview-confirmation, and document deadlines when explicitly stated. |
| FR-038 | Must | Dashboard highlights upcoming and overdue actionable deadlines. |
| FR-039 | Should | System can generate a follow-up draft locally or from privacy-validated, minimized, sanitized AI input for user review; **never auto-send**. |
| FR-040 | Must | User can dismiss or mark reminders completed. |
| FR-041 | Should | User can configure follow-up intervals. |

**Default follow-up thresholds:** suggest at 14 days, remind at 21 days, mark long-term pending at 30 days without meaningful response. These are configurable business rules, not changes to recruitment status. Reminders should not fire for closed applications or duplicate an already completed follow-up for the same interaction period. The university internship deadline may be configured as a personal milestone; do not hardcode a particular date.

### 3.5 Dashboard and In-App Notifications

| ID | Priority | Requirement |
|---|---|---|
| FR-042 | Must | Dashboard shows counts by recruitment status. |
| FR-043 | Must | Dashboard shows applications requiring attention or review. |
| FR-044 | Must | Dashboard lists upcoming deadlines. |
| FR-045 | Must | Dashboard shows recent AI-driven updates. |
| FR-046 | Must | Dashboard displays latest sync status. |
| FR-047 | Must | Application details show a chronological activity timeline. |
| FR-048 | Should | Dashboard widgets support additional filtering. |
| FR-049 | Must | System displays notifications **inside the dashboard only**. |
| FR-050 | Should | User can mark notifications as read. |

Browser push notifications and outgoing notification emails are excluded from MVP.

### 3.6 Retention, Archive, and Cleanup

| ID | Priority | Requirement |
|---|---|---|
| FR-051 | Must | System records `closed_at` when an application enters `Accepted`, `Rejected`, or `Withdrawn`. |
| FR-052 | Must | Closed applications are archived after **6 months from `closed_at`**. |
| FR-053 | Must | Archived closed applications are permanently deleted after **12 months from `closed_at`**, without asking for confirmation. |
| FR-054 | Must | Active applications are retained regardless of their age. |
| FR-055 | Must | Supabase Cron runs retention cleanup monthly. |
| FR-056 | Must | User can view archived applications separately from active tracker views. |
| FR-057 | Should | User can restore an archived application; reopening clears `closed_at` and `archived_at` and moves it to an active status. |
| FR-058 | Must | Deleting an application also removes dependent records according to defined foreign-key and privacy rules. |
| FR-059 | Must | System deletes AI processing and sync execution logs after 30 days and resolved notifications after 90 days, subject to retaining essential sync checkpoints and deduplication identifiers. |
| FR-060 | Should | User can export application records to CSV before deletion. |

**Retention rules:** The clock starts at closure, **not** application creation or submission. A monthly job may perform an action on the next run after the threshold, not necessarily the exact anniversary. Before deleting, re-check the record's **current** status, closure date, and archive state in the same safe operation. Restored/reopened applications must not be deleted under an old closure date. Archived records may remain in the same table (soft archive), so archiving alone does not free significant database space; permanent deletion and short log retention control storage growth.

## 4. AI Data Privacy and Protection Requirements

External AI processing is optional and prohibited for any payload whose safety cannot be established. Privacy enforcement occurs inside Supabase Edge Functions before every Gemini request and cannot be bypassed by frontend settings. Automated redaction, including regular-expression or AI-based redaction, cannot guarantee anonymity; permitted sanitized excerpts retain residual disclosure risk that must be acknowledged before live processing.

| ID | Requirement | Priority | Testable acceptance criteria |
|---|---|---|---|
| SEC-013 | The system shall not submit sensitive, confidential, or personal information to Gemini. | Must | Instrumented Gemini requests contain no seeded sensitive, confidential, or personal test values. |
| SEC-014 | The system shall inspect email content locally before external AI processing. | Must | A test request cannot reach the Gemini client unless a local inspection result exists and is `safe`. |
| SEC-015 | The system shall exclude personal identifiers from external AI requests. | Must | Payloads containing seeded names, email addresses, phone numbers, student IDs, passport numbers, or addresses are rejected before network invocation. |
| SEC-016 | The system shall detect potentially confidential content before external AI processing. | Must | Confidentiality indicators cause the request to be blocked and routed to local handling or manual review. |
| SEC-017 | The system shall block external AI requests when safe processing cannot be established. | Must | Missing, failed, unknown, or ambiguous inspection results produce no Gemini call and no automatic record change. |
| SEC-018 | The system shall not submit email attachments to Gemini. | Must | Gemini client tests receive no attachment bytes, filenames, URLs, MIME parts, or attachment-derived free text. |
| SEC-019 | The system shall not submit complete email bodies or conversations to Gemini. | Must | Request-schema validation rejects body, message, thread, excerpt, quote, and raw-subject fields. |
| SEC-020 | The system shall transmit only explicitly allowlisted, minimal, sanitized recruitment excerpts and bounded context to external AI services. | Must | The request serializer emits only documented fields within size limits and rejects unknown fields rather than dropping or forwarding them. |
| SEC-021 | The system shall not store raw email content in application logs. | Must | Log-capture tests confirm that bodies, raw subjects, excerpts, identifiers, and attachment data are absent on success and failure paths. |
| SEC-022 | The system shall support disabling external AI processing through backend configuration. | Must | With `AI_EMAIL_ANALYSIS_ENABLED=false`, all eligible emails use local handling or manual review and the Gemini client is never invoked. |
| SEC-023 | The system shall record AI processing outcomes without retaining sensitive content. | Must | Outcome records contain status, timestamps, policy/reason codes, schema version, and correlation identifiers only; seeded sensitive content is absent. |

### 4.1 Privacy Business Rules

- **BR-PRIV-001:** External AI requests are prohibited unless the payload passes privacy validation.
- **BR-PRIV-002:** Raw Gmail messages, email bodies, attachments, OAuth tokens, and personal identifiers are prohibited in Gemini requests.
- **BR-PRIV-003:** Unknown, sensitive, or ambiguous email content must be processed locally or referred for manual review.
- **BR-PRIV-004:** Gemini cannot directly access Gmail, Supabase credentials, or the database.
- **BR-PRIV-005:** AI classification results are untrusted until validated by backend logic.
- **BR-PRIV-006:** Privacy validation must occur before every external AI request.
- **BR-PRIV-007:** The backend must enforce the privacy policy regardless of frontend settings.

### 4.2 Privacy Acceptance Criteria

| ID | Test | Expected result |
|---|---|---|
| AC-PRIV-01 | Process an email containing personal identifiers. | Identifiers are removed before payload construction; Gemini is not called if safe removal cannot be established. |
| AC-PRIV-02 | Process an email containing confidential information. | Gemini is not called and a non-sensitive reason code is recorded. |
| AC-PRIV-03 | Process an email with attachments. | No attachment data or metadata is transmitted to Gemini. |
| AC-PRIV-04 | Attempt to construct a request containing a complete email body or conversation. | Request validation rejects it before network invocation. |
| AC-PRIV-05 | Add an invalid or unknown payload field. | The entire payload is rejected; fields are not silently forwarded. |
| AC-PRIV-06 | Process an unsafe or uncertain email. | No automatic status change occurs and a manual review item is created. |
| AC-PRIV-07 | Disable external AI in backend configuration. | No Gemini API request occurs for scheduled or manual synchronization. |
| AC-PRIV-08 | Capture logs across successful, blocked, and failed processing. | Logs contain no raw subject, body, excerpt, attachment, identifier, secret, or token. |
| AC-PRIV-09 | Return a valid-looking Gemini response proposing a record change. | Backend schema, matching, and transition validation run before any atomic database update. |
| AC-PRIV-10 | Submit a minimized, sanitized recruitment excerpt that passes the allowlist while AI is enabled. | The validated payload may be processed and its response remains subject to backend validation. |

## 5. Non-Functional Requirements

| ID | Category | Requirement / verification target |
|---|---|---|
| NFR-001 | Access control | Only the designated authenticated account may access the app and its data; enforce at DB/API level. |
| NFR-002 | Credential security | Gmail refresh tokens must be encrypted at rest and accessible only to trusted server-side functions. |
| NFR-003 | Secret management | Gemini, OAuth, and service-role secrets must never be bundled into frontend assets. |
| NFR-004 | Privacy | Enforce data minimization, minimum Gmail permissions, explicit AI payload allowlisting, and fail-closed backend validation. |
| NFR-005 | Reliability | A failed sync must leave recoverable work and an actionable error record. |
| NFR-006 | Idempotency | Replaying the same Gmail message must not duplicate events, history, or status updates. |
| NFR-007 | Performance | Aim for dashboard interactions within ~3 seconds under normal single-user conditions, excluding external sync. |
| NFR-008 | Cost | Target $0/month within free tiers; enforce API usage limits and acknowledge provider quotas may change. |
| NFR-009 | Usability | Application creation requires only four fields; show clear feedback on validation and sync state. |
| NFR-010 | Compatibility | Responsive interface for modern desktop and mobile browsers. |
| NFR-011 | Maintainability | Separate Gmail ingestion, duplicate detection, local filtering, privacy inspection and sanitization, allowlisted payload construction, AI invocation/validation, matching, status transitions, and persistence. |
| NFR-012 | Auditability | Record source, timestamp, actor, and old/new values for every status change. |
| NFR-013 | Recovery | Resume processing after outages, expired credentials, rate limits, or paused infrastructure without silently losing messages. |

## 6. Configuration Requirements

These are **example names**, to be finalized in system design. Secrets are server-side only; client-exposed variables must not include tokens or keys.

```dotenv
# Initial Gmail import: only messages arriving after connection
GMAIL_INITIAL_SYNC_MODE=new_only
GMAIL_INITIAL_SYNC_DAYS=0
GMAIL_SYNC_ENABLED=true
AI_EMAIL_ANALYSIS_ENABLED=true
AI_MAX_EMAILS_PER_SYNC=50

# Optional business rules
FOLLOW_UP_SUGGEST_DAYS=14
FOLLOW_UP_REMIND_DAYS=21
LONG_PENDING_DAYS=30
ARCHIVE_AFTER_MONTHS=6
DELETE_AFTER_MONTHS=12
```

Changing the mode to `historical` must **not** activate historical import until that feature is implemented and tested. Scheduled sync target: 08:00 Thailand time; daily cron can be expressed as `0 1 * * *` UTC while Thailand remains UTC+7. Monthly cleanup schedule is to be chosen during deployment.

## 7. Data and Integrity Rules

- Store timestamps in UTC; display in the user's chosen timezone (default Asia/Bangkok).
- Use UUID identifiers for application and event records.
- Enforce uniqueness of Gmail message IDs within the connected mailbox/account.
- Persist an explicit processing state (e.g., `pending`, `processed`, `review`, `failed`) and retry metadata for messages that need it.
- Use transactions or equivalent atomic operations for status changes plus history writes.
- Use least-privilege Supabase RLS policies and authenticated Edge Function authorization for user actions; scheduled jobs require separate protected authorization.
- Treat email content as untrusted input, including instructions embedded in messages. Gemini output is data, not executable commands.
- Treat external AI as having no authority or direct access to Gmail, Supabase, the database, or credentials.
- Fail closed before every Gemini request unless the payload consists exclusively of validated allowlisted fields.
- If Gmail is disconnected, stop syncing and remove stored OAuth credentials; define the retention of previously extracted application history in privacy design.

## 8. Key Acceptance Scenarios

| ID | Given / When | Expected result |
|---|---|---|
| AC-01 | User creates an application with company, position, date, status | Record is saved and visible in the tracker. |
| AC-02 | User connects Gmail with default `new_only` | No older messages are analyzed; new messages are eligible. |
| AC-03 | User presses Sync Now twice for the same messages | No duplicate email events or status changes. |
| AC-04 | LinkedIn sends a job recommendation | Message is filtered/ignored and does not modify applications. |
| AC-05 | Clear interview invitation matches exactly one application | Status becomes `Interview`, and history records source and change. |
| AC-06 | Email might match two roles at one company | Neither application is changed; review item is created. |
| AC-07 | An older confirmation arrives after an interview update | Status is not rolled back to `Applied`. |
| AC-08 | An email mentions a company with no existing application | No application is created; relevant message is flagged for review. |
| AC-09 | Gemini returns malformed JSON or API fails | No unsafe update; error is recoverable and visible in logs. |
| AC-10 | Active application receives no response for 14/21/30 days | Corresponding follow-up flags/reminders appear without setting `Rejected`. |
| AC-11 | Closed application reaches six months since closure | Monthly job archives it; it remains viewable in Archive. |
| AC-12 | Archived closed application reaches twelve months since closure | Monthly job permanently deletes it and dependent records without confirmation. |
| AC-13 | A closed application is reopened before cleanup | Closure/archive markers are cleared and the active record is retained. |
| AC-14 | Sync is interrupted by rate limit or temporary outage | Unprocessed messages remain recoverable and are retried. |
| AC-15 | User disconnects Gmail | Further Gmail access stops and saved credentials are removed. |

## 9. Dependencies, Risks, and Assumptions

1. Gmail OAuth consent-screen configuration and Google verification/testing restrictions may affect access to the user's mailbox; confirm the chosen scope and publishing mode during implementation.
2. Supabase free-tier projects may pause or have usage constraints; scheduled sync is best-effort, with a manual recovery path and missed-message catch-up.
3. Gemini free-tier quotas, models, and data-handling terms must be verified at deployment; only privacy-validated, minimized, sanitized excerpts may be sent, and automated redaction cannot eliminate residual disclosure risk.
4. Automated matching can be wrong. Conservative validation and a review queue are mandatory, even when the AI appears confident.
5. A single-user deployment still requires secure authentication, authorization, and protection of OAuth tokens.
6. Deletion is irreversible. The user has explicitly chosen automatic deletion at twelve months without prior confirmation; optional CSV export is not a prerequisite for scheduled deletion.
7. Sanitized excerpts may omit context needed for reliable classification, and automated redaction may miss identifying context. Ambiguous or unsafe messages require manual review; privacy restrictions take precedence over accuracy.

## 10. Implementation Boundaries and Traceability

The requirements in Sections 3–8 define the MVP baseline. The next documents should map each requirement to a component, database table, endpoint, and test:

1. `docs/system-design.md` — architecture and processing sequence.
2. `docs/database-design.md` — schema, indexes, RLS, retention constraints.
3. `docs/ai-email-workflow.md` — prompts, JSON schema, matching, safety rules.
4. `docs/development-plan.md` — phased tasks and acceptance tests.

**Approved MVP decisions:** initial sync `new_only` with env customization; manual application creation; dashboard-only notifications; archive after six months; permanently delete after twelve months without confirmation; active applications retained.
