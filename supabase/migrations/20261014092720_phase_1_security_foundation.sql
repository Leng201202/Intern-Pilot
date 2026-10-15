-- InternPilot AI Phase 1: database, authentication, and security foundation.
--
-- Browser authorization requires both ownership and the server-managed
-- app_metadata.internpilot_owner claim. Raw email content has no column in
-- this schema and must never be persisted.

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.is_authorized_owner()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and coalesce(
      (select auth.jwt() -> 'app_metadata' ->> 'internpilot_owner') = 'true',
      false
    );
$$;

revoke all on function private.is_authorized_owner() from public, anon;
grant execute on function private.is_authorized_owner() to authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  timezone text not null default 'Asia/Bangkok',
  university_deadline date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length_check
    check (display_name is null or char_length(display_name) <= 200),
  constraint profiles_timezone_length_check
    check (char_length(timezone) between 1 and 100),
  constraint profiles_timestamps_check check (updated_at >= created_at)
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company_name text not null,
  position_title text not null,
  status text not null default 'interested',
  application_date date not null,
  application_deadline date,
  application_method text,
  job_url text,
  location text,
  notes text,
  closed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint applications_owner_id_key unique (user_id, id),
  constraint applications_company_name_check
    check (
      company_name = btrim(company_name)
      and char_length(company_name) between 1 and 200
    ),
  constraint applications_position_title_check
    check (
      position_title = btrim(position_title)
      and char_length(position_title) between 1 and 200
    ),
  constraint applications_status_check
    check (
      status in (
        'interested',
        'applied',
        'assessment',
        'interview',
        'offer',
        'accepted',
        'rejected',
        'withdrawn'
      )
    ),
  constraint applications_application_method_length_check
    check (application_method is null or char_length(application_method) <= 200),
  constraint applications_job_url_length_check
    check (job_url is null or char_length(job_url) <= 2048),
  constraint applications_location_length_check
    check (location is null or char_length(location) <= 300),
  constraint applications_notes_length_check
    check (notes is null or char_length(notes) <= 10000),
  constraint applications_closure_check
    check (
      (
        status in ('accepted', 'rejected', 'withdrawn')
        and closed_at is not null
      )
      or (
        status not in ('accepted', 'rejected', 'withdrawn')
        and closed_at is null
      )
    ),
  constraint applications_archive_check
    check (
      archived_at is null
      or (closed_at is not null and archived_at >= closed_at)
    ),
  constraint applications_timestamps_check check (updated_at >= created_at)
);

create table public.email_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  google_account_subject text not null,
  encrypted_refresh_token bytea not null,
  token_key_version integer not null,
  granted_scopes text[] not null,
  connected_at timestamptz not null default now(),
  last_successful_sync_at timestamptz,
  gmail_history_id text,
  sync_after_at timestamptz not null,
  sync_status text not null default 'connected',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_connections_owner_id_key unique (user_id, id),
  constraint email_connections_user_id_key unique (user_id),
  constraint email_connections_google_subject_key
    unique (user_id, google_account_subject),
  constraint email_connections_google_subject_check
    check (
      google_account_subject = btrim(google_account_subject)
      and char_length(google_account_subject) between 1 and 255
    ),
  constraint email_connections_token_length_check
    check (octet_length(encrypted_refresh_token) >= 16),
  constraint email_connections_key_version_check check (token_key_version > 0),
  constraint email_connections_scopes_check
    check (
      cardinality(granted_scopes) > 0
      and 'https://www.googleapis.com/auth/gmail.readonly' = any (granted_scopes)
    ),
  constraint email_connections_sync_status_check
    check (sync_status in ('connected', 'reauthorization_required', 'disabled')),
  constraint email_connections_timestamps_check check (updated_at >= created_at)
);

