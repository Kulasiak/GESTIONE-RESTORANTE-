-- Test delle regole di sicurezza: eseguire con scripts/test-db.sh
\set ON_ERROR_STOP 1
insert into auth.users values ('00000000-0000-0000-0000-00000000000a'),('00000000-0000-0000-0000-00000000000b'),('00000000-0000-0000-0000-00000000000c');
set role authenticated;
-- Leader A crea il gruppo
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into profiles (id, display_name, role) values (auth.uid(), 'Marco', 'leader');
select code as gcode from create_group('Parrocchia San Luca') \gset
insert into plans (owner_id, group_id, title) select auth.uid(), id, 'Oggi' from groups returning id as planid \gset
insert into plan_stops (plan_id, position, time, place_id) values (:'planid', 0, '08:30', 'hotel');
insert into documents (id, owner_id, kind, ciphertext, iv) values (gen_random_uuid(), auth.uid(), 'passport', 'xx', 'yy');
-- Membro B entra col codice
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into profiles (id, display_name, role) values (auth.uid(), 'Giulia', 'member');
select * from preview_group(:'gcode');
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
select count(*) > 0 as places_public from places;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select time = '08:30' as stop_unchanged from plan_stops;
