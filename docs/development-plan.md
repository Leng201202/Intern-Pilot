# InternPilot AI — Development Plan

**Version:** 1.4
**Date:** 15 October 2026
**Status:** Phases 0–5 implemented and locally validated; Phase 6 source hardening complete, hosted deployment/provider authorization pending
**Scope:** Single-user MVP

## 1. Purpose

This plan translates the approved project proposal, requirements, system design, database design, AI email workflow, and security design into implementation milestones. The goal is a secure, low-cost internship application tracker that connects to Gmail, classifies relevant recruitment emails with Gemini when privacy checks permit, and updates existing applications safely.

## 2. Confirmed Decisions

| Area | Decision |
|---|---|
| Frontend | React, Vite, TypeScript, Tailwind CSS, shadcn/ui |
| Hosting | Cloudflare Pages |
| Database and auth | Supabase PostgreSQL, RLS, Supabase Auth |
| Backend | Supabase Edge Functions (TypeScript/Deno) |
| Application CRUD | Direct Supabase client access, with database-enforced security and integrity |
| Gmail | Gmail API with read-only OAuth permission; new messages only by default |
| Sync | One shared Edge Function for manual and daily scheduled execution |
| AI | Gemini for recruitment-message classification, sequential requests |
| Privacy | Filter unrelated mail; locally match companies; automatically redact/minimize text; block uncertain or unsafe payloads |
| Application creation | Manual only |
| Notifications | In-app dashboard only |
| Follow-up emails | Drafts for review only; never auto-send |
| Retention | Archive closed applications after 6 months; delete after 12 months; retain active applications |
| Cleanup | Monthly scheduled job |

## 3. Delivery Principles

1. **Security gates before live Gmail:** Develop with synthetic recruitment emails first. Do not connect a personal inbox until OAuth, encryption, access controls, logging restrictions, and privacy tests pass.
2. **Privacy is not guaranteed by redaction:** Automated redaction is best effort. If sensitive or confidential content cannot be safely removed, do not send it to Gemini; queue for review.
3. **AI never directly writes to the database:** Validate structured output, match the application using trusted backend data, and enforce safe transitions before updating.
4. **Small, testable increments:** Each phase should end with a working demo and acceptance checks.
5. **Free-tier awareness:** Limit API calls, cap batch size, use idempotency, and avoid storing email bodies or attachments.
6. **Documentation alignment:** When implementation decisions change, update the affected design documents and record the decision.

## 4. Milestones and Dependencies

| Phase | Milestone | Depends on | Exit criterion |
|---|---|---|---|
| 0 | Repository and local environment | None | App starts locally; configuration and secrets handled safely |
| 1 | Database and authentication | Phase 0 | Migrations, RLS, and protected-field tests pass |
| 2 | Manual application tracker | Phase 1 | CRUD, search, filters, timeline, and dashboard work |
| 3 | Gmail connection and safe retrieval | Phase 1 | Secure OAuth and new-only sync work with test data |
| 4 | Privacy-safe AI processing | Phases 2–3 | Filtering, redaction, classification, matching, and review pass tests |
| 5 | Automation and follow-ups | Phase 4 | Daily sync, reminders, retention jobs, and recovery work |
| 6 | Production hardening and deployment | Phases 0–5 | End-to-end tests pass and app deploys successfully |

> **Scheduling:** Phases are ordered by dependency, not fixed calendar duration. The user’s university internship submission deadline is an important personal reminder, not a guaranteed project launch date.

## 5. Phase 0 — Project Setup

**Tasks**
- [x] Create repository folders: `frontend/`, `supabase/functions/`, `supabase/migrations/`, `docs/`.
- [x] Initialize React + Vite + TypeScript, Tailwind CSS, and shadcn/ui.
- [x] Configure ESLint, formatting, TypeScript strict mode, and basic test runner.
- [x] Create Supabase development project and local configuration.
- [x] Add `.env.example` with placeholder values; exclude actual secrets from Git.
- [x] Define environment separation for local and production.
- [x] Set up a minimal CI workflow for lint, typecheck, and tests.

**Acceptance criteria:** The frontend starts locally; tests and lint run; no credentials are committed.