create table public.email_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email_connection_id uuid not null,
  application_id uuid,
  gmail_message_id text not null,
  gmail_thread_id text,
  received_at timestamptz,
  email_category text,
  processing_status text not null default 'pending',
  processing_source text,
  privacy_outcome text not null default 'not_evaluated',
  retry_count integer not null default 0,
  next_retry_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint email_events_owner_id_key unique (user_id, id),
  constraint email_events_connection_fkey
    foreign key (user_id, email_connection_id)
    references public.email_connections (user_id, id)
    on delete cascade,
  constraint email_events_application_fkey
    foreign key (user_id, application_id)
    references public.applications (user_id, id)
    on delete set null (application_id),
  constraint email_events_message_key
    unique (email_connection_id, gmail_message_id),
  constraint email_events_message_id_check
    check (
      gmail_message_id = btrim(gmail_message_id)
      and char_length(gmail_message_id) between 1 and 255
    ),
  constraint email_events_thread_id_check
    check (gmail_thread_id is null or char_length(gmail_thread_id) <= 255),
  constraint email_events_category_check
    check (
      email_category is null
      or email_category in (
        'application_confirmation',
        'assessment_invitation',
        'interview_invitation',
        'document_request',
        'application_update',
        'offer',
        'rejection',
        'general_recruitment',
        'unrelated',
        'unknown'
      )
    ),
  constraint email_events_processing_status_check
    check (processing_status in ('pending', 'ignored', 'processed', 'review', 'retry', 'failed')),
  constraint email_events_processing_source_check
    check (processing_source is null or processing_source in ('local_rule', 'gemini', 'manual')),
  constraint email_events_privacy_outcome_check
    check (privacy_outcome in ('not_evaluated', 'allowed', 'blocked', 'not_required')),
  constraint email_events_retry_count_check check (retry_count >= 0)
);

create table public.application_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid not null,
  old_status text,
  new_status text not null,
  change_source text not null,
  email_event_id uuid,
  changed_at timestamptz not null default now(),
  actor_user_id uuid references auth.users (id) on delete set null,
  constraint application_history_application_fkey
    foreign key (user_id, application_id)
    references public.applications (user_id, id)
    on delete cascade,
  constraint application_history_email_event_fkey
    foreign key (user_id, email_event_id)
    references public.email_events (user_id, id)
    on delete set null (email_event_id),
  constraint application_history_old_status_check
    check (
      old_status is null
      or old_status in (
        'interested',
        'applied',
        'assessment',
        'interview',
        'offer',
        'accepted',
        'rejected',
        'withdrawn'
      )
    ),
  constraint application_history_new_status_check
    check (
      new_status in (
        'interested',
        'applied',
        'assessment',
        'interview',
        'offer',
        'accepted',
        'rejected',
        'withdrawn'
      )
    ),
  constraint application_history_change_source_check
    check (change_source in ('manual', 'ai', 'system'))
);

create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid not null,
  kind text not null,
  due_at timestamptz not null,
  state text not null default 'open',
  snoozed_until timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint follow_ups_application_fkey
    foreign key (user_id, application_id)
    references public.applications (user_id, id)
    on delete cascade,
  constraint follow_ups_kind_check
    check (kind in ('suggested', 'reminder', 'long_pending', 'action_deadline')),
  constraint follow_ups_state_check
    check (state in ('open', 'completed', 'snoozed', 'cancelled')),
  constraint follow_ups_snooze_check
    check ((state = 'snoozed') = (snoozed_until is not null)),
  constraint follow_ups_completed_check
    check ((state = 'completed') = (completed_at is not null)),
  constraint follow_ups_timestamps_check check (updated_at >= created_at)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid,
  kind text not null,
  title text not null,
  message text,
  is_read boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_application_fkey
    foreign key (user_id, application_id)
    references public.applications (user_id, id)
    on delete cascade,
  constraint notifications_kind_check
    check (
      kind in (
        'application_update',
        'action_required',
        'follow_up',
        'deadline',
        'sync_issue',
        'review_required'
      )
    ),
  constraint notifications_title_check
    check (title = btrim(title) and char_length(title) between 1 and 200),
  constraint notifications_message_check
    check (message is null or char_length(message) <= 1000)
);

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email_connection_id uuid not null,
  trigger_source text not null,
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  fetched_count integer not null default 0,
  candidate_count integer not null default 0,
  processed_count integer not null default 0,
  review_count integer not null default 0,
  error_code text,
  constraint sync_runs_connection_fkey
    foreign key (user_id, email_connection_id)
    references public.email_connections (user_id, id)
    on delete cascade,
  constraint sync_runs_trigger_source_check
    check (trigger_source in ('manual', 'scheduled')),
  constraint sync_runs_status_check
    check (status in ('running', 'completed', 'partial', 'failed')),
  constraint sync_runs_counts_check
    check (
      fetched_count >= 0
      and candidate_count >= 0
      and processed_count >= 0
      and review_count >= 0
    ),
  constraint sync_runs_error_code_check
    check (error_code is null or char_length(error_code) <= 100),
  constraint sync_runs_finished_at_check
    check (finished_at is null or finished_at >= started_at)
);

