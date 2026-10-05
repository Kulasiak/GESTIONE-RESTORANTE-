-- Custode · pacchetti di accesso (codici di attivazione)
--
--   private  1 persona, valido N giorni dalla prima attivazione
--   group    il capogruppo lo usa per creare il gruppo; fino a max_people partecipanti, N giorni
--   agency   pacchetto per agenzie: group_slots gruppi, ognuno con max_people partecipanti
--            e group_days giorni; l'agenzia emette i codici di gruppo per i suoi capigruppo
--
-- Alla scadenza il server rifiuta posizioni, avvisi e programmi (tranne l'SOS),
-- e non lascia entrare nuovi membri. I documenti restano sul telefono di chi li ha.
-- I codici si creano dall'SQL editor di Supabase con admin_create_licenses(...).

create table public.licenses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kind text not null check (kind in ('private', 'group', 'agency')),
  days integer not null default 7 check (days between 1 and 730),
  max_people integer not null default 1 check (max_people between 1 and 1000),
  group_slots integer not null default 0 check (group_slots between 0 and 10000),
  group_days integer not null default 7 check (group_days between 1 and 365),
  parent_id uuid references public.licenses (id) on delete cascade,   -- codice emesso da un'agenzia
  holder_id uuid references auth.users (id) on delete set null,        -- chi l'ha attivato
  group_id uuid references public.groups (id) on delete set null,      -- gruppo creato con il codice
  activated_at timestamptz,
  expires_at timestamptz,
  note text,                                                            -- es. nome cliente o viaggio
  created_at timestamptz not null default now()
);
create index licenses_parent_idx on public.licenses (parent_id);
create index licenses_holder_idx on public.licenses (holder_id);

alter table public.groups add column license_id uuid references public.licenses (id) on delete set null;
alter table public.profiles add column license_id uuid references public.licenses (id) on delete set null;
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('solo', 'member', 'leader', 'agency'));

alter table public.licenses enable row level security;
-- Si vede il proprio codice, quelli emessi dalla propria agenzia e quello del proprio gruppo.
create or replace function public.holds_license(lid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from licenses where id = lid and holder_id = auth.uid());
$$;
create policy licenses_select on public.licenses for select using (
  holder_id = auth.uid()
  or (parent_id is not null and public.holds_license(parent_id))
  or (group_id is not null and public.is_group_member(group_id)));

-- Il capogruppo puo modificare il suo gruppo, ma non il pacchetto, il codice o chi lo guida.
create or replace function public.protect_group_columns()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') and (
    new.license_id is distinct from old.license_id or new.leader_id is distinct from old.leader_id or new.code is distinct from old.code) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger groups_protect before update on public.groups for each row execute function public.protect_group_columns();

create or replace function public.protect_profile_license()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') and new.license_id is distinct from old.license_id then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_protect before update on public.profiles for each row execute function public.protect_profile_license();
-- Nessuna scrittura diretta: solo tramite le funzioni qui sotto.

-- ───────── codici leggibili: CUST-XXXX-XXXX (senza 0/O, 1/I) ─────────
create or replace function public.gen_license_code()
returns text language plpgsql volatile set search_path = public, extensions as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea;
  s text;
begin
  loop
    b := gen_random_bytes(8);
    s := '';
    for i in 0..7 loop
      s := s || substr(alphabet, (get_byte(b, i) % 32) + 1, 1);
    end loop;
    s := 'CUST-' || substr(s, 1, 4) || '-' || substr(s, 5, 4);
    exit when not exists (select 1 from licenses where code = s);
  end loop;
  return s;
end $$;

-- ───────── fino a quando un utente ha accesso ─────────
create or replace function public.access_until(uid uuid)
returns timestamptz language sql stable security definer set search_path = public as $$
  select max(e) from (
    select l.expires_at as e from licenses l where l.holder_id = uid and l.kind in ('private', 'agency')
    union all
    select l.expires_at from group_members m join groups g on g.id = m.group_id join licenses l on l.id = g.license_id
      where m.user_id = uid
  ) x;
$$;

create or replace function public.has_access()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.access_until(auth.uid()) > now(), false);
$$;

