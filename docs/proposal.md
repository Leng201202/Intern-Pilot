# InternPilot AI — Project Proposal

**Version:** 1.4 (sanitized-excerpt privacy baseline)  
**Project type:** Single-user personal web application  
**Primary use:** Track current internship applications and recruitment email responses  
**Target cost:** $0/month within applicable free-tier quotas  
**Status:** Ready for detailed design

## 1. Overview

InternPilot AI is a personal internship application tracker that combines a web dashboard with Gmail monitoring and privacy-conscious, AI-assisted email analysis. The user registers applications manually. A scheduled process checks Gmail once per day, filters and inspects messages locally, and may ask Gemini to classify a minimized, sanitized recruitment excerpt only after explicit privacy validation. It updates matching applications only when both the AI response and the proposed change pass backend validation. A manual **Sync Emails Now** action supports on-demand checks.

The system also tracks response delays, deadlines, follow-up reminders, and application history. Its initial purpose is to support internship applications for the January–April 2027 placement period. It is designed for one authorized user, fast development, and low operational overhead.

## 2. Problem and Objectives

Internship applications are submitted through different company websites and recruitment systems. Responses arrive by email, sometimes weeks later, and important messages may be mixed with job alerts and unrelated notifications. Manual status tracking is time-consuming and can miss deadlines.

InternPilot AI aims to:

1. Maintain a central record of applications and their current recruitment stages.
2. Identify relevant Gmail messages locally and, when privacy validation permits, use Gemini to classify minimized, sanitized recruitment excerpts.
3. Apply reliable status changes automatically, with a review queue for ambiguous cases.
4. Highlight deadlines, unanswered applications, and follow-up actions.
5. Operate through scheduled serverless jobs without a continuously running personal computer.
6. Stay within free-tier usage where practical and manage stored data through retention rules.

## 3. Scope

### Included in MVP

- Manual creation, editing, viewing, and deletion of internship applications.
- Company, position, application date, deadline, application channel, job URL, notes, and current stage.
- Google sign-in restricted to the owner's account and separate Gmail read authorization.
- Daily Gmail synchronization and an on-demand synchronization button.
- Preliminary filtering of non-recruitment messages, including routine LinkedIn job recommendations and promotional notifications.
- Local relevance filtering and privacy inspection, with Gemini classification of allowlisted, minimized, sanitized recruitment excerpts.
- Automatic updates for sufficiently reliable matches; uncertain results require review.
- Status-change history, relevant email-event metadata, and synchronization history.
- Waiting-period calculations, follow-up reminders, and optional AI-generated follow-up drafts for manual sending.
- Dashboard with active applications, waiting items, needs-attention items, archived records, and recent AI activity.
- Automated archival and deletion of closed applications.

### Excluded from MVP

- Automatic submission of job applications.
- Automatic sending of emails or acceptance of invitations.
- Multi-user accounts, direct LinkedIn integration, browser extension, or native mobile app.
- Automatic creation of applications from confirmation emails (possible later enhancement).
- Predictive hiring scores or complex autonomous agent frameworks.

## 4. Technology Stack

| Layer | Selection | Purpose |
|---|---|---|
| Frontend | React + Vite + TypeScript | Fast single-page dashboard development |
| Styling | Tailwind CSS + shadcn/ui | Reusable UI components |
| Hosting | Cloudflare Pages | Static frontend hosting |
| Database | Supabase PostgreSQL | Structured persistent records |
| Backend | Supabase Edge Functions (TypeScript) | Gmail, Gemini, matching, and sync logic |
| Authentication | Supabase Auth with Google sign-in | Owner-only access |
| Gmail authorization | Google OAuth 2.0 + Gmail API | Read recruitment-related messages |
| AI | Gemini Flash model through Gemini API | Classification of allowlisted, minimized, sanitized recruitment excerpts |
| Scheduling | Supabase Cron | Daily sync and monthly cleanup |
| Authorization | Supabase Row Level Security | Protect private records |
| Development | Git, GitHub, Supabase CLI | Versioning and migrations |

**Architecture:** Serverless application with a React frontend, Supabase database and functions, and external Gmail/Gemini APIs. No dedicated Java server is required.

**Cost assumption:** Free-tier availability, Gemini model quotas, Google OAuth requirements, and Supabase inactivity policies must be checked during setup. A $0 target is not a guarantee of uninterrupted service.

## 5. High-Level Architecture

