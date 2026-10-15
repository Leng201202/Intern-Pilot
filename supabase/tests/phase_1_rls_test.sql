begin;
select plan(19);

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'other@example.test');

insert into public.profiles (user_id, display_name)
values
  ('11111111-1111-1111-1111-111111111111', 'Owner'),
  ('22222222-2222-2222-2222-222222222222', 'Other');

insert into public.applications (
  id,
  user_id,
  company_name,
  position_title,
  status,
  application_date
)
values
  (
    '33333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    'Owner Company',
    'Owner Intern',
    'applied',
    current_date
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    '22222222-2222-2222-2222-222222222222',
    'Other Company',
    'Other Intern',
    'applied',
    current_date
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
values
  (
    '55555555-5555-5555-5555-555555555555',
    '11111111-1111-1111-1111-111111111111',
    'google-owner',
    decode(repeat('01', 16), 'hex'),
    1,
    array['https://www.googleapis.com/auth/gmail.readonly'],
    now()
  ),
  (
    '66666666-6666-6666-6666-666666666666',
    '22222222-2222-2222-2222-222222222222',
    'google-other',
    decode(repeat('02', 16), 'hex'),
    1,
    array['https://www.googleapis.com/auth/gmail.readonly'],
    now()
  );

insert into public.email_events (
  id,
  user_id,
  email_connection_id,
  application_id,
  gmail_message_id
)
values
  (
    '77777777-7777-7777-7777-777777777777',
    '11111111-1111-1111-1111-111111111111',
    '55555555-5555-5555-5555-555555555555',
    '33333333-3333-3333-3333-333333333333',
    'owner-message'
  ),
  (
    '88888888-8888-8888-8888-888888888888',
    '22222222-2222-2222-2222-222222222222',
    '66666666-6666-6666-6666-666666666666',
    '44444444-4444-4444-4444-444444444444',
    'other-message'
  );

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_class
    where oid in (
      'public.profiles'::regclass,
      'public.applications'::regclass,
      'public.email_connections'::regclass,
      'public.email_events'::regclass,
      'public.application_history'::regclass,
      'public.follow_ups'::regclass,
      'public.notifications'::regclass,
      'public.sync_runs'::regclass,
      'public.review_items'::regclass
    )
      and relrowsecurity
  ),
  9,
  'RLS is enabled on all nine public application tables'
);

set local role anon;
select throws_ok(
  $$select * from public.applications$$,
  '42501',
  null,
  'anonymous users have no application table grant'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","app_metadata":{}}',
  true
);
set local role authenticated;
select is_empty(
  $$select id from public.applications$$,
  'a signed-in account without the owner claim reads no applications'
);
select is_empty(
  $$select user_id from public.profiles$$,
  'a signed-in account without the owner claim reads no profile'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","app_metadata":{"internpilot_owner":true}}',
  true
);
set local role authenticated;
select results_eq(
  $$select company_name from public.applications order by company_name$$,
  array['Other Company'::text],
  'an authorized JWT reads only rows owned by its subject'
);
select is_empty(
  $$update public.applications
      set status = 'interview'
      where id = '33333333-3333-3333-3333-333333333333'
      returning id$$,
  'another owner subject cannot update the designated owner row'
);
select results_eq(
  $$select status from public.applications
      where id = '44444444-4444-4444-4444-444444444444'$$,
  array['applied'::text],
  'the denied cross-owner update leaves accessible data intact'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","app_metadata":{"internpilot_owner":true}}',
  true
);
set local role authenticated;
select results_eq(
  $$select company_name from public.applications order by company_name$$,
  array['Owner Company'::text],
  'the designated owner reads only their application'
);
select throws_ok(
  $$select * from public.email_connections$$,
  '42501',
  null,
  'the browser cannot read encrypted Gmail token records'
);
select results_eq(
  $$select gmail_message_id from public.email_events order by gmail_message_id$$,
  array['owner-message'::text],
  'the owner reads only their safe email-event metadata'
);
select results_eq(
  $$insert into public.applications (
      id, user_id, company_name, position_title, status, application_date
    ) values (
      '99999999-9999-9999-9999-999999999999',
      '11111111-1111-1111-1111-111111111111',
      'New Company',
      'New Intern',
      'interested',
      current_date
    ) returning id$$,
  array['99999999-9999-9999-9999-999999999999'::uuid],
  'the designated owner can create their own application'
);
select throws_ok(
  $$insert into public.applications (
      user_id, company_name, position_title, status, application_date
    ) values (
      '22222222-2222-2222-2222-222222222222',
      'Stolen Company',
      'Stolen Intern',
      'interested',
      current_date
    )$$,
  '42501',
  null,
  'the owner cannot create an application for another subject'
);
select throws_ok(
  $$update public.applications
      set user_id = '22222222-2222-2222-2222-222222222222'
      where id = '33333333-3333-3333-3333-333333333333'$$,
  '42501',
  null,
  'the browser cannot alter application ownership'
);
select throws_ok(
  $$update public.applications
      set closed_at = now()
      where id = '33333333-3333-3333-3333-333333333333'$$,
  '42501',
  null,
  'the browser cannot alter the protected closure timestamp'
);
select throws_ok(
  $$update public.applications
      set archived_at = now()
      where id = '33333333-3333-3333-3333-333333333333'$$,
  '42501',
  null,
  'the browser cannot alter the protected archive timestamp'
);
select throws_ok(
  $$insert into public.application_history (
      user_id, application_id, old_status, new_status, change_source
    ) values (
      '11111111-1111-1111-1111-111111111111',
      '33333333-3333-3333-3333-333333333333',
      'applied',
      'offer',
      'ai'
    )$$,
  '42501',
  null,
  'the browser cannot forge application history or AI provenance'
);
select throws_ok(
  $$insert into public.email_events (
      user_id, email_connection_id, gmail_message_id
    ) values (
      '11111111-1111-1111-1111-111111111111',
      '55555555-5555-5555-5555-555555555555',
      'forged-message'
    )$$,
  '42501',
  null,
  'the browser cannot forge email processing events'
);
select throws_ok(
  $$insert into public.notifications (user_id, kind, title)
    values (
      '11111111-1111-1111-1111-111111111111',
      'application_update',
      'Forged notification'
    )$$,
  '42501',
  null,
  'the browser cannot create system notifications'
);
select results_eq(
  $$select display_name from public.profiles$$,
  array['Owner'::text],
  'the owner reads only their profile'
);

select * from finish();
rollback;
