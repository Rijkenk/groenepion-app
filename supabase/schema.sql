-- De Groene Pion app: database-opzet voor Supabase
-- Plak dit hele bestand in Supabase: SQL Editor -> New query -> Run.
-- Het is veilig om opnieuw te draaien: tabellen worden alleen aangemaakt als ze nog niet bestaan
-- en functies worden vervangen.
--
-- Beveiligingsmodel: alle tabellen hebben row level security AAN en GEEN policies.
-- De app leest en schrijft dus nooit rechtstreeks in tabellen, maar alleen via de
-- functies hieronder (security definer). Elke functie controleert zelf wie je bent
-- (auth.uid()) en of je een goedgekeurd lid bent.

-- ============================================================ tabellen

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text not null default '',
  phone text not null default '',
  bio text not null default '',
  likes text not null default '',
  status text not null default 'pending' check (status in ('pending', 'member', 'admin', 'blocked')),
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

create table if not exists public.avonden (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  start_time time not null default '20:00',
  location text not null default '''t Aahoes',
  address text not null default 'Albardastraat 20, Aadorp',
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.game_tables (
  id uuid primary key default gen_random_uuid(),
  avond_id uuid not null references public.avonden (id) on delete cascade,
  host_id uuid not null references public.profiles (id) on delete cascade,
  game text not null check (length(trim(game)) between 1 and 120),
  max_players int not null check (max_players between 2 and 20),
  pre_taken int not null default 0 check (pre_taken >= 0),
  start_time time not null default '20:00',
  duration_min int not null default 90 check (duration_min between 10 and 600),
  weight text not null default 'Middel' check (weight in ('Licht', 'Middel', 'Zwaar')),
  kind text not null default 'Strategie' check (kind in ('Coöp', 'Party', 'Strategie', 'Overig')),
  exp text not null default 'Beginner' check (exp in ('Beginner', 'Ervaren', 'Kenner')),
  mode text not null default 'open' check (mode in ('open', 'aanvraag')),
  cancelled boolean not null default false,
  created_at timestamptz not null default now(),
  check (pre_taken <= max_players - 2)
);

create table if not exists public.table_players (
  table_id uuid not null references public.game_tables (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  state text not null check (state in ('seated', 'requested', 'waitlist')),
  created_at timestamptz not null default now(),
  primary key (table_id, user_id)
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'overig' check (kind in ('thuis', 'uitje', 'overig')),
  title text not null check (length(trim(title)) between 1 and 120),
  date date not null,
  start_time time not null default '20:00',
  area text not null default '',          -- wijk of plaats, voor iedereen zichtbaar
  game text not null default '',
  description text not null default '',
  max_people int check (max_people is null or max_people between 1 and 500),
  host_id uuid not null references public.profiles (id) on delete cascade,
  approval boolean not null default false, -- true: gastheer keurt aanvragen goed
  auto_regulars boolean not null default false,
  cancelled boolean not null default false,
  created_at timestamptz not null default now()
);

-- Alleen de gastheer en geaccepteerde gasten zien het adres.
create table if not exists public.event_private (
  event_id uuid primary key references public.events (id) on delete cascade,
  address text not null default ''
);

create table if not exists public.event_attendees (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  state text not null check (state in ('going', 'waitlist', 'requested', 'full')),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table if not exists public.regulars (
  host_id uuid not null references public.profiles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (host_id, user_id)
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  game text not null check (length(trim(game)) between 1 and 120),
  price_cents int not null check (price_cents between 0 and 100000),
  language text not null default 'NL',
  condition text not null default '',
  description text not null default '',
  pickup text not null default '',
  status text not null default 'te_koop' check (status in ('te_koop', 'gereserveerd', 'verkocht', 'verwijderd')),
  created_at timestamptz not null default now()
);

create table if not exists public.listing_offers (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('kopen', 'bod')),
  amount_cents int not null check (amount_cents between 0 and 100000),
  state text not null default 'pending' check (state in ('pending', 'accepted', 'declined', 'withdrawn')),
  created_at timestamptz not null default now()
);
create unique index if not exists listing_offers_one_open on public.listing_offers (listing_id, buyer_id) where state in ('pending', 'accepted');

create table if not exists public.library_games (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  players text not null default '',
  minutes int,
  kind text not null default '',
  weight text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.library_loans (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.library_games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('avond', 'thuis', 'wacht')),
  avond_id uuid references public.avonden (id) on delete set null,
  state text not null default 'aangevraagd' check (state in ('aangevraagd', 'uitgeleend', 'terug', 'geannuleerd')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.notifications enable row level security;
alter table public.avonden enable row level security;
alter table public.game_tables enable row level security;
alter table public.table_players enable row level security;
alter table public.events enable row level security;
alter table public.event_private enable row level security;
alter table public.event_attendees enable row level security;
alter table public.regulars enable row level security;
alter table public.listings enable row level security;
alter table public.listing_offers enable row level security;
alter table public.library_games enable row level security;
alter table public.library_loans enable row level security;

-- ============================================================ hulpfuncties

create or replace function public.gp_me() returns uuid
language sql stable as $$ select auth.uid() $$;

create or replace function public.gp_status(uid uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select status from profiles where id = uid), 'none')
$$;

create or replace function public.gp_require_member() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Niet ingelogd' using errcode = '28000'; end if;
  if gp_status(uid) not in ('member', 'admin') then
    raise exception 'Je account is nog niet goedgekeurd' using errcode = '42501';
  end if;
  return uid;
end $$;

create or replace function public.gp_require_admin() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := gp_require_member();
begin
  if gp_status(uid) <> 'admin' then raise exception 'Alleen voor beheerders' using errcode = '42501'; end if;
  return uid;
end $$;

create or replace function public.gp_name(uid uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(display_name, ''), 'Lid') from profiles where id = uid
$$;

create or replace function public.gp_notify(uid uuid, msg text) returns void
language sql security definer set search_path = public as $$
  insert into notifications (user_id, body) values (uid, msg)
$$;

-- Nieuwe gebruiker in Supabase Auth -> profiel met status 'pending'.
create or replace function public.gp_handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, display_name)
  values (new.id, new.email, coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(coalesce(new.email, ''), '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists gp_on_auth_user_created on auth.users;
create trigger gp_on_auth_user_created after insert on auth.users
  for each row execute function public.gp_handle_new_user();

-- ============================================================ profiel en leden

create or replace function public.get_me() returns json
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); r json;
begin
  if uid is null then return null; end if;
  select json_build_object('id', id, 'email', email, 'display_name', display_name, 'phone', phone,
    'bio', bio, 'likes', likes, 'status', status,
    'unread', (select count(*) from notifications n where n.user_id = p.id and not n.read))
  into r from profiles p where id = uid;
  return r;
end $$;

create or replace function public.update_profile(p_name text, p_phone text, p_bio text, p_likes text) returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Niet ingelogd'; end if;
  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'Vul je naam in'; end if;
  update profiles set display_name = left(trim(p_name), 60), phone = left(trim(coalesce(p_phone, '')), 20),
    bio = left(coalesce(p_bio, ''), 500), likes = left(coalesce(p_likes, ''), 300)
  where id = uid;
  return get_me();
end $$;

create or replace function public.admin_list_members() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  perform gp_require_admin();
  return coalesce((select json_agg(json_build_object('id', id, 'email', email, 'display_name', display_name,
    'status', status, 'created_at', created_at) order by (status = 'pending') desc, created_at desc) from profiles), '[]'::json);
end $$;

create or replace function public.admin_set_status(p_user uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := gp_require_admin();
begin
  if p_status not in ('pending', 'member', 'admin', 'blocked') then raise exception 'Ongeldige status'; end if;
  if p_user = uid and p_status <> 'admin' then raise exception 'Je kunt je eigen beheerrechten niet intrekken'; end if;
  update profiles set status = p_status where id = p_user;
  if p_status = 'member' then perform gp_notify(p_user, 'Welkom bij De Groene Pion! Je account is goedgekeurd.'); end if;
end $$;

create or replace function public.list_notifications() returns json
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return '[]'::json; end if;
  return coalesce((select json_agg(json_build_object('id', id, 'body', body, 'read', read, 'created_at', created_at) order by created_at desc)
    from (select * from notifications where user_id = uid order by created_at desc limit 50) n), '[]'::json);
end $$;

create or replace function public.mark_notifications_read() returns void
language sql security definer set search_path = public as $$
  update notifications set read = true where user_id = auth.uid() and not read
$$;

-- ============================================================ spelavond en tafels

create or replace function public.admin_create_avond(p_date date, p_start time, p_location text, p_address text, p_note text) returns uuid
language plpgsql security definer set search_path = public as $$
declare nid uuid;
begin
  perform gp_require_admin();
  insert into avonden (date, start_time, location, address, note)
  values (p_date, coalesce(p_start, '20:00'), coalesce(nullif(trim(p_location), ''), '''t Aahoes'),
          coalesce(nullif(trim(p_address), ''), 'Albardastraat 20, Aadorp'), coalesce(p_note, ''))
  returning id into nid;
  return nid;