**Implementation status (14 October 2026):** Complete. The repository includes pinned dependencies and a lockfile, a responsive lazy-loaded dashboard shell with Phase 0 placeholders, browser-safe Supabase configuration, local Supabase CLI configuration, Cloudflare Pages SPA rules, and CI checks for formatting, linting, type checking, tests, and production build. Later phase sections record the functionality added after this foundation.

## 6. Phase 1 — Database, Authentication, and Security Foundation

**Tasks**
- [x] Implement reviewed SQL migrations for `profiles`, `applications`, `email_connections`, `email_events`, `application_history`, `follow_ups`, `notifications`, `sync_runs`, and `review_items`.
- [x] Use `TEXT` + `CHECK` for application statuses.
- [x] Add UUID keys, foreign keys, unique Gmail message IDs, timestamps, and useful indexes.
- [x] Enable and test RLS for every user-owned table.
- [x] Configure Supabase Auth and authorized-user restrictions for the personal app.
- [x] Enforce status history and protected fields in the database, not only the UI.
- [x] Define restricted server-side access to encrypted Gmail refresh tokens.
- [x] Add database tests for status transitions, ownership, archival, and deletion.

**Acceptance criteria:** An unauthorized user cannot read or modify personal data; status changes are audited; browser access cannot retrieve tokens or alter protected system fields.

**Implementation status (14 October 2026):** Complete. A clean local reset applies the migration for all nine tables, explicit grants, owner-and-subject RLS policies, protected-field triggers, immutable status history, and backend-only encrypted-token access. The 42 passing pgTAP assertions exercise ownership, protected columns, status lifecycle, archival/reopening, and deletion behavior; CI now runs the database suite on every change.

## 7. Phase 2 — Manual Application Tracker and Dashboard

**Tasks**
- [x] Implement sign-in, sign-out, and protected routes.
- [x] Build create/edit/delete application forms with validation.
- [x] Implement list, search, status filters, and application detail views.
- [x] Add duplicate-application warnings without preventing legitimate multiple positions at one company.
- [x] Show status history, notes, deadlines, and activity.
- [x] Build dashboard cards: totals, needs attention, waiting, closed, recent activity.
- [x] Add in-app notification list and read/unread state.
- [x] Add archived application view and CSV export.

**Acceptance criteria:** The user can manage applications entirely without Gmail or Gemini; the UI works on desktop and mobile browsers.

**Implementation status (15 October 2026):** Complete. The React application now uses Google sign-in through Supabase Auth, validates the server-managed owner claim before rendering protected routes, and relies on RLS as the final authorization boundary. Phase 2 includes responsive manual CRUD, validation and non-blocking duplicate warnings, search and status filtering, application details and database-backed status history, dashboard metrics, notifications, safe review metadata, profile settings, archived records, restore behavior, and spreadsheet-formula-safe CSV export. Gmail access, Gemini requests, and scheduled processing remain disabled.

## 8. Phase 3 — Gmail OAuth and Synchronization Foundation

**Tasks**
- [ ] Configure Google OAuth consent and Gmail read-only scope; confirm Google's current restricted-scope requirements before real deployment.
- [x] Implement OAuth callback with state/PKCE protections as appropriate to the selected flow.
- [x] Encrypt refresh tokens using server-held key material; never expose tokens to the frontend.
- [x] Implement connect, connection status, and disconnect/revoke flows.
- [x] Implement the shared `sync-emails` Edge Function with separate authenticated manual and scheduled invocation paths.
- [x] Default to `new_only` initial synchronization; make historical range configurable but disabled.
- [x] Track synchronization checkpoints and processed Gmail message IDs.
- [x] Retrieve minimal metadata and message content only when needed for local inspection; do not persist full bodies or attachments.
- [x] Filter obvious newsletters, promotions, LinkedIn job recommendations, and unrelated notifications before AI calls. Do not discard genuine recruiter messages merely because a recruiting platform sent them.
- [x] Add bounded batches, pagination, retry/backoff, and safe recovery after interrupted syncs.

**Acceptance criteria:** New relevant test messages can be retrieved once; reruns do not duplicate events; unrelated messages never reach Gemini; disconnect revokes/invalidates future access as designed.

