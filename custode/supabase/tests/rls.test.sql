-- Test delle regole di sicurezza: eseguire con scripts/test-db.sh
\set ON_ERROR_STOP 1
insert into auth.users values ('00000000-0000-0000-0000-00000000000a'),('00000000-0000-0000-0000-00000000000b'),('00000000-0000-0000-0000-00000000000c'),
  ('00000000-0000-0000-0000-00000000000d'),('00000000-0000-0000-0000-00000000000e');
-- Codici creati dall'amministratore (SQL editor)
select admin_create_licenses('group', 7, 1, 1) as glic \gset
select admin_create_licenses('private', 7, 1, 1) as plic \gset
select admin_create_licenses('agency', 365, 25, 1, group_slots => 1, group_days => 5) as alic \gset
select admin_create_licenses('group', 3, 10, 1) as rlic \gset
select :'glic' ~ '^CUST-[A-Z2-9]{4}-[A-Z2-9]{4}$' as code_format;
set role authenticated;
do $$ begin
  perform admin_create_licenses('private', 7, 1, 1);
  raise exception 'FAIL: users can create licenses' using errcode = 'XX000';
exception when insufficient_privilege then null; end $$;
-- Leader A crea il gruppo
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into profiles (id, display_name, role) values (auth.uid(), 'Marco', 'leader');
select code as gcode from create_group('Parrocchia San Luca', :'glic') \gset
select set_config('my.rlic', :'rlic', false), set_config('my.gcode', :'gcode', false), set_config('my.glic', :'glic', false), set_config('my.plic', :'plic', false), set_config('my.alic', :'alic', false);
do $$ begin
  update groups set license_id = null;
  raise exception 'FAIL: leader changed license' using errcode = 'XX000';
exception when insufficient_privilege then null; end $$;
insert into plans (owner_id, group_id, title) select auth.uid(), id, 'Oggi' from groups returning id as planid \gset
insert into plan_stops (plan_id, position, time, place_id) values (:'planid', 0, '08:30', 'hotel');
insert into documents (id, owner_id, kind, ciphertext, iv) values (gen_random_uuid(), auth.uid(), 'passport', 'xx', 'yy');
insert into push_subscriptions (endpoint, user_id, p256dh, auth) values ('https://push.example/a', auth.uid(), 'k', 'a');
-- Membro B entra col codice
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into profiles (id, display_name, role) values (auth.uid(), 'Giulia', 'member');
select seats_left = 1 as one_seat_left from preview_group(:'gcode');
select count(*) = 0 as b_no_plan_before_publish from plans; -- non ancora pubblicato
select group_name from join_group(:'gcode');
select count(*) = 1 as b_sees_group from groups;
select count(*) = 0 as b_unpublished_hidden from plans;
select count(*) = 0 as b_no_docs_of_a from documents;
select count(*) = 2 as b_sees_profiles from profiles;
insert into live_locations (user_id, group_id, lat, lng) select auth.uid(), id, 41.9, 12.45 from groups;
-- B non puo pubblicare messaggi di gruppo ne modificare il programma
do $$ begin
  begin insert into alerts (group_id, sender_id, kind) select id, auth.uid(), 'message' from groups; raise exception 'FAIL: member sent message';
  exception when insufficient_privilege then null; end;
end $$;
insert into alerts (group_id, sender_id, kind, distance_m) select id, auth.uid(), 'out_of_zone', 240 from groups;
update groups set radius_m = 999; -- deve toccare 0 righe
-- A pubblica e vede B
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select radius_m = 150 as radius_unchanged from groups;
update plans set published_at = now();
select count(*) = 1 as a_sees_b_location from live_locations;
select count(*) = 1 as a_sees_alert from alerts;
-- B ora vede il programma pubblicato ma non puo cambiarlo
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select count(*) = 1 as b_sees_published from plans;
select count(*) = 1 as b_sees_stops from plan_stops;
update plan_stops set time = '23:00';
-- C e un estraneo: non vede nulla
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select (select count(*) from groups) + (select count(*) from plans) + (select count(*) from plan_stops) + (select count(*) from live_locations)
  + (select count(*) from alerts) + (select count(*) from documents) + (select count(*) from profiles) = 0 as stranger_sees_nothing;
select count(*) = 0 as stranger_no_push from push_subscriptions;
select count(*) > 0 as places_public from places;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select time = '08:30' as stop_unchanged from plan_stops;

-- ── pacchetti ──
-- C: il gruppo ha 1 posto, gia preso da B; il codice del gruppo non si riusa
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  perform * from join_group(current_setting('my.gcode'));
  raise exception 'FAIL: group full not enforced' using errcode = 'XX000';
exception when sqlstate 'P0001' then if sqlerrm <> 'group full' then raise; end if; end $$;
do $$ begin
  perform create_group('Altro', current_setting('my.glic'));
  raise exception 'FAIL: group license reused' using errcode = 'XX000';
exception when sqlstate 'P0001' then if sqlerrm <> 'license used' then raise; end if; end $$;
select has_access() = false as stranger_no_access;

-- D: pacchetto privato da 7 giorni
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
insert into profiles (id, display_name, role) values (auth.uid(), 'Ana', 'solo');
select kind = 'private' and expires_at > now() + interval '6 days 23 hours' as private_7_days from activate_license(current_setting('my.plic'));
select has_access() as private_access;
insert into plans (owner_id, title) values (auth.uid(), 'Mio');
select count(*) = 1 as d_sees_only_own_license from licenses;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  perform activate_license(current_setting('my.plic'));
  raise exception 'FAIL: private license reused' using errcode = 'XX000';
exception when sqlstate 'P0001' then if sqlerrm <> 'license used' then raise; end if; end $$;

-- E: agenzia con 1 gruppo, emette il codice per un capogruppo
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
insert into profiles (id, display_name, role) values (auth.uid(), 'Agenzia Rossi', 'agency');
select group_slots = 1 as agency_slots from activate_license(current_setting('my.alic'));
select agency_issue_code('Gita Firenze') ~ '^CUST-' as agency_issued;
do $$ begin
  perform agency_issue_code('troppi');
  raise exception 'FAIL: agency slots not enforced' using errcode = 'XX000';
exception when sqlstate 'P0001' then if sqlerrm <> 'no slots left' then raise; end if; end $$;
select count(*) = 1 and bool_and(max_people = 25) as agency_overview from agency_overview();
select count(*) = 2 as agency_sees_own_and_issued from licenses;

-- Scadenza: il server blocca posizioni e programmi, l'SOS passa ancora
reset role;
update licenses set expires_at = now() - interval '1 minute' where code in (:'glic', :'plic');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select has_access() = false as private_expired;
do $$ begin
  insert into plans (owner_id, title) values (auth.uid(), 'Scaduto');
  raise exception 'FAIL: expired user wrote a plan' using errcode = 'XX000';
exception when insufficient_privilege then null; end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  update live_locations set lat = 41.91 where user_id = auth.uid();
  if found then raise exception 'FAIL: expired member updated location' using errcode = 'XX000'; end if;
exception when insufficient_privilege then null; end $$;
insert into alerts (group_id, sender_id, kind) select id, auth.uid(), 'sos' from groups;
select count(*) >= 1 as sos_after_expiry from alerts where kind = 'sos';
-- Il capogruppo rinnova con un nuovo codice: il membro torna ad avere accesso
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select renew_group(current_setting('my.rlic')) > now() + interval '2 days' as renewed;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select has_access() as member_access_after_renew;
select max_people = 10 as renewed_seats from my_access() limit 1;

