begin;
select plan(41);

insert into auth.users (id, email)
values ('31000000-0000-0000-0000-000000000001', 'backend-owner@example.test');

insert into public.email_connections (
  id, user_id, google_account_subject, encrypted_refresh_token,
  token_key_version, granted_scopes, sync_after_at
)
values (
  '31000000-0000-0000-0000-000000000010',
  '31000000-0000-0000-0000-000000000001',
  'synthetic-google-subject',
  decode(repeat('01', 32), 'hex'),
  1,
  array['https://www.googleapis.com/auth/gmail.readonly'],
  now()
);

select ok(
  not has_table_privilege('authenticated', 'public.gmail_oauth_states', 'select'),
  'browser sessions cannot read OAuth state or encrypted PKCE material'
);
select ok(
  not has_table_privilege('authenticated', 'public.sync_leases', 'select'),
  'browser sessions cannot read synchronization leases'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.apply_ai_email_event(uuid,uuid,text,date)',
    'execute'
  ),
  'browser sessions cannot invoke trusted AI status updates'
);
select ok(
  not has_column_privilege('authenticated', 'public.review_items', 'state', 'update'),
  'browser sessions cannot bypass trusted manual-review resolution'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.apply_ai_email_event(uuid,uuid,text,date)',
    'execute'
  ),
  'the trusted backend can invoke validated AI status updates'
);
select throws_ok(
  $$insert into public.applications (
      user_id, company_name, position_title, status, application_date, job_url
    ) values (
      '31000000-0000-0000-0000-000000000001',
      'Unsafe URL Company', 'Intern', 'interested', current_date,
      'javascript:alert(1)'
    )$$,
  '23514',
  null,
  'the database rejects a non-HTTP job URL even when the browser is bypassed'
);

set local role service_role;
select ok(
  public.acquire_sync_lease(
    '31000000-0000-0000-0000-000000000010',
    '31000000-0000-0000-0000-000000000001',
    '31000000-0000-0000-0000-000000000011',
    60
  ),
  'the first synchronization worker acquires a lease'
);
select ok(
  not public.acquire_sync_lease(
    '31000000-0000-0000-0000-000000000010',
    '31000000-0000-0000-0000-000000000001',
    '31000000-0000-0000-0000-000000000012',
    60
  ),
  'an overlapping synchronization worker is rejected'
);
select ok(
  not public.release_sync_lease(
    '31000000-0000-0000-0000-000000000010',
    '31000000-0000-0000-0000-000000000012'
  ),
  'a worker cannot release another worker lease'
);
select ok(
  public.release_sync_lease(
    '31000000-0000-0000-0000-000000000010',
    '31000000-0000-0000-0000-000000000011'
  ),
  'the lease owner can release its lease'
);
reset role;

insert into public.applications (
  id, user_id, company_name, position_title, status, application_date
)
values (
  '31000000-0000-0000-0000-000000000020',
  '31000000-0000-0000-0000-000000000001',
  'Synthetic AI Company',
  'Security Intern',
  'applied',
  current_date
);
insert into public.email_events (
  id, user_id, email_connection_id, application_id, gmail_message_id,
  received_at, processing_status, privacy_outcome
)
values (
  '31000000-0000-0000-0000-000000000021',
  '31000000-0000-0000-0000-000000000001',
  '31000000-0000-0000-0000-000000000010',
  '31000000-0000-0000-0000-000000000020',
  'synthetic-ai-interview',
  now(),
  'pending',
  'allowed'
);