```text
                         Owner
                           |
                 React/Vite Dashboard
                  (Cloudflare Pages)
                           |
                  Supabase Auth + RLS
                           |
                  Supabase PostgreSQL
                           ^
                           |
             Supabase Edge Functions
                ^                  ^
                |                  |
        Daily Supabase Cron   Manual Sync Button
                |                  |
                +---------+--------+
                          |
                   Gmail API Fetch
                          |
        Deduplicate + Local Pre-filter
                          |
              Local Privacy Inspection
                          |
              Allowlist + Final Validation
                          |
              Gemini API (when permitted)
                          |
             Validate + Match Application
                          |
                Update / Review Queue
                          |
            History + Reminders + Dashboard

        Monthly Supabase Cron --> Archive/Cleanup
```

## 6. Functional Design

### 6.1 Application Management

Application fields include `company_name`, `position`, `applied_at`, `application_deadline`, `application_method`, `job_url`, `status`, `last_meaningful_activity_at`, `notes`, `closed_at`, and `archived_at`.

**Recruitment stages:** `INTERESTED`, `APPLIED`, `ASSESSMENT`, `INTERVIEW`, `OFFER`, `ACCEPTED`, `REJECTED`, and `WITHDRAWN`.

`ACCEPTED`, `REJECTED`, and `WITHDRAWN` are treated as closed stages. Waiting, follow-up due, and action required are **separate communication/action states**, not recruitment stages. A user can manually correct a stage and reopen an application.

### 6.2 Gmail Monitoring

The system retrieves messages since its last reliable synchronization checkpoint. It tracks processed Gmail message IDs so repeated runs do not generate duplicate events. Filters use sender/domain matches, known threads, Gmail metadata, and relevant subject terms. Generic recruiter messages must remain discoverable even without obvious keywords; periodic broader review can reduce false negatives.

LinkedIn job suggestions, social notifications, and marketing emails should normally be ignored before Gemini analysis. A LinkedIn message that contains a meaningful update about an existing application may still be relevant.

### 6.3 Gemini Classification

Gemini never receives a raw email, full body, complete thread, attachment, credential, OAuth token, or known personal or sensitive value. The Edge Function first performs local recruitment filtering, application matching, privacy inspection, sanitization, and minimization. It then constructs a request from an explicit allowlist containing only a short sanitized recruitment excerpt and bounded context fields. If sensitive content cannot be safely removed or sanitization is uncertain, the request is blocked and the email is sent to manual review.

An allowed request may resemble:

```json
{
  "message_excerpt": "Thank you for applying to [COMPANY]. We invite you to interview for the internship role on [DATE].",
  "locale": "en"
}
```

All fields in this payload are generated and validated locally. Automated redaction cannot guarantee anonymity; identifiers or confidential context may evade detection. Uncertain content therefore fails closed. Categories may include application confirmation, assessment invitation, interview invitation, document request, application update, offer, rejection, general recruitment, and unrelated. Gemini output is untrusted and cannot alone authorize a status change. The owner can disable all external AI processing through server-side configuration.

### 6.4 Matching and Safe Updates

The server-side matcher may consider company identity, sender address/domain, position, existing thread identifiers, and known recruitment contacts locally; these identifiers are not sent to Gemini. Updates occur only when the application match, event interpretation, AI response schema, and status transition pass backend validation. Uncertain messages enter a review queue. All updates record their source and previous value without retaining raw email content.

A document request or generic company communication creates an action/event without incorrectly advancing the recruitment stage. A later response can update a previously waiting application. Silence alone never causes automatic rejection. The system must not send email automatically.

### 6.5 Follow-ups

Default configurable thresholds are:

| Time since last meaningful activity | Treatment |
|---|---|
| 0–6 days | Waiting |
| 7–13 days | Continue monitoring |
| 14 days | Suggest follow-up |
| 21 days | Remind if still unanswered |
| 30+ days | Long-term pending, not rejected |

Follow-up recommendations also consider assessment/interview deadlines and any previous follow-up. A local template—or optional Gemini output using only privacy-validated, minimized, sanitized input—may draft wording, but the owner must review and send it manually.

### 6.6 Dashboard

The dashboard includes application counts, stage distribution, upcoming deadlines, waiting applications, actions due, recent automatic updates, a review queue, and sync health. The application list supports search and filtering. An application detail page shows its history and associated email events.

## 7. Scheduled Operations

### 7.1 Daily Email Sync

**Target schedule:** 08:00 Thailand time (01:00 UTC), cron expression `0 1 * * *`.