-- ───────── attivazione (privato o agenzia; il gruppo si attiva creando il gruppo) ─────────
create or replace function public.activate_license(license_code text)
returns table (kind text, expires_at timestamptz, max_people integer, group_slots integer)
language plpgsql security definer set search_path = public as $$
declare
  l public.licenses;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into l from licenses where code = upper(trim(license_code)) for update;
  if not found then raise exception 'license not found' using errcode = 'P0002'; end if;
  if l.kind = 'group' then raise exception 'license is for a group' using errcode = 'P0001'; end if;
  if l.holder_id is not null and l.holder_id <> auth.uid() then raise exception 'license used' using errcode = 'P0001'; end if;
  if l.expires_at is not null and l.expires_at <= now() then raise exception 'license expired' using errcode = 'P0001'; end if;
  if l.activated_at is null then
    update licenses set holder_id = auth.uid(), activated_at = now(), expires_at = now() + make_interval(days => l.days)
      where id = l.id returning * into l;
  end if;
  if l.kind = 'private' then update profiles set license_id = l.id where id = auth.uid(); end if;
  return query select l.kind, l.expires_at, l.max_people, l.group_slots;
end $$;

-- ───────── gruppi: serve un codice di gruppo valido ─────────
drop function public.create_group(text);
create or replace function public.create_group(group_name text, license_code text)
returns public.groups language plpgsql security definer set search_path = public as $$
declare
  g public.groups;
  l public.licenses;
  c text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into l from licenses where code = upper(trim(license_code)) for update;
  if not found then raise exception 'license not found' using errcode = 'P0002'; end if;
  if l.kind <> 'group' then raise exception 'license is not for a group' using errcode = 'P0001'; end if;
  if l.holder_id is not null and l.holder_id <> auth.uid() then raise exception 'license used' using errcode = 'P0001'; end if;
  if l.expires_at is not null and l.expires_at <= now() then raise exception 'license expired' using errcode = 'P0001'; end if;
  -- Un codice = un gruppo: se il capogruppo lo riusa, ritrova il suo gruppo
  if l.group_id is not null then
    select * into g from groups where id = l.group_id;
    return g;
  end if;
  loop
    c := 'ROMA-' || lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when not exists (select 1 from groups where code = c);
  end loop;
  insert into groups (name, code, leader_id, license_id) values (coalesce(nullif(trim(group_name), ''), 'Gruppo'), c, auth.uid(), l.id)
    returning * into g;
  insert into group_members (group_id, user_id, role) values (g.id, auth.uid(), 'leader');
  update licenses set holder_id = auth.uid(), group_id = g.id,
    activated_at = coalesce(activated_at, now()), expires_at = coalesce(expires_at, now() + make_interval(days => l.days))
    where id = l.id;
  return g;
end $$;

-- Entra nel gruppo solo se il pacchetto e valido e ci sono posti.
create or replace function public.join_group(group_code text)
returns table (group_id uuid, group_name text, leader_name text)
language plpgsql security definer set search_path = public as $$
declare
  g public.groups;
  l public.licenses;
  n integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into g from groups where code = upper(trim(group_code));
  if not found then raise exception 'group not found' using errcode = 'P0002'; end if;
  if not exists (select 1 from group_members where group_members.group_id = g.id and user_id = auth.uid()) then
    select * into l from licenses where id = g.license_id for update;
    if not found or l.expires_at is null or l.expires_at <= now() then raise exception 'license expired' using errcode = 'P0001'; end if;
    select count(*) into n from group_members where group_members.group_id = g.id and role = 'member';
    if n >= l.max_people then raise exception 'group full' using errcode = 'P0001'; end if;
    insert into group_members (group_id, user_id, role) values (g.id, auth.uid(), 'member');
  end if;
  return query select g.id, g.name, coalesce((select display_name from profiles where id = g.leader_id), '');
end $$;

drop function public.preview_group(text);
create or replace function public.preview_group(group_code text)
returns table (group_name text, leader_name text, seats_left integer, expires_at timestamptz)
language sql stable security definer set search_path = public as $$
  select g.name, coalesce(p.display_name, ''),
    greatest(0, coalesce(l.max_people, 0) - (select count(*) from group_members m where m.group_id = g.id and m.role = 'member'))::int,
    l.expires_at
  from groups g left join profiles p on p.id = g.leader_id left join licenses l on l.id = g.license_id
  where g.code = upper(trim(group_code));