**Implementation status (15 October 2026):** Complete in source and synthetic/local validation. The hosted Google consent screen, restricted-scope obligations, and provider-backed test inbox remain operator-owned deployment tasks; no real mailbox was accessed during development.

## 9. Phase 4 — Privacy-Safe Gemini Classification and Matching

**Tasks**
- [x] Build local company/application matching using trusted sender metadata, known domains, thread associations, company and position references.
- [x] Treat sender domains as signals, not definitive proof; support third-party recruiters and multiple applications per company.
- [x] Build a pre-AI privacy gate that excludes attachments, quoted threads, signatures, secrets, identifiers, and clearly confidential material.
- [x] Automatically redact detected personal information from selected recruitment text and minimize the excerpt.
- [x] Validate the outbound payload against an explicit allowlist and size limits; block uncertain payloads.
- [x] Never log raw or sanitized email bodies, credentials, or API request text.
- [x] Send only permitted sanitized excerpts to Gemini; process requests sequentially with rate limits and a configurable budget.
- [x] Require strict structured responses for email category, proposed status, required action, and deadlines.
- [x] Validate response schema, evidence, event timing, and application match before any automatic update.
- [x] Prevent stale emails from regressing statuses; handle non-linear recruitment processes and closed applications carefully.
- [x] Create `review_items` records for privacy blocks, ambiguous matches, unclear classifications, or conflicting status changes.
- [x] Implement manual review actions: assign application, choose status, edit deadline, ignore, resolve, and open original message in Gmail.
- [x] Record approved automatic changes in history and create dashboard notifications.

**Acceptance criteria:** Interview, assessment, offer, and rejection examples update the correct application; ambiguous or sensitive messages do not call Gemini or change status; unrelated messages are ignored; no raw body is stored.

**Privacy limitation:** Automated sanitization cannot guarantee complete removal of personal or confidential information. Real-email AI processing is a conscious residual-risk decision and must be clearly disclosed in the UI before enabling it.

**Implementation status (15 October 2026):** Complete behind three independent fail-closed release gates. Unit and database tests use synthetic inputs only. Real Gmail-to-Gemini processing remains disabled pending the external provider-policy decision documented in `provider-review.md`.

## 10. Phase 5 — Scheduled Jobs, Follow-ups, and Retention

**Tasks**
- [x] Configure daily Gmail sync at approximately 08:00 Asia/Bangkok (01:00 UTC), subject to actual scheduling support.
- [x] Reuse the same sync logic for the dashboard's **Sync Now** action.
- [x] Generate follow-up suggestions based on last meaningful interaction (suggest at ~14 days, remind at ~21, long-term pending at ~30); never equate silence with rejection.
- [x] Track recruitment deadlines and personal university submission reminders.
- [x] Generate follow-up drafts only on user request; do not send messages automatically.
- [x] Implement monthly cleanup: archive closed applications 6 months after `closed_at`; permanently delete closed applications 12 months after `closed_at` without a confirmation prompt.
- [x] Keep active applications regardless of age; reset/reconcile archival dates if reopened.
- [x] Cascade or explicitly remove dependent records safely; delete short-lived logs on their own schedules.
- [x] Make cleanup and reminder jobs idempotent and auditable without sensitive payloads.
- [x] Handle free-tier project pauses, cron failures, and sync resumption gracefully.

**Acceptance criteria:** Scheduled and manual syncs produce consistent results; reminders are not duplicated; closed records follow retention rules; active records are never age-deleted.

**Implementation status (15 October 2026):** Complete and covered by pgTAP. The hosted Gmail cron template is committed in `supabase/schedules.example.sql`; installing it requires the operator's hosted project and Vault secrets.

## 11. Phase 6 — Testing, Hardening, and Deployment

**Tasks**
- [x] Add unit tests for filtering, redaction, matching, transitions, and retention eligibility.
- [x] Add integration tests for RLS, Edge Functions, and database triggers.
- [x] Add synthetic adversarial emails: prompt injection, forged sender, ambiguous company, sensitive data, quoted threads, and malformed Gemini output.
- [x] Test API failures, token expiry/revocation, partial syncs, rate limits, and duplicate delivery.
- [x] Confirm secret handling, HTTPS, minimal logs, and permission boundaries.
- [x] Review current Google OAuth verification obligations and Gemini API data-use terms before real personal email processing.
- [ ] Deploy frontend to Cloudflare Pages and backend/database to Supabase.
- [ ] Configure production secrets and scheduler credentials outside the repository.
- [ ] Run an end-to-end smoke test with synthetic messages, then limited real-email testing only after privacy review.
- [x] Document deployment, recovery, configuration, and known limitations.