set local role service_role;
select is(
  (public.apply_ai_email_event(
    '31000000-0000-0000-0000-000000000021',
    '31000000-0000-0000-0000-000000000020',
    'interview',
    current_date + 5
  ) ->> 'applied')::boolean,
  true,
  'an allowed, matched, current event applies a supported status'
);
reset role;
select is(
  (select status from public.applications where id = '31000000-0000-0000-0000-000000000020'),
  'interview',
  'the validated AI update changes the matched application'
);
select ok(
  (select processing_status = 'processed' and processing_source = 'gemini'
   from public.email_events where id = '31000000-0000-0000-0000-000000000021'),
  'the source event is marked processed by Gemini'
);
select ok(
  exists (
    select 1 from public.application_history
    where application_id = '31000000-0000-0000-0000-000000000020'
      and email_event_id = '31000000-0000-0000-0000-000000000021'
      and change_source = 'ai'
  ),
  'the AI transition is linked to its event in immutable history'
);
select is(
  (select count(*)::integer from public.notifications
   where application_id = '31000000-0000-0000-0000-000000000020'
     and kind = 'application_update'),
  1,
  'a confirmed automatic update creates one dashboard notification'
);
set local role service_role;
select is(
  public.apply_ai_email_event(
    '31000000-0000-0000-0000-000000000021',
    '31000000-0000-0000-0000-000000000020',
    'interview',
    null
  ) ->> 'reason',
  'event_not_actionable',
  'replaying a processed event is idempotently rejected'
);
reset role;

insert into public.email_events (
  id, user_id, email_connection_id, application_id, gmail_message_id,
  received_at, processing_status, privacy_outcome
)
values
  (
    '31000000-0000-0000-0000-000000000022',
    '31000000-0000-0000-0000-000000000001',
    '31000000-0000-0000-0000-000000000010',
    '31000000-0000-0000-0000-000000000020',
    'synthetic-privacy-blocked', now() + interval '1 minute', 'pending', 'blocked'
  ),
  (
    '31000000-0000-0000-0000-000000000023',
    '31000000-0000-0000-0000-000000000001',
    '31000000-0000-0000-0000-000000000010',
    '31000000-0000-0000-0000-000000000020',
    'synthetic-stale-event', now() - interval '1 day', 'pending', 'allowed'
  ),
  (
    '31000000-0000-0000-0000-000000000024',
    '31000000-0000-0000-0000-000000000001',
    '31000000-0000-0000-0000-000000000010',
    '31000000-0000-0000-0000-000000000020',
    'synthetic-invalid-deadline', now() + interval '2 minutes', 'pending', 'allowed'
  );
set local role service_role;
select is(
  public.apply_ai_email_event(
    '31000000-0000-0000-0000-000000000022',
    '31000000-0000-0000-0000-000000000020',
    'offer', null
  ) ->> 'reason',
  'event_not_actionable',
  'a privacy-blocked event cannot change an application'
);
select is(
  public.apply_ai_email_event(
    '31000000-0000-0000-0000-000000000023',
    '31000000-0000-0000-0000-000000000020',
    'offer', null
  ) ->> 'reason',
  'stale_event',
  'an older event cannot overwrite a newer processed event'
);
select is(
  public.apply_ai_email_event(
    '31000000-0000-0000-0000-000000000024',
    '31000000-0000-0000-0000-000000000020',
    'offer', current_date - 1
  ) ->> 'reason',
  'invalid_deadline',
  'an implausible model deadline cannot update an application'
);
reset role;

insert into public.applications (
  id, user_id, company_name, position_title, status, application_date
)
values (
  '31000000-0000-0000-0000-000000000030',
  '31000000-0000-0000-0000-000000000001',
  'Closed Company', 'Closed Intern', 'rejected', current_date
);
insert into public.email_events (
  id, user_id, email_connection_id, application_id, gmail_message_id,
  received_at, processing_status, privacy_outcome
)
values (
  '31000000-0000-0000-0000-000000000031',
  '31000000-0000-0000-0000-000000000001',
  '31000000-0000-0000-0000-000000000010',
  '31000000-0000-0000-0000-000000000030',
  'synthetic-closed-event', now(), 'pending', 'allowed'
);
set local role service_role;
select is(
  public.apply_ai_email_event(
    '31000000-0000-0000-0000-000000000031',
    '31000000-0000-0000-0000-000000000030',
    'offer', null
  ) ->> 'reason',
  'closed_application',
  'automatic processing never reopens a closed application'
);
reset role;

