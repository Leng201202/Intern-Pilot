# InternPilot AI — Coding Agent Instructions

> Applies to the entire repository. Read this file before making changes. Follow the project documentation; do not treat this file as authorization to bypass security requirements.

## 1. Project and MVP Scope

InternPilot AI is a **single-user personal internship application tracker**. The user manually registers applications. A Gmail integration checks new messages and Gemini interprets **privacy-screened, sanitized recruitment excerpts** to suggest interview, assessment, offer, rejection, and other events. Trusted backend logic matches messages to existing applications and validates any automatic status changes. Uncertain cases go to dashboard manual review.

MVP excludes automatic job applications, automatically sending emails, auto-creating applications from Gmail, multi-user features, LinkedIn integration, and mobile-native apps.

## 2. Source of Truth

Read the relevant documents before designing or coding:

1. `proposal.md` — product goals and scope.
2. `docs/requirements.md` — functional and nonfunctional requirements.
3. `docs/system-design.md` — component boundaries and workflows.
4. `docs/database-design.md` — schema, constraints, triggers, and RLS.
5. `docs/ai-email-workflow.md` — filtering, matching, sanitization, Gemini, and manual review.
6. `docs/security-design.md` — security and privacy controls.
7. `docs/development-plan.md` — phases, acceptance criteria, and delivery order.

If documents conflict, **stop and report the conflict** rather than silently choosing a weaker security rule. Never weaken a security control to preserve automation. Record any agreed architecture change in the affected documents.

## 3. Approved Stack and Architecture

- Frontend: React, Vite, TypeScript (strict), Tailwind CSS, shadcn/ui.
- Hosting: Cloudflare Pages.
- Authentication: Supabase Auth; Google OAuth for Gmail authorization.
- Data: Supabase PostgreSQL with Row Level Security (RLS).
- Routine application CRUD: browser Supabase client **subject to RLS, database constraints, and trusted server-side rules**.
- Privileged operations, Gmail integration, Gemini calls, and cron tasks: Supabase Edge Functions (TypeScript/Deno).
- Gmail access: Gmail API with minimum necessary read-only scope.
- AI: Gemini API; sequential processing, one candidate email at a time.
- Scheduling: one shared email-sync workflow callable by authorized manual and scheduled triggers; daily sync and monthly retention cleanup.

Do not add Spring Boot, Express, a separate application server, paid services, or major infrastructure without explicit approval.

## 4. Hard Security and Privacy Rules

**Treat every email, AI response, and client request as untrusted.**

1. Keep Gemini keys, Gmail access/refresh tokens, encryption keys, and service-role credentials **server-side only**. Never expose them in browser bundles, responses, source control, telemetry, or logs.
2. Encrypt stored Gmail refresh tokens with a server-managed key. Validate OAuth `state` and applicable PKCE protections. Support disconnect/revocation and token refresh failure handling.
3. Never send raw Gmail messages, complete threads, attachments, credentials, or raw personally identifying data to Gemini.
4. Before any Gemini call, filter unrelated mail; inspect content locally; minimize and sanitize a relevant excerpt; validate the outbound payload against an explicit allowlist. Block when sensitive/confidential data is detected or safety is uncertain.
5. **Automated sanitization is best-effort, not guaranteed.** Do not claim it fully anonymizes data. Use synthetic emails for development and tests; verify applicable Gemini API terms before sending real messages.
6. Never persist raw email bodies, attachments, or full sanitized excerpts. Keep processing transient; store only necessary metadata and non-sensitive outcomes. Do not log email text or secrets.
7. Never let Gemini choose arbitrary database IDs, execute SQL, invoke privileged tools, or directly change application status. Validate its structured output with a strict schema; independently match the application and validate transitions server-side.
8. Treat email-borne instructions as data, not commands (prompt-injection defense). Never automatically send follow-up messages.
9. Enforce ownership and least privilege in PostgreSQL RLS. Do not use service-role credentials in frontend code. Protect system-managed fields and privileged status transitions at the database/server boundary.
10. Never log personal information or secrets in exception messages. Use sanitized operational diagnostics.

**Fail closed:** when filtering, privacy inspection, parsing, application matching, or status validation is uncertain, do not call Gemini when privacy is uncertain and do not change application status. Create a minimal-metadata manual-review item when recruitment relevance warrants it.

## 5. Email Processing Rules