1. Acquire a sync lock to prevent overlapping scheduled/manual runs.
2. Read the Gmail checkpoint and retrieve new messages.
3. Deduplicate by Gmail message ID.
4. Apply local relevance filtering and application matching using protected metadata.
5. Inspect privacy locally, remove identifiers and sensitive information, minimize the relevant recruitment excerpt, and perform final allowlist validation.
6. If external AI is enabled and the sanitized payload is safe, send only that validated excerpt to Gemini; otherwise queue the email for manual review.
7. Validate AI results, match applications locally, and validate any proposed transition.
8. Update atomically or queue for review.
9. Save email events, status history, actions, and non-sensitive run outcomes.
10. Advance the checkpoint only for safely handled work; retain failures for retry.

The dashboard offers **Sync Emails Now** using the same logic. A sync log records start/end times, number of messages scanned, number sent to Gemini, updates made, and failures. If the service is unavailable for several days, the next successful sync must catch up on unprocessed mail.

**Operational caution:** A once-daily check can delay detection by almost 24 hours. Gmail notifications remain the primary channel for urgent recruiter messages.

### 7.2 Monthly Retention Cleanup

A separate monthly cron job archives or deletes eligible records and removes expired operational logs. Jobs must be idempotent and should record summary results.

## 8. Data Model (Conceptual)

| Entity | Responsibility |
|---|---|
| `profiles` | Authorized owner identity |
| `applications` | Application details, stage, close/archive timestamps |
| `email_connections` | Gmail account metadata and encrypted refresh-token material |
| `email_events` | Gmail message IDs, metadata, classification, application association |
| `application_history` | Auditable application changes |
| `follow_ups` | Due dates, drafts, sent/completed states |
| `notifications` | Dashboard alerts and action reminders |
| `sync_runs` | Execution status and counts |
| `sync_state` | Gmail cursor/checkpoint and recovery state |
| `review_items` | Ambiguous email classifications and proposed updates |

Relationships: one owner has many applications; each application may have many email events, history entries, follow-ups, and notifications. Email events should support an unmatched state pending review. Use UUID keys where appropriate, unique constraints on Gmail message identifiers, foreign keys, and RLS policies.

## 9. Data Retention and Cleanup

**Retention is based on the application's closure date, not its submission date.**

| Data/condition | Rule |
|---|---|
| Active applications | Retain regardless of age |
| Closed applications | Keep normally for the first 6 months |
| Closed applications after 6 months | Automatically archive |
| Archived applications after 12 months from closure | Permanently delete |
| Application history and related email events | Delete with parent application |
| Full email bodies | Local transient processing only when necessary; never send to Gemini or retain in logs |
| Email attachments | Never send to Gemini; attachment ingestion and storage remain outside MVP scope |
| AI processing logs | Delete after 30 days |
| Sync execution logs | Delete after 30 days, while retaining essential sync checkpoints |
| Resolved notifications | Delete after 90 days |
| Gmail credentials | Retain securely only while Gmail is connected |

**Example:** If an application is closed on 30 October 2026, it becomes eligible for archival on 30 April 2027 and permanent deletion on 30 October 2027. Monthly cleanup executes on the next scheduled run after eligibility.

Implementation fields: `closed_at TIMESTAMPTZ`, `archived_at TIMESTAMPTZ`. `archived_at IS NOT NULL` identifies an archived application; a separate boolean is unnecessary. Cleanup must verify that the stage is still closed. Reopening an archived application clears closure/archive timestamps so it cannot be deleted inadvertently. Archived applications are viewable and restorable before deletion. Manual deletion requires confirmation; CSV export is available before records expire.

For late recruiter replies concerning archived applications, the system should flag the event for review and avoid silently creating a duplicate application. The one-year deletion rule remains the default unless the owner reopens the application.

## 10. Security and Privacy

- Restrict sign-in and database access to the single authorized account.
- Separate application sign-in from Gmail authorization and request the minimum Gmail scopes necessary.
- Store Gmail refresh tokens encrypted; keep encryption keys and Gemini API keys in server-side secrets.
- Protect scheduled Edge Function endpoints against unauthorized invocation.
- Use Supabase RLS on personal data and validate all writes server-side.
- Never transmit raw messages, complete bodies, conversations, attachments, personal identifiers, confidential recruitment information, or credentials to Gemini.
- Validate structured model output and maintain audit history for automatic changes.
- Provide Gmail disconnect and credential revocation controls.
- Review Google's current OAuth consent/testing, restricted-scope, and Gemini free-tier data-use requirements before deployment.

### AI Data Privacy and Security

