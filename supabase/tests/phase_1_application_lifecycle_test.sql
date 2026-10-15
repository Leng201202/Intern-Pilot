begin;
select plan(23);

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner-lifecycle@example.test'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'other-lifecycle@example.test');

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","app_metadata":{"internpilot_owner":true}}',
  true
);
set local role authenticated;

select results_eq(
  $$insert into public.applications (
      id, user_id, company_name, position_title, status, application_date
    ) values (
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'Lifecycle Company',
      'Lifecycle Intern',
      'interested',
      current_date
    ) returning status$$,
  array['interested'::text],
  'the owner creates an active application through browser grants'
);
select ok(
  (
    select closed_at is null and archived_at is null
    from public.applications
    where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
  ),
  'an active application starts without closure or archive timestamps'
);
select is(
  (
    select count(*)::integer
    from public.application_history
    where application_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
  ),
  1,
  'creation writes one immutable initial history entry'
);
select is(
  (
    select old_status
    from public.application_history
    where application_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
  ),
  null::text,
  'the initial history entry has no old status'
);

select results_eq(
  $$update public.applications
      set status = 'accepted'
      where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
      returning status$$,
  array['accepted'::text],
  'the owner can close an application through the allowed status column'
);
select ok(
  (
    select closed_at is not null
    from public.applications
    where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
  ),
  'entering a closed status sets closed_at in the database'
);
select is(
  (
    select count(*)::integer
    from public.application_history
    where application_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
  ),
  2,
  'a genuine status transition appends exactly one history row'
);
select is(
  (
    select change_source
    from public.application_history
    where application_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
      and old_status = 'interested'
      and new_status = 'accepted'
  ),
  'manual'::text,
  'a browser status change is recorded as manual'
);
select is(
  (
    select actor_user_id
    from public.application_history
    where application_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
      and old_status = 'interested'
      and new_status = 'accepted'
  ),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'the history trigger records the authenticated actor'
);

update public.applications
set status = 'accepted'
where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select is(
  (
    select count(*)::integer
    from public.application_history
    where application_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
  ),
  2,
  'writing the same status does not create duplicate history'
);

reset role;
update public.applications
set
  closed_at = now() - interval '7 months',
  archived_at = now() - interval '1 month'
where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","app_metadata":{"internpilot_owner":true}}',
  true
);
set local role authenticated;
select ok(
  (
    select archived_at is not null
    from public.applications
    where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
  ),
  'an archived closed application remains visible to its owner'
);
select results_eq(
  $$update public.applications
      set status = 'applied'
      where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
      returning status$$,
  array['applied'::text],
  'the owner can reopen an archived application'
);
select ok(
  (
    select closed_at is null and archived_at is null
    from public.applications
    where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
  ),
  'reopening atomically clears closure and archive timestamps'
);
select is(
  (
    select count(*)::integer
    from public.application_history
    where application_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
  ),
  3,
  'reopening appends one status-history row'
);
select throws_ok(
  $$update public.applications
      set status = 'waiting'
      where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'$$,
  '23514',
  null,
  'the database rejects an unsupported application status'
);

reset role;
insert into public.applications (
  id,
  user_id,
  company_name,
  position_title,
  status,
  application_date
)
values (
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Delete Company',
  'Delete Intern',
  'rejected',
  current_date
);

insert into public.follow_ups (
  id,
  user_id,
  application_id,
  kind,
  due_at
)
values (
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'reminder',
  now() + interval '1 day'
);

insert into public.notifications (
  id,
  user_id,
  application_id,
  kind,
  title
)
values (
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'application_update',
  'Application updated'
);

insert into public.email_connections (
  id,
  user_id,
  google_account_subject,
  encrypted_refresh_token,
  token_key_version,
  granted_scopes,
  sync_after_at
)
values (
  '12121212-1212-1212-1212-121212121212',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'lifecycle-google-owner',
  decode(repeat('03', 16), 'hex'),
  1,
  array['https://www.googleapis.com/auth/gmail.readonly'],
  now()
);

insert into public.email_events (
  id,
  user_id,
  email_connection_id,
  application_id,
  gmail_message_id,
  processing_status,
  privacy_outcome
)
values (
  '13131313-1313-1313-1313-131313131313',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '12121212-1212-1212-1212-121212121212',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'lifecycle-message',
  'review',
  'blocked'
);

insert into public.review_items (
  id,
  user_id,
  email_event_id,
  application_id,
  reason_code
)
values (
  '14141414-1414-1414-1414-141414141414',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '13131313-1313-1313-1313-131313131313',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'privacy_blocked'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated","app_metadata":{"internpilot_owner":true}}',
  true
);
set local role authenticated;
select is_empty(
  $$delete from public.applications
      where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
      returning id$$,
  'another subject cannot delete the owner application'
);
reset role;
select ok(
  exists (
    select 1
    from public.applications
    where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
  ),
  'the denied delete leaves the application intact'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","app_metadata":{"internpilot_owner":true}}',
  true
);
set local role authenticated;
select results_eq(
  $$delete from public.applications
      where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
      returning id$$,
  array['dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid],
  'the owner can delete their application'
);
reset role;

select is(
  (
    select count(*)::integer
    from public.application_history
    where application_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
  ),
  0,
  'application deletion cascades to immutable status history'
);
select is(
  (
    select count(*)::integer
    from public.follow_ups
    where application_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
  ),
  0,
  'application deletion cascades to follow-ups'
);
select is(
  (
    select count(*)::integer
    from public.notifications
    where id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
  ),
  0,
  'application deletion cascades to linked notifications'
);
select is(
  (
    select application_id
    from public.email_events
    where id = '13131313-1313-1313-1313-131313131313'
  ),
  null::uuid,
  'application deletion retains deduplication metadata without a broken reference'
);
select is(
  (
    select application_id
    from public.review_items
    where id = '14141414-1414-1414-1414-141414141414'
  ),
  null::uuid,
  'application deletion clears the review-item application reference'
);

select * from finish();
rollback;