create table public.review_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email_event_id uuid not null,
  application_id uuid,
  reason_code text not null,
  state text not null default 'open',
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint review_items_email_event_key unique (email_event_id),
  constraint review_items_email_event_fkey
    foreign key (user_id, email_event_id)
    references public.email_events (user_id, id)
    on delete cascade,
  constraint review_items_application_fkey
    foreign key (user_id, application_id)
    references public.applications (user_id, id)
    on delete set null (application_id),
  constraint review_items_reason_code_check
    check (
      reason_code in (
        'privacy_blocked',
        'ambiguous_match',
        'unknown_outcome',
        'conflicting_status',
        'unmatched_application',
        'sanitization_uncertain'
      )
    ),
  constraint review_items_state_check check (state in ('open', 'resolved', 'dismissed')),
  constraint review_items_resolution_check
    check ((state = 'open') = (resolved_at is null))
);

create index applications_user_status_updated_idx
  on public.applications (user_id, status, updated_at desc);
create index applications_user_deadline_idx
  on public.applications (user_id, application_deadline)
  where application_deadline is not null;
create index applications_archive_candidates_idx
  on public.applications (closed_at)
  where archived_at is null and closed_at is not null;
create index applications_delete_candidates_idx
  on public.applications (closed_at)
  where archived_at is not null;
create index email_events_user_processing_retry_idx
  on public.email_events (user_id, processing_status, next_retry_at);
create index email_events_user_application_idx
  on public.email_events (user_id, application_id)
  where application_id is not null;
create index application_history_user_application_changed_idx
  on public.application_history (user_id, application_id, changed_at desc);
create index application_history_email_event_idx
  on public.application_history (email_event_id)
  where email_event_id is not null;
create index application_history_actor_idx
  on public.application_history (actor_user_id)
  where actor_user_id is not null;
create index follow_ups_user_state_due_idx
  on public.follow_ups (user_id, state, due_at);
create index follow_ups_user_application_idx
  on public.follow_ups (user_id, application_id);
create unique index follow_ups_active_kind_key
  on public.follow_ups (application_id, kind)
  where state in ('open', 'snoozed');
create index notifications_user_read_created_idx
  on public.notifications (user_id, is_read, created_at desc);
create index notifications_user_application_idx
  on public.notifications (user_id, application_id)
  where application_id is not null;
create index sync_runs_user_connection_started_idx
  on public.sync_runs (user_id, email_connection_id, started_at desc);
create index review_items_user_state_created_idx
  on public.review_items (user_id, state, created_at desc);
create index review_items_user_application_idx
  on public.review_items (user_id, application_id)
  where application_id is not null;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.validate_profile_timezone()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = new.timezone
  ) then
    raise exception using
      errcode = '22023',
      message = 'Unsupported timezone';
  end if;

  return new;
end;
$$;

create or replace function private.prepare_application_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status in ('accepted', 'rejected', 'withdrawn') then
      new.closed_at := now();
    else
      new.closed_at := null;
    end if;

    new.archived_at := null;
  elsif old.status is distinct from new.status then
    if new.status in ('accepted', 'rejected', 'withdrawn') then
      if old.status not in ('accepted', 'rejected', 'withdrawn') or old.closed_at is null then
        new.closed_at := now();
      else
        new.closed_at := old.closed_at;
      end if;
    else
      new.closed_at := null;
      new.archived_at := null;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.record_application_status_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into public.application_history (
      user_id,
      application_id,
      old_status,
      new_status,
      change_source,
      actor_user_id
    )
    values (
      new.user_id,
      new.id,
      case when tg_op = 'INSERT' then null else old.status end,
      new.status,
      case when actor_id is null then 'system' else 'manual' end,
      actor_id
    );
  end if;

  return new;