$$;

-- Rinnovo: il capogruppo collega un nuovo codice di gruppo allo stesso gruppo (membri e dati restano).
create or replace function public.renew_group(license_code text)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  g public.groups;
  l public.licenses;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into g from groups where leader_id = auth.uid() order by created_at desc limit 1;
  if not found then raise exception 'no group' using errcode = 'P0001'; end if;
  select * into l from licenses where code = upper(trim(license_code)) for update;
  if not found then raise exception 'license not found' using errcode = 'P0002'; end if;
  if l.kind <> 'group' then raise exception 'license is not for a group' using errcode = 'P0001'; end if;
  if (l.holder_id is not null and l.holder_id <> auth.uid()) or (l.group_id is not null and l.group_id <> g.id) then
    raise exception 'license used' using errcode = 'P0001';
  end if;
  if l.expires_at is not null and l.expires_at <= now() then raise exception 'license expired' using errcode = 'P0001'; end if;
  update licenses set holder_id = auth.uid(), group_id = g.id,
    activated_at = coalesce(activated_at, now()), expires_at = coalesce(expires_at, now() + make_interval(days => l.days))
    where id = l.id returning * into l;
  update groups set license_id = l.id where id = g.id;
  return l.expires_at;
end $$;
revoke all on function public.renew_group(text) from public, anon;
grant execute on function public.renew_group(text) to authenticated;

-- ───────── stato dell'accesso per l'app ─────────
create or replace function public.my_access()
returns table (kind text, expires_at timestamptz, max_people integer, people integer, group_slots integer, used_slots integer, group_days integer)
language sql stable security definer set search_path = public as $$
  -- privato o agenzia attivati da me
  select l.kind, l.expires_at, l.max_people, 1, l.group_slots,
    (select count(*) from licenses c where c.parent_id = l.id)::int, l.group_days
  from licenses l where l.holder_id = auth.uid() and l.kind in ('private', 'agency')
  union all
  -- pacchetto del mio gruppo
  select 'group', l.expires_at, l.max_people,
    (select count(*) from group_members m where m.group_id = g.id and m.role = 'member')::int, 0, 0, 0
  from group_members gm join groups g on g.id = gm.group_id join licenses l on l.id = g.license_id
  where gm.user_id = auth.uid()
  order by 2 desc nulls last;
$$;

