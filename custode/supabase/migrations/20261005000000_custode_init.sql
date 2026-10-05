-- Custode · schema iniziale
-- Regola generale: ognuno vede solo i propri dati e quelli del proprio gruppo.
-- I documenti sono cifrati sul telefono (AES-GCM, chiave dal PIN): il server
-- conserva solo testo cifrato e non puo leggerli.

create extension if not exists pgcrypto;

-- ───────────────────────── utenti ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  phone text,                      -- telefono (il capogruppo lo mostra ai membri)
  lang text not null default 'it' check (lang in ('it','en','fr','es','pl','ro')),
  role text not null default 'solo' check (role in ('solo','member','leader')),
  nationality text,                -- codice ISO3 dal passaporto (per l'ambasciata)
  hotel_name text,
  hotel_address text,
  hotel_lat double precision,
  hotel_lng double precision,
  vault_salt text,                 -- sale PBKDF2 della cassaforte (non segreto)
  trip_start date,                 -- date del viaggio (turista singolo)
  trip_end date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────────────────────── gruppi ─────────────────────────
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,       -- es. ROMA-4821, da dare ai membri
  leader_id uuid not null references auth.users (id) on delete cascade,
  meeting_name text,
  meeting_lat double precision,
  meeting_lng double precision,
  meeting_time text,               -- HH:MM
  radius_m integer not null default 150 check (radius_m between 25 and 2000),
  start_date date,                 -- date del viaggio del gruppo
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('leader','member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);

-- Funzioni di controllo (security definer per evitare ricorsione nelle policy)
create or replace function public.is_group_member(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members where group_id = gid and user_id = auth.uid());
$$;

create or replace function public.is_group_leader(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from groups where id = gid and leader_id = auth.uid());
$$;

create or replace function public.shares_group_with(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from group_members a join group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

-- ─────────────────── programmi e tappe ───────────────────
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  group_id uuid references public.groups (id) on delete cascade,  -- null = programma personale
  title text not null default '',
  tour text,                        -- pell, arte, cult, storia, gastro o null
  day date not null default current_date,
  published_at timestamptz,         -- i membri vedono solo i programmi pubblicati
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index plans_group_day_idx on public.plans (group_id, day);
create index plans_owner_day_idx on public.plans (owner_id, day);

create table public.plan_stops (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  position integer not null,
  time text not null,               -- HH:MM
  place_id text,                    -- riferimento a places.id, oppure null per tappa libera
  name text,                        -- nome per tappa libera
  lat double precision,
  lng double precision,
  mode text check (mode in ('walk','metro','bus','tram','train','taxi')),
  minutes integer,
  leg_note text,
  tip text,
  created_at timestamptz not null default now()
);
create index plan_stops_plan_idx on public.plan_stops (plan_id, position);

create or replace function public.can_read_plan(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from plans p where p.id = pid and (
      p.owner_id = auth.uid()
      or (p.group_id is not null and public.is_group_leader(p.group_id))
      or (p.group_id is not null and p.published_at is not null and public.is_group_member(p.group_id))
    )
  );
$$;

create or replace function public.can_edit_plan(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from plans p where p.id = pid and (
      (p.group_id is null and p.owner_id = auth.uid())
      or (p.group_id is not null and public.is_group_leader(p.group_id))
    )
  );
$$;

-- ───────────────────── posizioni live ─────────────────────
create table public.live_locations (
  user_id uuid primary key references auth.users (id) on delete cascade,
  group_id uuid references public.groups (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  out_of_zone boolean not null default false,
  sharing_until timestamptz,        -- condivisione SOS a tempo (anche fuori gruppo)
  updated_at timestamptz not null default now()
);

-- ─────────────────── documenti cifrati ───────────────────
create table public.documents (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('passport','id','boarding','hotel','insurance','ticket','other')),
  ciphertext text not null,         -- base64 AES-GCM: il server non vede mai il contenuto
  iv text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index documents_owner_idx on public.documents (owner_id);

-- ─────────────────── luoghi e musei ───────────────────
create table public.places (
  id text primary key,
  kind text not null,
  name jsonb not null,              -- {"it": "...", "en": "...", ...}
  story jsonb,
  lat double precision not null,
  lng double precision not null,
  tags text[] not null default '{}',
  price_full jsonb,
  price_reduced jsonb,
  booking jsonb,
  hours_label jsonb,
  hours jsonb,                      -- {"0":[["09:00","19:00"]], ...} 0 = domenica
  first_sunday text check (first_sunday in ('free','residents')),
  note jsonb,
  url text,
  updated_at timestamptz not null default now()
);

-- ───────────────────────── avvisi ─────────────────────────
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  target_user_id uuid references auth.users (id) on delete cascade,  -- null = tutto il gruppo
  kind text not null check (kind in ('out_of_zone','back_in_zone','message','plan_published','sos','im_ok')),
  message text,
  lat double precision,
  lng double precision,
  distance_m integer,
  created_at timestamptz not null default now()
);
create index alerts_group_idx on public.alerts (group_id, created_at desc);

-- ─────────────────── aggiornamento updated_at ───────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger groups_touch before update on public.groups for each row execute function public.touch_updated_at();
create trigger plans_touch before update on public.plans for each row execute function public.touch_updated_at();
create trigger documents_touch before update on public.documents for each row execute function public.touch_updated_at();

-- ───────────────────────── RLS ─────────────────────────
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.plans enable row level security;
alter table public.plan_stops enable row level security;
alter table public.live_locations enable row level security;
alter table public.documents enable row level security;
alter table public.places enable row level security;
alter table public.alerts enable row level security;

-- profili: io + chi e nel mio gruppo (solo lettura)
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.shares_group_with(id));
create policy profiles_insert on public.profiles for insert with check (id = auth.uid());
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_delete on public.profiles for delete using (id = auth.uid());

-- gruppi: li vedono i membri, li modifica solo il capogruppo; si creano con create_group()
create policy groups_select on public.groups for select using (public.is_group_member(id));
create policy groups_update on public.groups for update using (leader_id = auth.uid()) with check (leader_id = auth.uid());
create policy groups_delete on public.groups for delete using (leader_id = auth.uid());

-- membri: visibili ai membri dello stesso gruppo; si entra con join_group(), si esce da soli
create policy members_select on public.group_members for select using (public.is_group_member(group_id));
create policy members_delete on public.group_members for delete
  using (user_id = auth.uid() or public.is_group_leader(group_id));

-- programmi
create policy plans_select on public.plans for select using (
  owner_id = auth.uid()
  or (group_id is not null and public.is_group_leader(group_id))
  or (group_id is not null and published_at is not null and public.is_group_member(group_id)));
create policy plans_insert on public.plans for insert with check (
  owner_id = auth.uid() and (group_id is null or public.is_group_leader(group_id)));
create policy plans_update on public.plans for update using (
  group_id is null and owner_id = auth.uid() or group_id is not null and public.is_group_leader(group_id)) with check (
  group_id is null and owner_id = auth.uid() or group_id is not null and public.is_group_leader(group_id));
create policy plans_delete on public.plans for delete using (
  group_id is null and owner_id = auth.uid() or group_id is not null and public.is_group_leader(group_id));

create policy stops_select on public.plan_stops for select using (public.can_read_plan(plan_id));
create policy stops_insert on public.plan_stops for insert with check (public.can_edit_plan(plan_id));
create policy stops_update on public.plan_stops for update using (public.can_edit_plan(plan_id)) with check (public.can_edit_plan(plan_id));
create policy stops_delete on public.plan_stops for delete using (public.can_edit_plan(plan_id));

-- posizioni: la mia; quelle del mio gruppo; chi mi condivide la posizione SOS la vede il capogruppo
create policy loc_select on public.live_locations for select using (
  user_id = auth.uid() or (group_id is not null and public.is_group_member(group_id)));
create policy loc_insert on public.live_locations for insert with check (
  user_id = auth.uid() and (group_id is null or public.is_group_member(group_id)));
create policy loc_update on public.live_locations for update using (user_id = auth.uid()) with check (
  user_id = auth.uid() and (group_id is null or public.is_group_member(group_id)));
create policy loc_delete on public.live_locations for delete using (user_id = auth.uid());

-- documenti: solo il proprietario, per tutto
create policy docs_all on public.documents for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- luoghi: lettura pubblica, scrittura solo da dashboard / service role
create policy places_select on public.places for select using (true);

-- avvisi: li vede chi e nel gruppo (se diretti a una persona: lei, chi li manda e il capogruppo)
create policy alerts_select on public.alerts for select using (
  public.is_group_member(group_id) and (
    target_user_id is null or target_user_id = auth.uid() or sender_id = auth.uid() or public.is_group_leader(group_id)));
create policy alerts_insert on public.alerts for insert with check (
  sender_id = auth.uid() and public.is_group_member(group_id)
  and (kind not in ('message','plan_published') or public.is_group_leader(group_id)));

-- ─────────────────── funzioni per i gruppi ───────────────────
-- Crea un gruppo con codice univoco e mette il chiamante come capogruppo.
create or replace function public.create_group(group_name text)
returns public.groups language plpgsql security definer set search_path = public as $$
declare
  g public.groups;
  c text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  loop
    c := 'ROMA-' || lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when not exists (select 1 from groups where code = c);
  end loop;
  insert into groups (name, code, leader_id) values (coalesce(nullif(trim(group_name), ''), 'Gruppo'), c, auth.uid())
    returning * into g;
  insert into group_members (group_id, user_id, role) values (g.id, auth.uid(), 'leader');
  return g;
end $$;

-- Entra in un gruppo con il codice. Restituisce solo nome e capogruppo: i dettagli
-- diventano visibili grazie alla RLS una volta membri.
create or replace function public.join_group(group_code text)
returns table (group_id uuid, group_name text, leader_name text)
language plpgsql security definer set search_path = public as $$
declare
  g public.groups;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into g from groups where code = upper(trim(group_code));
  if not found then raise exception 'group not found' using errcode = 'P0002'; end if;
  insert into group_members (group_id, user_id, role) values (g.id, auth.uid(), 'member')
    on conflict do nothing;
  return query select g.id, g.name, coalesce((select display_name from profiles where id = g.leader_id), '');
end $$;

-- Anteprima del codice prima di entrare (nome gruppo e capogruppo), senza diventare membri.
create or replace function public.preview_group(group_code text)
returns table (group_name text, leader_name text)
language sql stable security definer set search_path = public as $$
  select g.name, coalesce(p.display_name, '')
  from groups g left join profiles p on p.id = g.leader_id
  where g.code = upper(trim(group_code));
$$;

revoke all on function public.create_group(text) from public, anon;
revoke all on function public.join_group(text) from public, anon;
revoke all on function public.preview_group(text) from public, anon;
grant execute on function public.create_group(text) to authenticated;
grant execute on function public.join_group(text) to authenticated;
grant execute on function public.preview_group(text) to authenticated;

-- ─────────────────── realtime ───────────────────
alter publication supabase_realtime add table public.live_locations;
alter publication supabase_realtime add table public.alerts;
alter publication supabase_realtime add table public.plans;
alter publication supabase_realtime add table public.plan_stops;
alter publication supabase_realtime add table public.groups;
alter publication supabase_realtime add table public.group_members;