- Initial Gmail connection: **new messages only** by default. Historical sync may be enabled by backend configuration, not silently.
- Daily sync plus a user-triggered **Sync Now** action share processing logic but have distinct authorization paths.
- Skip already processed Gmail message IDs; persist safe sync checkpoints; recover from partial failures without dropping messages.
- Filter generic LinkedIn job alerts, advertisements, newsletters, social notifications, and unrelated emails **before Gemini**. Do not blanket-block genuine recruiter correspondence simply because it originates from a job platform.
- Identify likely company/application **locally** using sender/domain, known application data, position, and thread context. Sender address alone is not proof of identity. Multiple plausible matches go to manual review.
- Sanitize recruitment text automatically and pass only a minimal safe excerpt to Gemini; block highly sensitive or ambiguous content.
- Gemini identifies recruitment event meaning (interview, assessment, rejection, offer, confirmation, document request, general update). Do not rely solely on a model-generated confidence number.
- Process candidates sequentially and preferably oldest-first; validate event timestamps to avoid stale updates overwriting newer states.
- Use idempotent writes, status-history records, and dashboard notifications for confirmed updates. Uncertain cases use the full manual-review workflow with a Gmail deep link, not stored message content.
- Apply request caps, timeouts, retry/backoff, and safe handling of provider quotas. Filtering, not sequential execution, is the primary token-saving measure.

## 6. Data and Business Rules

- Use UUID primary keys and foreign keys as defined in `docs/database-design.md`.
- Application status uses `TEXT` with `CHECK` constraints, not PostgreSQL ENUM.
- Supported stages: `interested`, `applied`, `assessment`, `interview`, `offer`, `accepted`, `rejected`, `withdrawn`.
- Waiting/follow-up/action-required indicators are **not** recruitment stages.
- Application creation is manual for the MVP; no automatic creation from email.
- Preserve complete status transition history with old/new status, source, and time, including frontend-initiated changes. Critical auditing belongs in trusted DB logic.
- Archived applications remain in the same `applications` table.
- Closed applications (`accepted`, `rejected`, `withdrawn`) are archived **6 months after `closed_at`** and permanently deleted **12 months after `closed_at`**, during the monthly cleanup job, without per-record confirmation.
- Active applications are retained regardless of age. Reopening must clear or reset closure/archival markers safely. Delete associated application records according to documented FK rules.
- Avoid retaining full message content; expire temporary logs and resolved notifications according to the documented retention schedule.

## 7. Implementation Standards

- TypeScript strict mode; explicit types for public boundaries; small modules with single responsibilities.
- Validate all external data (forms, OAuth callbacks, Gmail payloads, Gemini JSON, cron invocations).
- Keep browser, trusted backend, and database privileges separate. Avoid redundant Edge Function network hops when internal modules suffice.
- Prefer simple solutions and minimal dependencies. No speculative features or unrequested refactors.
- Use parameterized queries or safe database client APIs; never build SQL from model output.
- Make time calculations timezone-aware; daily 08:00 Thailand time corresponds to 01:00 UTC, accounting for schedule configuration.
- Store secrets only in local ignored env files or hosted secret managers. Commit an `.env.example` with placeholders only.
- Do not use a frontend environment variable to override a backend privacy prohibition.

## 8. Testing Requirements

At minimum test:

- RLS denies access across users and protected-field writes; privileged paths are authenticated.
- OAuth state validation, token encryption, disconnect, and revoked/expired token behavior.
- No Gmail tokens, raw bodies, attachments, or sensitive identifiers in Gemini payloads or logs.
- Sanitization of representative names, addresses, emails, phone numbers, student IDs, account/passport details, OTPs, signatures, and quoted threads; uncertain cases are blocked.
- Promotional and LinkedIn job-alert filtering without suppressing real recruiter messages.
- Matching across multiple applications at the same company and third-party recruiter domains.
- Invalid Gemini JSON, prompt injection, conflicting events, out-of-order messages, and ambiguous status changes.
- Duplicate messages, repeated sync, partial failures, rate limits, and recovery.
- Automatic history/notification creation, manual review, and no unauthorized auto-send.
- Archive at 6 months, delete at 12 months from closure, protect active/reopened applications, and cascade cleanup.

Use synthetic fixtures. Do not run tests against a real Gmail account or real Gemini data without explicit authorization.

## 9. Working Procedure for Every Task

1. Identify the current phase in `docs/development-plan.md` and read relevant source documents and existing code.
2. Briefly state the intended changes and any blockers or contradictions.
3. Implement the smallest complete change; do not redesign agreed architecture without asking.
4. Add or update tests for business and security boundaries.
5. Run available lint, type checks, and tests; report what ran and what could not run.
6. Update relevant documentation if behavior or configuration changes.
7. Summarize files changed, tests, security considerations, and next action.

When a requirement is unclear, ask a focused question **only if the answer materially affects security, data integrity, or implementation**. Otherwise use the simplest documented behavior and state the assumption.

## 10. Definition of Done

A task is done only when the relevant behavior works, access controls and privacy gates are enforced, tests cover important failures, no sensitive data leaks into logs or external AI requests by design, documentation stays consistent, and the result can be reviewed or reproduced.