insert into public.applications (
  id, user_id, company_name, position_title, status, application_date
)
values (
  '31000000-0000-0000-0000-000000000040',
  '31000000-0000-0000-0000-000000000001',
  'Review Company', 'Review Intern', 'applied', current_date
);
insert into public.email_events (
  id, user_id, email_connection_id, gmail_message_id,
  received_at, processing_status, privacy_outcome
)
values (
  '31000000-0000-0000-0000-000000000041',
  '31000000-0000-0000-0000-000000000001',
  '31000000-0000-0000-0000-000000000010',
  'synthetic-review-event', now(), 'review', 'blocked'
);
set local role service_role;
select is(
  (public.queue_review_item(
    '31000000-0000-0000-0000-000000000041',
    '31000000-0000-0000-0000-000000000001',
    'blocked', null, 'privacy_blocked', 'local_rule', null, null
  ) ->> 'created')::boolean,
  true,
  'review metadata and its notification are queued atomically'
);
reset role;
select is(
  (select count(*)::integer from public.notifications
   where kind = 'review_required'
     and user_id = '31000000-0000-0000-0000-000000000001'),
  1,
  'a newly queued review creates exactly one notification'
);
set local role service_role;
select is(
  (public.queue_review_item(
    '31000000-0000-0000-0000-000000000041',
    '31000000-0000-0000-0000-000000000001',
    'blocked', null, 'privacy_blocked', 'local_rule', null, null
  ) ->> 'created')::boolean,
  false,
  're-queuing the same event does not duplicate review metadata or notifications'
);
select is(
  (public.resolve_review_item(
    (select id from public.review_items
     where email_event_id = '31000000-0000-0000-0000-000000000041'),
    '31000000-0000-0000-0000-000000000001',
    'confirm',
    '31000000-0000-0000-0000-000000000040',
    'interview',
    current_date + 3
  ) ->> 'resolved')::boolean,
  true,
  'the owner decision resolves a review through trusted backend logic'
);
reset role;
select ok(
  (select status = 'interview' and application_deadline = current_date + 3
   from public.applications where id = '31000000-0000-0000-0000-000000000040'),
  'review confirmation applies the selected status and deadline'
);
select ok(
  (select application_id = '31000000-0000-0000-0000-000000000040'
      and processing_status = 'processed' and processing_source = 'manual'
   from public.email_events where id = '31000000-0000-0000-0000-000000000041'),
  'review confirmation assigns and completes the event manually'
);
select is(
  (select state from public.review_items
   where email_event_id = '31000000-0000-0000-0000-000000000041'),
  'resolved',
  'the review item records its resolved state'
);
select ok(
  exists (
    select 1 from public.application_history
    where application_id = '31000000-0000-0000-0000-000000000040'
      and email_event_id = '31000000-0000-0000-0000-000000000041'
      and change_source = 'manual'
      and actor_user_id = '31000000-0000-0000-0000-000000000001'
  ),
  'manual review writes actor- and event-linked status history'
);

update public.application_history
set changed_at = now() - interval '31 days'
where application_id = '31000000-0000-0000-0000-000000000040';
update public.email_events
set received_at = now() - interval '31 days'
where id = '31000000-0000-0000-0000-000000000041';
update public.applications
set created_at = now() - interval '31 days'
where id = '31000000-0000-0000-0000-000000000040';
insert into public.profiles (user_id, university_deadline)
values (
  '31000000-0000-0000-0000-000000000001',
  current_date + 4
);
set local role service_role;
select is(
  (public.generate_follow_ups() ->> 'follow_ups_created')::integer,
  1,
  'a long-pending active application gets one follow-up reminder'
);
select is(
  (public.generate_follow_ups() ->> 'follow_ups_created')::integer,
  0,
  'follow-up generation is idempotent'
);
reset role;
select is(
  (select count(*)::integer from public.notifications
   where application_id is null
     and title = 'University internship deadline approaching'),
  1,
  'the university deadline creates one idempotent dashboard reminder'
);
select is(
  (select university_deadline_notified_for from public.profiles
   where user_id = '31000000-0000-0000-0000-000000000001'),
  current_date + 4,
  'the profile records which university deadline was already notified'
);
select ok(
  exists (
    select 1 from public.follow_ups
    where application_id = '31000000-0000-0000-0000-000000000040'
      and kind = 'long_pending' and state = 'open'
  ),
  'silence creates a long-pending indicator without changing status'
);
select is(
  (select count(*)::integer from public.follow_ups
   where application_id = '31000000-0000-0000-0000-000000000040'
     and kind = 'action_deadline'),
  1,
  'an approaching deadline creates one action reminder'
);