end;
$$;

create or replace function private.prepare_follow_up_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.state = 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
    new.snoozed_until := null;
  elsif new.state = 'snoozed' then
    new.completed_at := null;
  else
    new.completed_at := null;
    new.snoozed_until := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.prepare_review_item_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.state = 'open' then
    new.resolved_at := null;
  else
    new.resolved_at := coalesce(new.resolved_at, now());
  end if;

  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.validate_profile_timezone() from public, anon, authenticated;
revoke all on function private.prepare_application_write() from public, anon, authenticated;
revoke all on function private.record_application_status_history() from public, anon, authenticated;
revoke all on function private.prepare_follow_up_write() from public, anon, authenticated;
revoke all on function private.prepare_review_item_write() from public, anon, authenticated;

create trigger profiles_validate_timezone
before insert or update of timezone on public.profiles
for each row execute function private.validate_profile_timezone();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger applications_prepare_write
before insert or update on public.applications
for each row execute function private.prepare_application_write();

create trigger applications_record_status_history
after insert or update of status on public.applications
for each row execute function private.record_application_status_history();

create trigger email_connections_set_updated_at
before update on public.email_connections
for each row execute function private.set_updated_at();

create trigger follow_ups_prepare_write
before insert or update on public.follow_ups
for each row execute function private.prepare_follow_up_write();

create trigger review_items_prepare_write
before insert or update on public.review_items
for each row execute function private.prepare_review_item_write();

alter table public.profiles enable row level security;
alter table public.applications enable row level security;
alter table public.email_connections enable row level security;
alter table public.email_events enable row level security;
alter table public.application_history enable row level security;
alter table public.follow_ups enable row level security;
alter table public.notifications enable row level security;
alter table public.sync_runs enable row level security;
alter table public.review_items enable row level security;

create policy profiles_select_owner
on public.profiles for select to authenticated
using (
  (select private.is_authorized_owner())
  and user_id = (select auth.uid())
);

create policy profiles_insert_owner
on public.profiles for insert to authenticated
with check (
  (select private.is_authorized_owner())
  and user_id = (select auth.uid())
);

create policy profiles_update_owner
on public.profiles for update to authenticated
using (
  (select private.is_authorized_owner())
  and user_id = (select auth.uid())
)
with check (
  (select private.is_authorized_owner())
  and user_id = (select auth.uid())
);

create policy applications_select_owner
on public.applications for select to authenticated
using (
  (select private.is_authorized_owner())
  and user_id = (select auth.uid())
);

create policy applications_insert_owner
on public.applications for insert to authenticated
with check (
  (select private.is_authorized_owner())
  and user_id = (select auth.uid())
);

create policy applications_update_owner
on public.applications for update to authenticated
using (
  (select private.is_authorized_owner())
  and user_id = (select auth.uid())
)
with check (
  (select private.is_authorized_owner())
  and user_id = (select auth.uid())
);

create policy applications_delete_owner
on public.applications for delete to authenticated
using (
  (select private.is_authorized_owner())
  and user_id = (select auth.uid())
);

create policy email_events_select_owner
on public.email_events for select to authenticated
using (
  (select private.is_authorized_owner())
  and user_id = (select auth.uid())
);

create policy application_history_select_owner
on public.application_history for select to authenticated
using (
  (select private.is_authorized_owner())
  and user_id = (select auth.uid())
);

create policy follow_ups_select_owner
on public.follow_ups for select to authenticated
using (
  (select private.is_authorized_owner())
  and user_id = (select auth.uid())
);

create policy follow_ups_insert_owner
on public.follow_ups for insert to authenticated
with check (
  (select private.is_authorized_owner())
  and user_id = (select auth.uid())
);