-- ───────── agenzie ─────────
-- Emette un codice di gruppo dal pacchetto dell'agenzia (uno per capogruppo).
create or replace function public.agency_issue_code(note text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  a public.licenses;
  used integer;
  c text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into a from licenses where holder_id = auth.uid() and kind = 'agency' and expires_at > now()
    order by expires_at desc limit 1 for update;
  if not found then raise exception 'no agency license' using errcode = 'P0001'; end if;
  select count(*) into used from licenses where parent_id = a.id;
  if used >= a.group_slots then raise exception 'no slots left' using errcode = 'P0001'; end if;
  c := public.gen_license_code();
  insert into licenses (code, kind, days, max_people, parent_id, note)
    values (c, 'group', a.group_days, a.max_people, a.id, nullif(trim(note), ''));
  return c;
end $$;

-- Elenco dei codici emessi dall'agenzia, con stato e partecipanti.
create or replace function public.agency_overview()
returns table (code text, note text, group_name text, leader_name text, people integer, max_people integer,
               activated_at timestamptz, expires_at timestamptz, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.code, c.note, g.name, coalesce(p.display_name, ''),
    coalesce((select count(*) from group_members m where m.group_id = g.id and m.role = 'member'), 0)::int,
    c.max_people, c.activated_at, c.expires_at, c.created_at
  from licenses a
  join licenses c on c.parent_id = a.id
  left join groups g on g.id = c.group_id
  left join profiles p on p.id = g.leader_id
  where a.holder_id = auth.uid() and a.kind = 'agency'
  order by c.created_at desc;
$$;

-- ───────── amministrazione (solo SQL editor / service role) ─────────
-- Esempi:
--   select * from admin_create_licenses('private', 7, 1, 10);                 -- 10 codici privati da 7 giorni
--   select * from admin_create_licenses('group', 7, 30, 5, note => 'Parrocchia San Luca');  -- 5 gruppi da 30 persone
--   select * from admin_create_licenses('agency', 365, 40, 1, group_slots => 20, group_days => 7, note => 'Agenzia Rossi');
create or replace function public.admin_create_licenses(
  p_kind text, p_days integer, p_max_people integer, p_how_many integer default 1,
  group_slots integer default 0, group_days integer default 7, note text default null)
returns setof text language plpgsql security definer set search_path = public as $$
declare
  c text;
begin
  if p_how_many < 1 or p_how_many > 1000 then raise exception 'how_many must be 1..1000'; end if;
  for i in 1..p_how_many loop
    c := public.gen_license_code();
    insert into licenses (code, kind, days, max_people, group_slots, group_days, note)
      values (c, p_kind, p_days, case when p_kind = 'private' then 1 else p_max_people end, group_slots, group_days, note);
    return next c;
  end loop;
end $$;

revoke all on function public.admin_create_licenses(text, integer, integer, integer, integer, integer, text) from public, anon, authenticated;
revoke all on function public.gen_license_code() from public, anon, authenticated;
revoke all on function public.holds_license(uuid) from public, anon;
revoke all on function public.activate_license(text) from public, anon;
revoke all on function public.create_group(text, text) from public, anon;
revoke all on function public.join_group(text) from public, anon;
revoke all on function public.preview_group(text) from public, anon;
revoke all on function public.my_access() from public, anon;
revoke all on function public.agency_issue_code(text) from public, anon;
revoke all on function public.agency_overview() from public, anon;
grant execute on function public.activate_license(text) to authenticated;
grant execute on function public.create_group(text, text) to authenticated;
grant execute on function public.join_group(text) to authenticated;
grant execute on function public.preview_group(text) to authenticated;
grant execute on function public.my_access() to authenticated;
grant execute on function public.agency_issue_code(text) to authenticated;
grant execute on function public.agency_overview() to authenticated;

-- ───────── blocco alla scadenza: il server rifiuta le scritture ─────────
drop policy loc_insert on public.live_locations;
drop policy loc_update on public.live_locations;
create policy loc_insert on public.live_locations for insert with check (
  user_id = auth.uid() and public.has_access() and (group_id is null or public.is_group_member(group_id)));
create policy loc_update on public.live_locations for update using (user_id = auth.uid()) with check (
  user_id = auth.uid() and public.has_access() and (group_id is null or public.is_group_member(group_id)));

-- L'SOS passa sempre, anche a pacchetto scaduto
drop policy alerts_insert on public.alerts;
create policy alerts_insert on public.alerts for insert with check (
  sender_id = auth.uid() and public.is_group_member(group_id)
  and (public.has_access() or kind = 'sos')
  and (kind not in ('message', 'plan_published') or public.is_group_leader(group_id)));

drop policy plans_insert on public.plans;
drop policy plans_update on public.plans;
create policy plans_insert on public.plans for insert with check (
  owner_id = auth.uid() and public.has_access() and (group_id is null or public.is_group_leader(group_id)));
create policy plans_update on public.plans for update using (
  group_id is null and owner_id = auth.uid() or group_id is not null and public.is_group_leader(group_id)) with check (
  public.has_access() and (group_id is null and owner_id = auth.uid() or group_id is not null and public.is_group_leader(group_id)));

drop policy stops_insert on public.plan_stops;
drop policy stops_update on public.plan_stops;
create policy stops_insert on public.plan_stops for insert with check (public.has_access() and public.can_edit_plan(plan_id));
create policy stops_update on public.plan_stops for update using (public.can_edit_plan(plan_id)) with check (public.has_access() and public.can_edit_plan(plan_id));

drop policy groups_update on public.groups;
create policy groups_update on public.groups for update using (leader_id = auth.uid()) with check (leader_id = auth.uid() and public.has_access());