insert into public.applications (
  id, user_id, company_name, position_title, status, application_date
)
values
  ('31000000-0000-0000-0000-000000000050', '31000000-0000-0000-0000-000000000001', 'Archive Company', 'Intern', 'rejected', current_date),
  ('31000000-0000-0000-0000-000000000051', '31000000-0000-0000-0000-000000000001', 'Delete Company', 'Intern', 'accepted', current_date),
  ('31000000-0000-0000-0000-000000000052', '31000000-0000-0000-0000-000000000001', 'Active Company', 'Intern', 'applied', current_date);
update public.applications
set closed_at = now() - interval '7 months', archived_at = null
where id = '31000000-0000-0000-0000-000000000050';
update public.applications
set closed_at = now() - interval '13 months', archived_at = now() - interval '7 months'
where id = '31000000-0000-0000-0000-000000000051';
update public.applications
set created_at = now() - interval '2 years'
where id = '31000000-0000-0000-0000-000000000052';

insert into public.sync_runs (
  id, user_id, email_connection_id, trigger_source, status, started_at, finished_at
)
values (
  '31000000-0000-0000-0000-000000000053',
  '31000000-0000-0000-0000-000000000001',
  '31000000-0000-0000-0000-000000000010',
  'scheduled', 'completed', now() - interval '40 days', now() - interval '40 days'
);
insert into public.notifications (
  id, user_id, kind, title, resolved_at, created_at
)
values (
  '31000000-0000-0000-0000-000000000054',
  '31000000-0000-0000-0000-000000000001',
  'sync_issue', 'Synthetic resolved issue', now() - interval '100 days', now() - interval '101 days'
);
insert into public.gmail_oauth_states (
  id, user_id, state_hash, encrypted_code_verifier, redirect_uri,
  created_at, expires_at
)
values (
  '31000000-0000-0000-0000-000000000055',
  '31000000-0000-0000-0000-000000000001',
  repeat('a', 64), decode(repeat('02', 32), 'hex'),
  'https://example.test/oauth/callback',
  now() - interval '2 days 10 minutes',
  now() - interval '2 days'
);

set local role service_role;
select is(
  (public.run_retention_cleanup() ->> 'applications_archived')::integer,
  1,
  'monthly retention archives closed applications after six months'
);
reset role;
select ok(
  (select archived_at is not null from public.applications
   where id = '31000000-0000-0000-0000-000000000050'),
  'the six-month closed application remains archived in place'
);
select ok(
  not exists (select 1 from public.applications where id = '31000000-0000-0000-0000-000000000051'),
  'the twelve-month closed application is permanently deleted'
);
select ok(
  exists (select 1 from public.applications where id = '31000000-0000-0000-0000-000000000052'),
  'an old active application is never deleted by age'
);
select ok(
  not exists (select 1 from public.sync_runs where id = '31000000-0000-0000-0000-000000000053'),
  'completed synchronization diagnostics expire after thirty days'
);
select ok(
  not exists (select 1 from public.notifications where id = '31000000-0000-0000-0000-000000000054'),
  'resolved notifications expire after ninety days'
);
select ok(
  not exists (select 1 from public.gmail_oauth_states where id = '31000000-0000-0000-0000-000000000055'),
  'expired OAuth state material is removed'
);

select * from finish();
rollback;