create policy follow_ups_update_owner
on public.follow_ups for update to authenticated
using (
  (select private.is_authorized_owner())
  and user_id = (select auth.uid())
)
with check (
  (select private.is_authorized_owner())
  and user_id = (select auth.uid())
);

create policy follow_ups_delete_owner
on public.follow_ups for delete to authenticated
using (
  (select private.is_authorized_owner())
  and user_id = (select auth.uid())
);

create policy notifications_select_owner
on public.notifications for select to authenticated
using (
  (select private.is_authorized_owner())
  and user_id = (select auth.uid())
);

create policy notifications_update_owner
on public.notifications for update to authenticated
using (
  (select private.is_authorized_owner())
  and user_id = (select auth.uid())
)
with check (
  (select private.is_authorized_owner())
  and user_id = (select auth.uid())
);

create policy sync_runs_select_owner
on public.sync_runs for select to authenticated
using (
  (select private.is_authorized_owner())
  and user_id = (select auth.uid())
);

create policy review_items_select_owner
on public.review_items for select to authenticated
using (
  (select private.is_authorized_owner())
  and user_id = (select auth.uid())
);

create policy review_items_update_owner
on public.review_items for update to authenticated
using (
  (select private.is_authorized_owner())
  and user_id = (select auth.uid())
)
with check (
  (select private.is_authorized_owner())
  and user_id = (select auth.uid())
);

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.applications from anon, authenticated;
revoke all on table public.email_connections from anon, authenticated;
revoke all on table public.email_events from anon, authenticated;
revoke all on table public.application_history from anon, authenticated;
revoke all on table public.follow_ups from anon, authenticated;
revoke all on table public.notifications from anon, authenticated;
revoke all on table public.sync_runs from anon, authenticated;
revoke all on table public.review_items from anon, authenticated;

grant select on table public.profiles to authenticated;
grant insert (user_id, display_name, timezone, university_deadline)
  on table public.profiles to authenticated;
grant update (display_name, timezone, university_deadline)
  on table public.profiles to authenticated;

grant select on table public.applications to authenticated;
grant insert (
  id,
  user_id,
  company_name,
  position_title,
  status,
  application_date,
  application_deadline,
  application_method,
  job_url,
  location,
  notes
) on table public.applications to authenticated;
grant update (
  company_name,
  position_title,
  status,
  application_date,
  application_deadline,
  application_method,
  job_url,
  location,
  notes
) on table public.applications to authenticated;
grant delete on table public.applications to authenticated;

grant select on table public.email_events to authenticated;
grant select on table public.application_history to authenticated;

grant select on table public.follow_ups to authenticated;
grant insert (user_id, application_id, kind, due_at, state, snoozed_until)
  on table public.follow_ups to authenticated;
grant update (kind, due_at, state, snoozed_until)
  on table public.follow_ups to authenticated;
grant delete on table public.follow_ups to authenticated;

grant select on table public.notifications to authenticated;
grant update (is_read) on table public.notifications to authenticated;

grant select on table public.sync_runs to authenticated;

grant select on table public.review_items to authenticated;
grant update (state) on table public.review_items to authenticated;

grant all on table public.profiles to service_role;
grant all on table public.applications to service_role;
grant all on table public.email_connections to service_role;
grant all on table public.email_events to service_role;
grant all on table public.application_history to service_role;
grant all on table public.follow_ups to service_role;
grant all on table public.notifications to service_role;
grant all on table public.sync_runs to service_role;
grant all on table public.review_items to service_role;

comment on table public.email_connections is
  'Backend-only Gmail connection metadata. encrypted_refresh_token is ciphertext; browser roles have no table privileges.';
comment on column public.email_connections.encrypted_refresh_token is
  'Authenticated ciphertext only. Encryption keys stay in server-side secret management.';
comment on table public.email_events is
  'Safe structured metadata only. Raw email bodies, subjects, snippets, attachments, prompts, and model responses are prohibited.';
comment on table public.review_items is
  'Manual-review reason codes and safe identifiers only; never stores email content or sanitized excerpts.';