**Acceptance criteria:** Critical security and functional tests pass; no secrets appear in browser bundles or logs; deployed application can recover from sync errors; privacy risks are disclosed.

**Implementation status (15 October 2026):** Source hardening, local Edge startup, 32 function tests, 5 frontend tests, 83 pgTAP assertions, clean schema linting, and deployment/recovery documentation are complete. Cloudflare/Supabase deployment, production secret installation, and provider-backed smoke testing remain intentionally unchecked because they require operator accounts, billing, credentials, compliance decisions, and explicit external-write authorization.

## 12. Suggested Development Backlog

| Priority | Feature | MVP? |
|---|---|---|
| P0 | Authentication, database, RLS, manual CRUD | Yes |
| P0 | Gmail OAuth and new-only synchronization | Yes |
| P0 | Unrelated-email filtering and privacy gate | Yes |
| P0 | Gemini classification with backend validation | Yes |
| P0 | Manual review queue and history | Yes |
| P0 | Idempotency, retries, token protection | Yes |
| P1 | Dashboard, notifications, follow-up reminders | Yes |
| P1 | Monthly archival and deletion | Yes |
| P1 | CSV export and archived view | Yes |
| P2 | Historical Gmail import | Later; configuration prepared |
| P2 | Automatic application creation | No |
| P2 | Browser push or outgoing notification emails | No |
| P2 | LinkedIn integration, mobile app, multi-user support | No |

## 13. Configuration Plan

The following are **illustrative settings**, not proof of privacy or security. The backend must enforce prohibitions regardless of configuration.

```dotenv
# Gmail
GMAIL_INITIAL_SYNC_MODE=new_only
GMAIL_INITIAL_SYNC_DAYS=0
GMAIL_SYNC_ENABLED=true
GMAIL_MAX_MESSAGES_PER_SYNC=50

# Gemini / privacy
AI_EMAIL_ANALYSIS_ENABLED=false
AI_REAL_EMAIL_RISK_ACCEPTED=false

# Follow-ups
FOLLOWUP_SUGGEST_DAYS=14
FOLLOWUP_REMIND_DAYS=21
FOLLOWUP_LONG_PENDING_DAYS=30
```

**Clarification:** There is no raw-body or attachment opt-in. Under the approved Gemini-based approach, raw bodies are prohibited, but limited **sanitized excerpts** may be transmitted after privacy checks and all three release gates pass.

## 14. Definition of Done

A task is complete only when:

- Its functional acceptance criteria pass.
- Input validation, access control, and privacy checks are implemented where relevant.
- Automated tests cover normal and failure paths.
- No credentials or sensitive email content are committed or logged.
- Database migrations are repeatable and documented.
- Any changed architecture or requirement is reflected in the documentation.

## 15. Hosted Release Checks

- Verify current Supabase Free plan limits, scheduled job availability, and Edge Function runtime limits before deployment.
- Reconfirm Gemini data-use terms and rate limits at release time; do not assume free-tier requests are excluded from model improvement.
- Complete Google's Gmail restricted-scope consent and verification requirements for the selected hosted deployment.
- Exercise the implemented privacy gate with synthetic staging fixtures before enabling any real-email AI processing.
- Evaluate whether company/domain mappings need a dedicated table only after synthetic staging and, if authorized, limited real-provider testing reveal a concrete matching gap.

## 16. Related Documents

- `../proposal.md`
- `requirements.md`
- `system-design.md`
- `database-design.md`
- `ai-email-workflow.md`
- `security-design.md`

---

**Next action:** Complete the Phase 6 hosted deployment checklist in `deployment.md`. Keep Gemini disabled until Google/Gemini policy compatibility is confirmed, production secrets are installed, staging tests pass, and the owner explicitly accepts the residual risk.