- Gemini must never receive raw Gmail messages, raw subjects, full email bodies, complete conversations, or attachments.
- Sensitive, confidential, and personal information must not be submitted to Gemini, including names, email addresses, phone numbers, student or passport numbers, physical addresses, and confidential recruitment details.
- Only an explicitly allowlisted, minimized, sanitized recruitment excerpt and bounded non-sensitive context may be transmitted. Unknown fields and ambiguous content fail closed.
- Gmail access must use the minimum necessary OAuth permissions. Gmail OAuth tokens, API keys, database credentials, and other secrets remain server-side; Gemini has no direct access to Gmail, Supabase, or the database.
- Privacy validation is enforced by the backend before every external AI request, regardless of frontend behavior. Automated redaction cannot guarantee complete privacy, so residual disclosure risk must be acknowledged and uncertain sanitization must be blocked.
- Every AI response is treated as untrusted and must pass strict schema, application-match, and status-transition validation before application records can change.
- Emails that cannot be processed safely are handled deterministically on the server where possible or placed in a manual review workflow without an automatic status change.
- The user can disable external AI processing through backend configuration; when disabled, no Gemini API request is made.
- Privacy restrictions may reduce automatic classification accuracy and increase manual review. The system must never weaken these restrictions to improve accuracy. Even permitted sanitized excerpts carry residual re-identification or missed-redaction risk, which must be disclosed before live email processing is enabled.

## 11. Cost and Reliability

| Service | Plan / cost goal | Notes |
|---|---|---|
| Supabase | Free / $0 target | Database, Auth, Edge Functions, Cron; project may pause after inactivity |
| Cloudflare Pages | Free / $0 target | Static frontend |
| Gmail API | Within API quotas | Requires OAuth setup |
| Gemini API | Eligible free-tier Flash model | Model-specific limits and data-use terms apply |

Expected scale: one user, tens of applications, one scheduled sync daily, occasional manual syncs, and a small number of AI-analyzed recruitment messages. Bounded batches, deduplication, and lightweight filtering help stay within quotas. A paused project or failed job may interrupt daily monitoring; checkpoints and catch-up processing mitigate data gaps but cannot guarantee continuous operation.

## 12. Implementation Roadmap

| Phase | Work | Completion criterion |
|---|---|---|
| 1. Core tracker | React UI, Supabase schema, RLS, application CRUD | Applications can be created and tracked manually |
| 2. Gmail integration | Google OAuth, token storage, message retrieval, filtering | Relevant messages can be retrieved securely |
| 3. AI updates | Privacy layer, optional Gemini classification of sanitized recruitment excerpts, matching rules, history, review queue | Safe classifications can update correct applications; unsafe or ambiguous cases wait for review |
| 4. Scheduling | Daily cron, manual sync, checkpoints, retries | New mail processes without an open browser |
| 5. Follow-ups | Waiting calculations, reminders, draft generation | Dashboard identifies actions and overdue responses |
| 6. Retention and deployment | Monthly cleanup, export, Cloudflare deployment, testing | Archive/delete lifecycle and deployed MVP work |

## 13. Acceptance Criteria

- Owner can register and edit an application without AI.
- Routine LinkedIn job-alert emails do not create or change application records.
- A clear interview invitation for a known application creates an event and updates the correct stage.
- Ambiguous company/position matches require review instead of automatic modification.
- Repeated processing of the same Gmail message does not duplicate events or updates.
- Daily sync and manual sync use the same processing pipeline and expose run status.
- Failed syncs can resume without skipping unprocessed messages.
- An unanswered application can trigger a follow-up reminder without being labeled rejected.
- Active applications are never deleted solely because they are old.
- Closed applications archive after six months and are deleted after twelve months from closure, subject to the monthly cleanup run.
- Only the authorized user can view application and email metadata.
- Personal identifiers, confidential content, complete email bodies, conversations, and attachments are never sent to Gemini.
- Disabling external AI processing prevents all Gemini requests while local processing and manual review remain available.
- Unsafe or uncertain payloads fail closed, create a manual review item, and produce only non-sensitive diagnostic logs.

## 14. Future Enhancements

Potential future additions include automatic application creation from confirmation emails, job URL extraction, Google Calendar interview integration, browser-based application capture, additional email providers, and richer analytics. These are intentionally deferred until the personal MVP is stable.

---

**Final baseline:** React + Vite + TypeScript, Tailwind CSS/shadcn/ui, Supabase PostgreSQL/Auth/Edge Functions/Cron, Gmail API, Gemini API, and Cloudflare Pages. Daily email synchronization, manual sync, automatic validated status updates, six-month archival, and twelve-month deletion are included in scope.