end $$;

create or replace function public.gp_table_free(t game_tables) returns int
language sql stable security definer set search_path = public as $$
  select t.max_players - 1 - t.pre_taken - (select count(*)::int from table_players p where p.table_id = t.id and p.state = 'seated')
$$;

-- Schuift de eerste van de wachtlijst door als er plek is.
create or replace function public.gp_promote(p_table uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t game_tables; nxt uuid;
begin
  select * into t from game_tables where id = p_table;
  if t.id is null or t.cancelled then return; end if;
  while gp_table_free(t) > 0 loop
    select user_id into nxt from table_players where table_id = p_table and state = 'waitlist' order by created_at limit 1;
    exit when nxt is null;
    if t.mode = 'open' then
      update table_players set state = 'seated' where table_id = p_table and user_id = nxt;
      perform gp_notify(nxt, 'Er is een plek vrijgekomen: je zit aan ' || t.game || ' om ' || to_char(t.start_time, 'HH24:MI') || '.');
    else
      update table_players set state = 'requested' where table_id = p_table and user_id = nxt;
      perform gp_notify(t.host_id, gp_name(nxt) || ' van de wachtlijst vraagt een plek aan bij ' || t.game || '.');
      exit;
    end if;
  end loop;
end $$;

create or replace function public.get_avond(p_avond uuid default null) returns json
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := gp_require_member(); a avonden; r json;
begin
  if p_avond is null then
    select * into a from avonden where date >= (now() at time zone 'Europe/Amsterdam')::date order by date limit 1;
  else
    select * into a from avonden where id = p_avond;
  end if;
  if a.id is null then return json_build_object('avond', null, 'tables', '[]'::json); end if;
  select json_build_object(
    'avond', json_build_object('id', a.id, 'date', a.date, 'start_time', to_char(a.start_time, 'HH24:MI'),
      'location', a.location, 'address', a.address, 'note', a.note),
    'tables', coalesce((select json_agg(x order by x.mine desc, x.start_time, x.created_at) from (
      select t.id, t.game, t.max_players, t.pre_taken, to_char(t.start_time, 'HH24:MI') as start_time,
        to_char(t.start_time + make_interval(mins => t.duration_min), 'HH24:MI') as end_time,
        t.duration_min, t.weight, t.kind, t.exp, t.mode, t.created_at,
        gp_name(t.host_id) as host_name, (t.host_id = uid) as mine,
        (select count(*) from table_players p where p.table_id = t.id and p.state = 'seated') as seated_count,
        gp_table_free(t) as free,
        (select state from table_players p where p.table_id = t.id and p.user_id = uid) as my_state,
        case when t.host_id = uid then coalesce((select json_agg(json_build_object('user_id', p.user_id, 'name', gp_name(p.user_id), 'state', p.state) order by p.created_at)
          from table_players p where p.table_id = t.id), '[]'::json) else '[]'::json end as players,
        (select count(*) from table_players p where p.table_id = t.id and p.state = 'waitlist') as waitlist_count
      from game_tables t where t.avond_id = a.id and not t.cancelled) x), '[]'::json),
    'going_count', (select count(distinct u) from (
        select t.host_id as u from game_tables t where t.avond_id = a.id and not t.cancelled
        union select p.user_id from table_players p join game_tables t on t.id = p.table_id where t.avond_id = a.id and not t.cancelled and p.state = 'seated') s)
  ) into r;
  return r;
end $$;

create or replace function public.create_table(p_avond uuid, p_game text, p_max int, p_pre int, p_start time, p_duration int,
  p_weight text, p_kind text, p_exp text, p_mode text) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := gp_require_member(); nid uuid;
begin
  if not exists (select 1 from avonden where id = p_avond) then raise exception 'Spelavond niet gevonden'; end if;
  if coalesce(p_pre, 0) > p_max - 2 then raise exception 'Er moet minstens één plek vrij blijven'; end if;
  insert into game_tables (avond_id, host_id, game, max_players, pre_taken, start_time, duration_min, weight, kind, exp, mode)
  values (p_avond, uid, trim(p_game), p_max, coalesce(p_pre, 0), coalesce(p_start, '20:00'), coalesce(p_duration, 90),
          p_weight, p_kind, p_exp, p_mode)
  returning id into nid;
  return nid;
end $$;

create or replace function public.cancel_table(p_table uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := gp_require_member(); t game_tables; p record;
begin
  select * into t from game_tables where id = p_table;
  if t.id is null or t.host_id <> uid then raise exception 'Dit is niet jouw tafel'; end if;
  update game_tables set cancelled = true where id = p_table;
  for p in select user_id from table_players where table_id = p_table loop
    perform gp_notify(p.user_id, 'De tafel ' || t.game || ' om ' || to_char(t.start_time, 'HH24:MI') || ' gaat niet door. Kijk of er een andere tafel vrij is.');
  end loop;
  delete from table_players where table_id = p_table;
end $$;

-- Aanschuiven. Geeft terug: seated | requested | waitlist | need_rules | conflict (met lijst).
create or replace function public.join_table(p_table uuid, p_rules_ok boolean default false, p_switch boolean default false) returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := gp_require_member(); t game_tables; c json; st text; o record;
begin
  select * into t from game_tables where id = p_table;
  if t.id is null or t.cancelled then raise exception 'Deze tafel bestaat niet meer'; end if;
  if t.host_id = uid then raise exception 'Dit is je eigen tafel'; end if;
  if exists (select 1 from table_players where table_id = p_table and user_id = uid) then
    return json_build_object('status', (select state from table_players where table_id = p_table and user_id = uid));
  end if;
  if gp_table_free(t) <= 0 then
    insert into table_players (table_id, user_id, state) values (p_table, uid, 'waitlist');
    return json_build_object('status', 'waitlist');
  end if;
  if t.exp = 'Kenner' and not coalesce(p_rules_ok, false) then
    return json_build_object('status', 'need_rules');
  end if;
  select coalesce(json_agg(json_build_object('table_id', x.id, 'game', x.game, 'start_time', to_char(x.start_time, 'HH24:MI'),
      'end_time', to_char(x.start_time + make_interval(mins => x.duration_min), 'HH24:MI'), 'mine', x.host_id = uid)), '[]'::json)
  into c
  from game_tables x
  where x.avond_id = t.avond_id and not x.cancelled and x.id <> t.id
    and (x.host_id = uid or exists (select 1 from table_players p where p.table_id = x.id and p.user_id = uid and p.state in ('seated', 'requested')))
    and x.start_time < t.start_time + make_interval(mins => t.duration_min)
    and t.start_time < x.start_time + make_interval(mins => x.duration_min);
  if json_array_length(c) > 0 then
    if not coalesce(p_switch, false) then return json_build_object('status', 'conflict', 'conflicts', c); end if;
    if exists (select 1 from json_array_elements(c) e where (e ->> 'mine')::boolean) then
      raise exception 'Annuleer eerst je eigen tafel als je hier wilt meespelen';
    end if;
    for o in select (e ->> 'table_id')::uuid as tid from json_array_elements(c) e loop
      perform leave_table(o.tid);
    end loop;
  end if;
  st := case when t.mode = 'open' then 'seated' else 'requested' end;
  insert into table_players (table_id, user_id, state) values (p_table, uid, st);
  if st = 'requested' then
    perform gp_notify(t.host_id, gp_name(uid) || ' vraagt een plek aan bij ' || t.game || '.');
  end if;
  return json_build_object('status', st);
end $$;

create or replace function public.leave_table(p_table uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := gp_require_member(); was text;
begin
  delete from table_players where table_id = p_table and user_id = uid returning state into was;
  if was = 'seated' then perform gp_promote(p_table); end if;
end $$;

create or replace function public.respond_table_request(p_table uuid, p_user uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := gp_require_member(); t game_tables;
begin
  select * into t from game_tables where id = p_table;
  if t.id is null or t.host_id <> uid then raise exception 'Dit is niet jouw tafel'; end if;
  if not exists (select 1 from table_players where table_id = p_table and user_id = p_user and state = 'requested') then
    raise exception 'Deze aanvraag bestaat niet meer';
  end if;
  if p_accept then
    if gp_table_free(t) <= 0 then raise exception 'Je tafel is vol. Verwijder eerst een speler.'; end if;
    update table_players set state = 'seated' where table_id = p_table and user_id = p_user;
    perform gp_notify(p_user, 'Je zit aan ' || t.game || ' om ' || to_char(t.start_time, 'HH24:MI') || '. Veel plezier!');
  else
    delete from table_players where table_id = p_table and user_id = p_user;
    perform gp_notify(p_user, 'Er is helaas geen plek meer aan ' || t.game || '. Kijk of er een andere tafel vrij is.');
  end if;
end $$;

create or replace function public.remove_table_player(p_table uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := gp_require_member(); t game_tables; was text;
begin
  select * into t from game_tables where id = p_table;
  if t.id is null or t.host_id <> uid then raise exception 'Dit is niet jouw tafel'; end if;
  delete from table_players where table_id = p_table and user_id = p_user returning state into was;
  if was is not null then
    perform gp_notify(p_user, 'Je plek aan ' || t.game || ' is vrijgegeven. Kijk of er een andere tafel vrij is.');
  end if;
  if was = 'seated' then perform gp_promote(p_table); end if;
end $$;

-- ============================================================ agenda

create or replace function public.list_events() returns json
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := gp_require_member(); today date := (now() at time zone 'Europe/Amsterdam')::date;
begin
  return coalesce((select json_agg(x order by x.date, x.start_time) from (
    select e.id, e.kind, e.title, e.date, to_char(e.start_time, 'HH24:MI') as start_time, e.area, e.game, e.description,
      e.max_people, e.approval, e.auto_regulars, gp_name(e.host_id) as host_name, (e.host_id = uid) as mine,
      (select count(*) from event_attendees a where a.event_id = e.id and a.state = 'going') as going_count,
      (select state from event_attendees a where a.event_id = e.id and a.user_id = uid) as my_state,
      case when e.host_id = uid or exists (select 1 from event_attendees a where a.event_id = e.id and a.user_id = uid and a.state = 'going')
           then (select address from event_private p where p.event_id = e.id) end as address,
      case when e.host_id = uid then coalesce((select json_agg(json_build_object('user_id', a.user_id, 'name', gp_name(a.user_id), 'state', a.state,
            'regular', exists (select 1 from regulars r where r.host_id = uid and r.user_id = a.user_id)) order by a.created_at)
          from event_attendees a where a.event_id = e.id and a.state in ('going', 'requested', 'waitlist')), '[]'::json) else '[]'::json end as attendees
    from events e where not e.cancelled and e.date >= today) x), '[]'::json);
end $$;

create or replace function public.create_event(p_kind text, p_title text, p_date date, p_start time, p_area text, p_game text,
  p_description text, p_max int, p_approval boolean, p_address text) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := gp_require_member(); nid uuid;
begin
  insert into events (kind, title, date, start_time, area, game, description, max_people, host_id, approval)
  values (p_kind, trim(p_title), p_date, coalesce(p_start, '20:00'), coalesce(p_area, ''), coalesce(p_game, ''),
          coalesce(p_description, ''), p_max, uid, coalesce(p_approval, false))
  returning id into nid;
  insert into event_private (event_id, address) values (nid, coalesce(p_address, ''));
  return nid;
end $$;

create or replace function public.cancel_event(p_event uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := gp_require_member(); e events; a record;
begin
  select * into e from events where id = p_event;
  if e.id is null or (e.host_id <> uid and gp_status(uid) <> 'admin') then raise exception 'Dit is niet jouw activiteit'; end if;
  update events set cancelled = true where id = p_event;
  for a in select user_id from event_attendees where event_id = p_event and state in ('going', 'waitlist', 'requested') loop
    perform gp_notify(a.user_id, e.title || ' op ' || to_char(e.date, 'DD-MM') || ' gaat niet door.');
  end loop;
end $$;

create or replace function public.gp_event_full(e events) returns boolean
language sql stable security definer set search_path = public as $$
  select e.max_people is not null and (select count(*) from event_attendees a where a.event_id = e.id and a.state = 'going') >= e.max_people
$$;

-- Vol? Dan vervallen open aanvragen met een neutrale melding.
create or replace function public.gp_expire_requests(p_event uuid) returns void
language plpgsql security definer set search_path = public as $$
declare e events; a record;
begin
  select * into e from events where id = p_event;
  if not gp_event_full(e) then return; end if;
  for a in select user_id from event_attendees where event_id = p_event and state = 'requested' loop
    update event_attendees set state = 'full' where event_id = p_event and user_id = a.user_id;
    perform gp_notify(a.user_id, e.title || ' (' || to_char(e.date, 'DD-MM') || '): deze avond is helaas vol.');
  end loop;
end $$;

create or replace function public.rsvp_event(p_event uuid) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := gp_require_member(); e events; st text;
begin
  select * into e from events where id = p_event;
  if e.id is null or e.cancelled then raise exception 'Deze activiteit bestaat niet meer'; end if;
  if e.host_id = uid then raise exception 'Je bent zelf de organisator'; end if;
  if exists (select 1 from event_attendees where event_id = p_event and user_id = uid and state <> 'full') then
    return (select state from event_attendees where event_id = p_event and user_id = uid);
  end if;
  delete from event_attendees where event_id = p_event and user_id = uid;
  if e.approval then
    if gp_event_full(e) then st := 'full';
    elsif e.auto_regulars and exists (select 1 from regulars where host_id = e.host_id and user_id = uid) then st := 'going';
    else st := 'requested'; end if;
  else
    st := case when gp_event_full(e) then 'waitlist' else 'going' end;
  end if;
  insert into event_attendees (event_id, user_id, state) values (p_event, uid, st);
  if st = 'requested' then perform gp_notify(e.host_id, gp_name(uid) || ' wil graag komen naar ' || e.title || '.'); end if;
  if st = 'going' and e.approval then
    perform gp_notify(e.host_id, gp_name(uid) || ' (vaste speler) komt naar ' || e.title || '.');
    perform gp_expire_requests(p_event);
  end if;
  return st;
end $$;

create or replace function public.cancel_rsvp(p_event uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := gp_require_member(); e events; was text; nxt uuid;
begin
  select * into e from events where id = p_event;
  delete from event_attendees where event_id = p_event and user_id = uid returning state into was;
  if was = 'going' then
    if e.approval then
      perform gp_notify(e.host_id, gp_name(uid) || ' heeft zich afgemeld voor ' || e.title || '.');
    else
      select user_id into nxt from event_attendees where event_id = p_event and state = 'waitlist' order by created_at limit 1;
      if nxt is not null then
        update event_attendees set state = 'going' where event_id = p_event and user_id = nxt;
        perform gp_notify(nxt, 'Er is plek vrijgekomen: je bent aangemeld voor ' || e.title || '.');
      end if;
    end if;
  end if;
end $$;

create or replace function public.respond_event_request(p_event uuid, p_user uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := gp_require_member(); e events;
begin
  select * into e from events where id = p_event;
  if e.id is null or e.host_id <> uid then raise exception 'Dit is niet jouw activiteit'; end if;
  if not exists (select 1 from event_attendees where event_id = p_event and user_id = p_user and state = 'requested') then
    raise exception 'Deze aanvraag bestaat niet meer';
  end if;
  if p_accept then
    if gp_event_full(e) then raise exception 'Je avond is al vol'; end if;
    update event_attendees set state = 'going' where event_id = p_event and user_id = p_user;
    perform gp_notify(p_user, 'Je bent erbij! ' || e.title || ' op ' || to_char(e.date, 'DD-MM') || '. Het adres staat nu in de agenda.');
    perform gp_expire_requests(p_event);
  else
    update event_attendees set state = 'full' where event_id = p_event and user_id = p_user;
    perform gp_notify(p_user, e.title || ' (' || to_char(e.date, 'DD-MM') || '): deze avond is helaas vol.');
  end if;
end $$;

create or replace function public.set_auto_regulars(p_event uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := gp_require_member(); e events; a record;
begin
  select * into e from events where id = p_event;
  if e.id is null or e.host_id <> uid then raise exception 'Dit is niet jouw activiteit'; end if;
  update events set auto_regulars = coalesce(p_on, false) where id = p_event;
  if p_on then
    for a in select ea.user_id from event_attendees ea join regulars r on r.host_id = uid and r.user_id = ea.user_id
             where ea.event_id = p_event and ea.state = 'requested' order by ea.created_at loop
      select * into e from events where id = p_event;
      exit when gp_event_full(e);
      update event_attendees set state = 'going' where event_id = p_event and user_id = a.user_id;
      perform gp_notify(a.user_id, 'Je bent erbij! ' || e.title || ' op ' || to_char(e.date, 'DD-MM') || '. Het adres staat nu in de agenda.');
    end loop;
    perform gp_expire_requests(p_event);
  end if;
end $$;

create or replace function public.set_regular(p_user uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := gp_require_member();
begin
  if p_on then insert into regulars (host_id, user_id) values (uid, p_user) on conflict do nothing;
  else delete from regulars where host_id = uid and user_id = p_user; end if;
end $$;

-- ============================================================ koopgoot

create or replace function public.list_listings() returns json
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := gp_require_member();
begin
  return coalesce((select json_agg(x order by x.created_at desc) from (
    select l.id, l.game, l.price_cents, l.language, l.condition, l.status, l.created_at, gp_name(l.seller_id) as seller_name,
      (l.seller_id = uid) as mine,
      (select state from listing_offers o where o.listing_id = l.id and o.buyer_id = uid and o.state in ('pending', 'accepted')) as my_offer,
      case when l.seller_id = uid then (select count(*) from listing_offers o where o.listing_id = l.id and o.state = 'pending') else 0 end as open_offers
    from listings l where l.status in ('te_koop', 'gereserveerd') or (l.seller_id = uid and l.status = 'verkocht')) x), '[]'::json);
end $$;

create or replace function public.get_listing(p_listing uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := gp_require_member(); l listings; mo listing_offers; r json; contact text; contact_name text;
begin
  select * into l from listings where id = p_listing;
  if l.id is null or (l.status = 'verwijderd' and l.seller_id <> uid) then raise exception 'Advertentie niet gevonden'; end if;
  select * into mo from listing_offers where listing_id = l.id and buyer_id = uid and state in ('pending', 'accepted');
  if mo.state = 'accepted' then
    select phone, gp_name(id) into contact, contact_name from profiles where id = l.seller_id;
  elsif l.seller_id = uid then
    select p.phone, gp_name(p.id) into contact, contact_name from listing_offers o join profiles p on p.id = o.buyer_id
      where o.listing_id = l.id and o.state = 'accepted' limit 1;
  end if;
  select json_build_object('id', l.id, 'game', l.game, 'price_cents', l.price_cents, 'language', l.language, 'condition', l.condition,
    'description', l.description, 'pickup', l.pickup, 'status', l.status, 'created_at', l.created_at,
    'seller_name', gp_name(l.seller_id), 'mine', l.seller_id = uid,
    'seller_since', (select to_char(created_at, 'YYYY') from profiles where id = l.seller_id),
    'seller_sold', (select count(*) from listings x where x.seller_id = l.seller_id and x.status = 'verkocht'),
    'seller_likes', (select likes from profiles where id = l.seller_id),
    'my_offer', case when mo.id is null then null else json_build_object('id', mo.id, 'kind', mo.kind, 'amount_cents', mo.amount_cents, 'state', mo.state) end,
    'contact_phone', contact, 'contact_name', contact_name,
    'offers', case when l.seller_id = uid then coalesce((select json_agg(json_build_object('id', o.id, 'buyer_name', gp_name(o.buyer_id), 'kind', o.kind,
        'amount_cents', o.amount_cents, 'state', o.state) order by o.created_at) from listing_offers o where o.listing_id = l.id and o.state in ('pending', 'accepted')), '[]'::json)
      else '[]'::json end)
  into r;
  return r;
end $$;

create or replace function public.save_listing(p_id uuid, p_game text, p_price_cents int, p_language text, p_condition text, p_description text, p_pickup text) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := gp_require_member(); nid uuid;
begin
  if p_id is null then
    insert into listings (seller_id, game, price_cents, language, condition, description, pickup)
    values (uid, trim(p_game), p_price_cents, coalesce(p_language, 'NL'), coalesce(p_condition, ''), coalesce(p_description, ''), coalesce(p_pickup, ''))
    returning id into nid;
    return nid;
  end if;
  update listings set game = trim(p_game), price_cents = p_price_cents, language = coalesce(p_language, 'NL'), condition = coalesce(p_condition, ''),
    description = coalesce(p_description, ''), pickup = coalesce(p_pickup, '')
  where id = p_id and seller_id = uid;
  if not found then raise exception 'Dit is niet jouw advertentie'; end if;
  return p_id;
end $$;

create or replace function public.set_listing_status(p_listing uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := gp_require_member(); l listings; o record;
begin
  select * into l from listings where id = p_listing;
  if l.id is null or l.seller_id <> uid then raise exception 'Dit is niet jouw advertentie'; end if;
  if p_status not in ('te_koop', 'verkocht', 'verwijderd') then raise exception 'Ongeldige status'; end if;
  update listings set status = p_status where id = p_listing;
  if p_status in ('verkocht', 'verwijderd') then
    for o in select id, buyer_id from listing_offers where listing_id = p_listing and state = 'pending' loop
      update listing_offers set state = 'declined' where id = o.id;
      perform gp_notify(o.buyer_id, l.game || ' is niet meer te koop.');
    end loop;
  end if;
  if p_status = 'te_koop' then
    update listing_offers set state = 'declined' where listing_id = p_listing and state = 'accepted';
  end if;
end $$;

create or replace function public.make_offer(p_listing uuid, p_kind text, p_amount_cents int) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := gp_require_member(); l listings;
begin
  select * into l from listings where id = p_listing;
  if l.id is null or l.status not in ('te_koop', 'gereserveerd') then raise exception 'Deze advertentie is niet meer beschikbaar'; end if;
  if l.seller_id = uid then raise exception 'Dit is je eigen advertentie'; end if;
  if exists (select 1 from listing_offers where listing_id = p_listing and buyer_id = uid and state in ('pending', 'accepted')) then
    raise exception 'Je hebt al een verzoek gedaan';
  end if;
  insert into listing_offers (listing_id, buyer_id, kind, amount_cents)
  values (p_listing, uid, p_kind, case when p_kind = 'kopen' then l.price_cents else p_amount_cents end);
  perform gp_notify(l.seller_id, case when p_kind = 'kopen' then gp_name(uid) || ' wil ' || l.game || ' kopen.'
    else gp_name(uid) || ' biedt € ' || replace(to_char(p_amount_cents / 100.0, 'FM999990.00'), '.', ',') || ' voor ' || l.game || '.' end);
end $$;

create or replace function public.withdraw_offer(p_listing uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := gp_require_member(); o listing_offers; l listings;
begin
  select * into o from listing_offers where listing_id = p_listing and buyer_id = uid and state in ('pending', 'accepted');
  if o.id is null then return; end if;
  update listing_offers set state = 'withdrawn' where id = o.id;
  select * into l from listings where id = p_listing;
  if o.state = 'accepted' and l.status = 'gereserveerd' then update listings set status = 'te_koop' where id = p_listing; end if;
  perform gp_notify(l.seller_id, gp_name(uid) || ' heeft het verzoek voor ' || l.game || ' ingetrokken.');
end $$;

create or replace function public.respond_offer(p_offer uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := gp_require_member(); o listing_offers; l listings;
begin
  select * into o from listing_offers where id = p_offer;
  select * into l from listings where id = o.listing_id;
  if l.id is null or l.seller_id <> uid then raise exception 'Dit is niet jouw advertentie'; end if;
  if o.state <> 'pending' then raise exception 'Dit verzoek is niet meer open'; end if;
  if p_accept then
    if exists (select 1 from listing_offers where listing_id = l.id and state = 'accepted') then
      raise exception 'Je hebt al een koper geaccepteerd';
    end if;
    update listing_offers set state = 'accepted' where id = p_offer;
    update listings set status = 'gereserveerd' where id = l.id;
    perform gp_notify(o.buyer_id, gp_name(uid) || ' heeft je verzoek voor ' || l.game || ' geaccepteerd. Spreek af via WhatsApp in de Koopgoot.');
  else
    update listing_offers set state = 'declined' where id = p_offer;
    perform gp_notify(o.buyer_id, gp_name(uid) || ' gaat niet in op je verzoek voor ' || l.game || '.');
  end if;
end $$;

-- ============================================================ spellotheek

create or replace function public.list_library() returns json
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := gp_require_member();
begin
  return coalesce((select json_agg(x order by x.name) from (
    select g.id, g.name, g.players, g.minutes, g.kind, g.weight,
      exists (select 1 from library_loans l where l.game_id = g.id and l.kind = 'thuis' and l.state = 'uitgeleend') as lent,
      (select l.kind from library_loans l where l.game_id = g.id and l.user_id = uid and l.state = 'aangevraagd' order by l.created_at desc limit 1) as my_request,
      (select count(*) from library_loans l where l.game_id = g.id and l.kind = 'wacht' and l.state = 'aangevraagd') as queue
    from library_games g where g.active) x), '[]'::json);
end $$;

create or replace function public.toggle_library_request(p_game uuid, p_kind text) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := gp_require_member(); cur library_loans; nxt uuid;
begin
  if p_kind not in ('avond', 'thuis', 'wacht') then raise exception 'Ongeldige keuze'; end if;
  select * into cur from library_loans where game_id = p_game and user_id = uid and state = 'aangevraagd' order by created_at desc limit 1;
  if cur.id is not null then
    update library_loans set state = 'geannuleerd' where id = cur.id;
    if cur.kind = p_kind then return null; end if;
  end if;
  select id into nxt from avonden where date >= (now() at time zone 'Europe/Amsterdam')::date order by date limit 1;
  insert into library_loans (game_id, user_id, kind, avond_id) values (p_game, uid, p_kind, nxt);
  return p_kind;
end $$;

create or replace function public.admin_save_library_game(p_id uuid, p_name text, p_players text, p_minutes int, p_kind text, p_weight text) returns uuid
language plpgsql security definer set search_path = public as $$
declare nid uuid;
begin
  perform gp_require_admin();
  if p_id is null then
    insert into library_games (name, players, minutes, kind, weight) values (trim(p_name), coalesce(p_players, ''), p_minutes, coalesce(p_kind, ''), coalesce(p_weight, ''))
    returning id into nid;
    return nid;
  end if;
  update library_games set name = trim(p_name), players = coalesce(p_players, ''), minutes = p_minutes, kind = coalesce(p_kind, ''), weight = coalesce(p_weight, '') where id = p_id;
  return p_id;
end $$;

create or replace function public.admin_list_loans() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  perform gp_require_admin();
  return coalesce((select json_agg(json_build_object('id', l.id, 'game', g.name, 'user_name', gp_name(l.user_id), 'kind', l.kind,
      'state', l.state, 'created_at', l.created_at) order by l.created_at desc)
    from library_loans l join library_games g on g.id = l.game_id where l.state in ('aangevraagd', 'uitgeleend')), '[]'::json);
end $$;

create or replace function public.admin_set_loan_state(p_loan uuid, p_state text) returns void
language plpgsql security definer set search_path = public as $$
declare l library_loans; gname text;
begin
  perform gp_require_admin();
  select * into l from library_loans where id = p_loan;
  select name into gname from library_games where id = l.game_id;
  update library_loans set state = p_state where id = p_loan;
  if p_state = 'uitgeleend' then perform gp_notify(l.user_id, gname || ' staat voor je klaar. Veel speelplezier!'); end if;
end $$;

-- ============================================================ rechten

revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on function public.gp_notify(uuid, text) from authenticated;
revoke execute on function public.gp_promote(uuid) from authenticated;
revoke execute on function public.gp_expire_requests(uuid) from authenticated;
revoke execute on function public.gp_handle_new_user() from authenticated;
