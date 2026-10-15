-- InternPilot AI Phases 3-5: OAuth state, sync leases, trusted email updates,
-- review resolution, reminders, and retention. No email text is stored here.

create table public.gmail_oauth_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  state_hash text not null unique,
  encrypted_code_verifier bytea not null,
  redirect_uri text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint gmail_oauth_states_hash_check
    check (state_hash ~ '^[a-f0-9]{64}$'),
  constraint gmail_oauth_states_verifier_check
    check (octet_length(encrypted_code_verifier) >= 28),
  constraint gmail_oauth_states_redirect_check
    check (char_length(redirect_uri) between 10 and 2048),
  constraint gmail_oauth_states_expiry_check
    check (expires_at > created_at and expires_at <= created_at + interval '15 minutes'),
  constraint gmail_oauth_states_used_check
    check (used_at is null or used_at >= created_at)
);

create table public.sync_leases (
  email_connection_id uuid primary key references public.email_connections (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  lease_token uuid not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint sync_leases_connection_owner_fkey
    foreign key (user_id, email_connection_id)
    references public.email_connections (user_id, id)
    on delete cascade,
  constraint sync_leases_expiry_check check (expires_at > created_at)
);

alter table public.profiles
  add column ai_risk_acknowledged_at timestamptz,
  add column university_deadline_notified_for date;

alter table public.email_connections
  add column recovery_page_token text,
  add column recovery_history_id text,
  add constraint email_connections_recovery_page_token_check
    check (recovery_page_token is null or char_length(recovery_page_token) <= 2048),
  add constraint email_connections_recovery_history_id_check
    check (recovery_history_id is null or char_length(recovery_history_id) <= 255);

alter table public.applications
  add constraint applications_job_url_protocol_check
  check (job_url is null or job_url ~* '^https?://[^[:space:]]+$');

alter table public.follow_ups
  add column source_activity_at timestamptz;

alter table public.review_items
  add column suggested_status text,
  add column suggested_deadline date;

alter table public.review_items
  add constraint review_items_suggested_status_check
  check (
    suggested_status is null
    or suggested_status in (
      'interested', 'applied', 'assessment', 'interview',
      'offer', 'accepted', 'rejected', 'withdrawn'
    )
  );

alter table public.review_items
  drop constraint review_items_reason_code_check;

alter table public.review_items
  add constraint review_items_reason_code_check
  check (
    reason_code in (
      'privacy_blocked',
      'ambiguous_match',
      'unknown_outcome',
      'conflicting_status',
      'unmatched_application',
      'sanitization_uncertain',
      'invalid_ai_response',
      'stale_event',
      'ai_disabled',
      'provider_unavailable'
    )
  );

create index gmail_oauth_states_expiry_idx
  on public.gmail_oauth_states (expires_at)
  where used_at is null;
create index sync_leases_expiry_idx on public.sync_leases (expires_at);
create unique index follow_ups_generated_activity_key
  on public.follow_ups (application_id, kind, source_activity_at)
  where source_activity_at is not null;

alter table public.gmail_oauth_states enable row level security;
alter table public.sync_leases enable row level security;

revoke all on table public.gmail_oauth_states from public, anon, authenticated;
revoke all on table public.sync_leases from public, anon, authenticated;
revoke update (state) on table public.review_items from authenticated;
drop policy if exists review_items_update_owner on public.review_items;
grant all on table public.gmail_oauth_states to service_role;
grant all on table public.sync_leases to service_role;

grant insert (ai_risk_acknowledged_at) on table public.profiles to authenticated;
grant update (ai_risk_acknowledged_at) on table public.profiles to authenticated;

comment on table public.gmail_oauth_states is
  'Short-lived backend-only OAuth state hashes and encrypted PKCE verifiers. Plain state and verifier values are never stored.';
comment on table public.sync_leases is
  'Backend-only expiring leases preventing overlapping Gmail synchronization.';
comment on column public.profiles.ai_risk_acknowledged_at is
  'Records acknowledgement of residual sanitization risk; it never overrides backend privacy prohibitions.';
comment on column public.follow_ups.source_activity_at is
  'Backend-generated idempotency key for a reminder activity window.';

create or replace function private.record_application_status_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_actor uuid := (select auth.uid());
  trusted_source text := nullif(current_setting('internpilot.change_source', true), '');
  trusted_actor_text text := nullif(current_setting('internpilot.actor_user_id', true), '');
  trusted_event_text text := nullif(current_setting('internpilot.email_event_id', true), '');
  history_source text;
  history_actor uuid;
  history_event uuid;
begin
  if tg_op <> 'INSERT' and old.status is not distinct from new.status then
    return new;
  end if;

  if session_actor is not null then
    history_source := 'manual';
    history_actor := session_actor;
    history_event := null;
  else
    history_source := case
      when trusted_source in ('ai', 'manual', 'system') then trusted_source
      else 'system'
    end;
    history_actor := case
      when trusted_actor_text is not null then trusted_actor_text::uuid
      else null
    end;
    history_event := case
      when trusted_event_text is not null then trusted_event_text::uuid
      else null
    end;
  end if;

  insert into public.application_history (
    user_id,
    application_id,
    old_status,
    new_status,
    change_source,
    email_event_id,
    actor_user_id
  )
  values (
    new.user_id,
    new.id,
    case when tg_op = 'INSERT' then null else old.status end,
    new.status,
    history_source,
    history_event,
    history_actor
  );

  return new;
end;
$$;

revoke all on function private.record_application_status_history() from public, anon, authenticated;

create or replace function public.acquire_sync_lease(
  p_email_connection_id uuid,
  p_user_id uuid,
  p_lease_token uuid,
  p_lease_seconds integer default 300
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  acquired uuid;
begin
  if p_lease_seconds < 30 or p_lease_seconds > 600 then
    raise exception using errcode = '22023', message = 'Invalid lease duration';
  end if;

  insert into public.sync_leases (
    email_connection_id,
    user_id,
    lease_token,
    expires_at
  )
  values (
    p_email_connection_id,
    p_user_id,
    p_lease_token,
    now() + make_interval(secs => p_lease_seconds)
  )
  on conflict (email_connection_id) do update
  set
    user_id = excluded.user_id,
    lease_token = excluded.lease_token,
    expires_at = excluded.expires_at,
    created_at = now()
  where public.sync_leases.expires_at <= now()
  returning lease_token into acquired;

  return coalesce(acquired = p_lease_token, false);
end;
$$;

create or replace function public.release_sync_lease(
  p_email_connection_id uuid,
  p_lease_token uuid
)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  with removed as (
    delete from public.sync_leases
    where email_connection_id = p_email_connection_id
      and lease_token = p_lease_token
    returning 1
  )
  select exists (select 1 from removed);
$$;

create or replace function public.apply_ai_email_event(
  p_email_event_id uuid,
  p_application_id uuid,
  p_new_status text,
  p_deadline date default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  event_row public.email_events%rowtype;
  app_row public.applications%rowtype;
  newest_processed_at timestamptz;
  previous_source text := current_setting('internpilot.change_source', true);
  previous_event text := current_setting('internpilot.email_event_id', true);
begin
  select * into event_row
  from public.email_events
  where id = p_email_event_id
  for update;

  if not found or event_row.application_id is distinct from p_application_id then
    return jsonb_build_object('applied', false, 'reason', 'invalid_event_match');
  end if;

  if event_row.privacy_outcome <> 'allowed'
     or event_row.processing_status not in ('pending', 'retry') then
    return jsonb_build_object('applied', false, 'reason', 'event_not_actionable');
  end if;

  select * into app_row
  from public.applications
  where id = p_application_id
    and user_id = event_row.user_id
  for update;

  if not found or app_row.status in ('accepted', 'rejected', 'withdrawn') then
    return jsonb_build_object('applied', false, 'reason', 'closed_application');
  end if;

  select max(received_at) into newest_processed_at
  from public.email_events
  where application_id = p_application_id
    and processing_status = 'processed'
    and id <> p_email_event_id;

  if event_row.received_at is null
     or (newest_processed_at is not null and event_row.received_at < newest_processed_at) then
    return jsonb_build_object('applied', false, 'reason', 'stale_event');
  end if;

  if p_new_status not in ('applied', 'assessment', 'interview', 'offer', 'rejected') then
    return jsonb_build_object('applied', false, 'reason', 'unsupported_status');
  end if;

  if p_deadline is not null and (
    p_deadline < (event_row.received_at at time zone 'UTC')::date
    or p_deadline > current_date + 730
  ) then
    return jsonb_build_object('applied', false, 'reason', 'invalid_deadline');
  end if;

  if (p_new_status = 'applied' and app_row.status <> 'interested')
     or (app_row.status = 'offer' and p_new_status <> 'rejected')
     or (app_row.status = 'interview' and p_new_status = 'applied')
     or (app_row.status = 'assessment' and p_new_status = 'applied') then
    return jsonb_build_object('applied', false, 'reason', 'conflicting_status');
  end if;

  perform set_config('internpilot.change_source', 'ai', true);
  perform set_config('internpilot.email_event_id', p_email_event_id::text, true);

  update public.applications
  set
    status = p_new_status,
    application_deadline = coalesce(p_deadline, application_deadline)
  where id = p_application_id;

  perform set_config('internpilot.change_source', coalesce(previous_source, ''), true);
  perform set_config('internpilot.email_event_id', coalesce(previous_event, ''), true);

  update public.email_events
  set
    processing_status = 'processed',
    processing_source = 'gemini',
    processed_at = now(),
    next_retry_at = null
  where id = p_email_event_id;

  insert into public.notifications (user_id, application_id, kind, title, message)
  values (
    event_row.user_id,
    p_application_id,
    'application_update',
    'Application status updated',
    'A validated recruitment email updated this application.'
  );

  return jsonb_build_object('applied', true, 'reason', 'updated');
end;
$$;

create or replace function public.resolve_review_item(
  p_review_item_id uuid,
  p_user_id uuid,
  p_action text,
  p_application_id uuid default null,
  p_status text default null,
  p_deadline date default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  review_row public.review_items%rowtype;
  previous_source text := current_setting('internpilot.change_source', true);
  previous_actor text := current_setting('internpilot.actor_user_id', true);
  previous_event text := current_setting('internpilot.email_event_id', true);
begin
  if p_action not in ('confirm', 'dismiss', 'resolve') then
    raise exception using errcode = '22023', message = 'Invalid review action';
  end if;

  select * into review_row
  from public.review_items
  where id = p_review_item_id
    and user_id = p_user_id
  for update;

  if not found or review_row.state <> 'open' then
    return jsonb_build_object('resolved', false, 'reason', 'not_open');
  end if;

  if p_action = 'confirm' then
    if p_application_id is null or p_status is null then
      raise exception using errcode = '22023', message = 'Application and status are required';
    end if;

    if not exists (
      select 1 from public.applications
      where id = p_application_id and user_id = p_user_id
    ) then
      raise exception using errcode = '42501', message = 'Application ownership check failed';
    end if;

    perform set_config('internpilot.change_source', 'manual', true);
    perform set_config('internpilot.actor_user_id', p_user_id::text, true);
    perform set_config('internpilot.email_event_id', review_row.email_event_id::text, true);

    update public.applications
    set
      status = p_status,
      application_deadline = coalesce(p_deadline, application_deadline)
    where id = p_application_id and user_id = p_user_id;

    perform set_config('internpilot.change_source', coalesce(previous_source, ''), true);
    perform set_config('internpilot.actor_user_id', coalesce(previous_actor, ''), true);
    perform set_config('internpilot.email_event_id', coalesce(previous_event, ''), true);

    update public.email_events
    set
      application_id = p_application_id,
      processing_status = 'processed',
      processing_source = 'manual',
      processed_at = now(),
      next_retry_at = null
    where id = review_row.email_event_id and user_id = p_user_id;
  else
    update public.email_events
    set
      processing_status = case when p_action = 'dismiss' then 'ignored' else 'processed' end,
      processing_source = 'manual',
      processed_at = now(),
      next_retry_at = null
    where id = review_row.email_event_id and user_id = p_user_id;
  end if;

  update public.review_items
  set
    application_id = coalesce(p_application_id, application_id),
    state = case when p_action = 'dismiss' then 'dismissed' else 'resolved' end
  where id = p_review_item_id;

  return jsonb_build_object('resolved', true, 'reason', p_action);
end;
$$;

create or replace function public.queue_review_item(
  p_email_event_id uuid,
  p_user_id uuid,
  p_privacy_outcome text,
  p_application_id uuid,
  p_reason_code text,
  p_processing_source text,
  p_suggested_status text default null,
  p_suggested_deadline date default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  inserted_review_id uuid;
begin
  if p_privacy_outcome not in ('allowed', 'blocked')
     or p_processing_source not in ('local_rule', 'gemini') then
    raise exception using errcode = '22023', message = 'Invalid review metadata';
  end if;

  if not exists (
    select 1 from public.email_events
    where id = p_email_event_id and user_id = p_user_id
    for update
  ) then
    raise exception using errcode = '42501', message = 'Email event ownership check failed';
  end if;

  if p_application_id is not null and not exists (
    select 1 from public.applications
    where id = p_application_id and user_id = p_user_id
  ) then
    raise exception using errcode = '42501', message = 'Application ownership check failed';
  end if;

  update public.email_events
  set
    application_id = p_application_id,
    processing_status = 'review',
    processing_source = p_processing_source,
    privacy_outcome = p_privacy_outcome,
    processed_at = now(),
    next_retry_at = null
  where id = p_email_event_id;

  insert into public.review_items (
    user_id,
    email_event_id,
    application_id,
    reason_code,
    suggested_status,
    suggested_deadline,
    state
  )
  values (
    p_user_id,
    p_email_event_id,
    p_application_id,
    p_reason_code,
    p_suggested_status,
    p_suggested_deadline,
    'open'
  )
  on conflict (email_event_id) do nothing
  returning id into inserted_review_id;

  if inserted_review_id is not null then
    insert into public.notifications (
      user_id, application_id, kind, title, message
    )
    values (
      p_user_id,
      p_application_id,
      'review_required',
      'Recruitment email needs review',
      'Open the review queue to decide how this message should be handled.'
    );
  end if;

  return jsonb_build_object(
    'queued', true,
    'created', inserted_review_id is not null
  );
end;
$$;

create or replace function public.generate_follow_ups(
  p_suggest_days integer default 14,
  p_remind_days integer default 21,
  p_long_pending_days integer default 30
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  inserted_count integer := 0;
  deadline_count integer := 0;
  university_count integer := 0;
begin
  if p_suggest_days < 1
     or p_remind_days <= p_suggest_days
     or p_long_pending_days <= p_remind_days then
    raise exception using errcode = '22023', message = 'Invalid follow-up thresholds';
  end if;

  with application_activity as (
    select
      a.id,
      a.user_id,
      greatest(
        a.created_at,
        coalesce((
          select max(h.changed_at)
          from public.application_history h
          where h.application_id = a.id
        ), a.created_at),
        coalesce((
          select max(e.received_at)
          from public.email_events e
          where e.application_id = a.id
            and e.processing_status in ('processed', 'review')
        ), a.created_at)
      ) as activity_at
    from public.applications a
    where a.status in ('applied', 'assessment', 'interview', 'offer')
  ), latest_activity as (
    select
      id,
      user_id,
      activity_at,
      extract(day from now() - activity_at)::integer as waiting_days
    from application_activity
  ), candidates as (
    select
      id,
      user_id,
      activity_at,
      case
        when waiting_days >= p_long_pending_days then 'long_pending'
        when waiting_days >= p_remind_days then 'reminder'
        when waiting_days >= p_suggest_days then 'suggested'
      end as kind
    from latest_activity
    where waiting_days >= p_suggest_days
  ), inserted as (
    insert into public.follow_ups (
      user_id, application_id, kind, due_at, source_activity_at
    )
    select user_id, id, kind, now(), activity_at
    from candidates
    where kind is not null
    on conflict do nothing
    returning user_id, application_id, kind
  ), notified as (
    insert into public.notifications (user_id, application_id, kind, title, message)
    select
      user_id,
      application_id,
      'follow_up',
      'Follow-up suggested',
      'This active application has had no recent status activity.'
    from inserted
    returning 1
  )
  select count(*) into inserted_count from notified;

  with inserted_deadlines as (
    insert into public.follow_ups (
      user_id, application_id, kind, due_at, source_activity_at
    )
    select
      user_id,
      id,
      'action_deadline',
      application_deadline::timestamptz,
      application_deadline::timestamptz
    from public.applications
    where status not in ('accepted', 'rejected', 'withdrawn')
      and application_deadline between current_date and current_date + 7
    on conflict do nothing
    returning user_id, application_id
  ), notified as (
    insert into public.notifications (user_id, application_id, kind, title, message)
    select
      user_id,
      application_id,
      'deadline',
      'Application deadline approaching',
      'An application deadline is due within seven days.'
    from inserted_deadlines
    returning 1
  )
  select count(*) into deadline_count from notified;

  with due_profiles as (
    update public.profiles
    set university_deadline_notified_for = university_deadline
    where university_deadline between current_date and current_date + 7
      and university_deadline_notified_for is distinct from university_deadline
    returning user_id
  ), notified as (
    insert into public.notifications (user_id, kind, title, message)
    select
      user_id,
      'deadline',
      'University internship deadline approaching',
      'Your university internship submission deadline is due within seven days.'
    from due_profiles
    returning 1
  )
  select count(*) into university_count from notified;

  return jsonb_build_object(
    'follow_ups_created', inserted_count,
    'deadline_reminders_created', deadline_count,
    'university_deadline_reminders_created', university_count
  );
end;
$$;

create or replace function public.run_retention_cleanup()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  archived_count integer;
  deleted_count integer;
  sync_runs_deleted integer;
  notifications_deleted integer;
  oauth_states_deleted integer;
begin
  update public.applications
  set archived_at = now()
  where status in ('accepted', 'rejected', 'withdrawn')
    and closed_at <= now() - interval '6 months'
    and archived_at is null;
  get diagnostics archived_count = row_count;

  delete from public.applications
  where status in ('accepted', 'rejected', 'withdrawn')
    and closed_at <= now() - interval '12 months'
    and archived_at is not null;
  get diagnostics deleted_count = row_count;

  delete from public.sync_runs
  where status <> 'running'
    and finished_at < now() - interval '30 days';
  get diagnostics sync_runs_deleted = row_count;

  delete from public.notifications
  where resolved_at < now() - interval '90 days';
  get diagnostics notifications_deleted = row_count;

  delete from public.gmail_oauth_states
  where expires_at < now() - interval '1 day' or used_at is not null;
  get diagnostics oauth_states_deleted = row_count;

  delete from public.sync_leases where expires_at <= now();

  return jsonb_build_object(
    'applications_archived', archived_count,
    'applications_deleted', deleted_count,
    'sync_runs_deleted', sync_runs_deleted,
    'notifications_deleted', notifications_deleted,
    'oauth_states_deleted', oauth_states_deleted
  );
end;
$$;

revoke all on function public.acquire_sync_lease(uuid, uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.release_sync_lease(uuid, uuid) from public, anon, authenticated;
revoke all on function public.apply_ai_email_event(uuid, uuid, text, date) from public, anon, authenticated;
revoke all on function public.resolve_review_item(uuid, uuid, text, uuid, text, date) from public, anon, authenticated;
revoke all on function public.queue_review_item(uuid, uuid, text, uuid, text, text, text, date) from public, anon, authenticated;
revoke all on function public.generate_follow_ups(integer, integer, integer) from public, anon, authenticated;
revoke all on function public.run_retention_cleanup() from public, anon, authenticated;

grant execute on function public.acquire_sync_lease(uuid, uuid, uuid, integer) to service_role;
grant execute on function public.release_sync_lease(uuid, uuid) to service_role;
grant execute on function public.apply_ai_email_event(uuid, uuid, text, date) to service_role;
grant execute on function public.resolve_review_item(uuid, uuid, text, uuid, text, date) to service_role;
grant execute on function public.queue_review_item(uuid, uuid, text, uuid, text, text, text, date) to service_role;
grant execute on function public.generate_follow_ups(integer, integer, integer) to service_role;
grant execute on function public.run_retention_cleanup() to service_role;

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'internpilot-follow-ups-daily',
  '15 1 * * *',
  $$select public.generate_follow_ups();$$
);

select cron.schedule(
  'internpilot-retention-monthly',
  '30 1 1 * *',
  $$select public.run_retention_cleanup();$$
);
