// Demomodus: een echte Postgres-database in de browser (PGlite) met dezelfde functies als Supabase.
// Alles staat alleen in het geheugen en begint opnieuw na verversen.
import { PGlite } from '@electric-sql/pglite';
import schema from '../supabase/schema.sql?raw';

const AUTH_STUB = `
create role anon; create role authenticated;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claims'', true)::json->>''sub'','''')::uuid';
`;

const users = [
  { id: '00000000-0000-0000-0000-00000000000a', name: 'Kenneth', note: 'beheerder', status: 'admin', phone: '0611111111', likes: 'Het Witte Kasteel, Cascadia' },
  { id: '00000000-0000-0000-0000-000000000001', name: 'Sanne', note: 'lid', status: 'member', phone: '0612345678', likes: 'expertspellen, Nemesis' },
  { id: '00000000-0000-0000-0000-000000000002', name: 'Joris', note: 'lid', status: 'member', phone: '0687654321', likes: 'kaartspellen, deckbuilders' },
  { id: '00000000-0000-0000-0000-000000000003', name: 'Eva', note: 'lid', status: 'member', phone: '0622222222', likes: 'tweepersoonsspellen' },
  { id: '00000000-0000-0000-0000-000000000004', name: 'Lotte', note: 'lid', status: 'member', phone: '0633333333', likes: 'partyspellen' },
  { id: '00000000-0000-0000-0000-000000000005', name: 'Nieuw lid', note: 'wacht op goedkeuring', status: 'pending', phone: '', likes: '' },
];

function day(offset) {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}
function nextFriday() {
  const d = new Date(); const add = (5 - d.getDay() + 7) % 7 || 7; d.setDate(d.getDate() + add);
  return d.toISOString().slice(0, 10);
}

export async function createDemo() {
  const db = new PGlite();
  await db.exec(AUTH_STUB);
  await db.exec(schema);
  for (const u of users) {
    await db.query('insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)', [u.id, u.name.toLowerCase().replace(/ /g, '') + '@voorbeeld.nl', JSON.stringify({ name: u.name })]);
    await db.query('update public.profiles set status = $2, phone = $3, likes = $4 where id = $1', [u.id, u.status, u.phone, u.likes]);
  }
  let current = null;
  async function rpc(fn, args = {}, uid = current) {
    await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: uid || '' })]);
    const keys = Object.keys(args);
    const r = await db.query(`select public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as v`, keys.map((k) => args[k] ?? null));
    return r.rows[0].v;
  }
  const [K, S, J, E, L] = users.map((u) => u.id);
  const fri = nextFriday();
  const avond = await rpc('admin_create_avond', { p_date: fri, p_start: '20:00', p_location: '', p_address: '', p_note: '' }, K);
  const table = (uid, game, max, pre, start, dur, weight, kind, exp, mode) =>
    rpc('create_table', { p_avond: avond, p_game: game, p_max: max, p_pre: pre, p_start: start, p_duration: dur, p_weight: weight, p_kind: kind, p_exp: exp, p_mode: mode }, uid);
  const nem = await table(S, 'Nemesis: Retaliation', 4, 0, '20:00', 180, 'Zwaar', 'Coöp', 'Ervaren', 'aanvraag');
  const cen = await table(J, 'Century: Spice Road', 5, 0, '20:00', 45, 'Licht', 'Strategie', 'Beginner', 'open');
  await table(E, 'Brass: Birmingham', 4, 1, '20:15', 150, 'Zwaar', 'Strategie', 'Kenner', 'open');
  await table(L, 'Harmonies', 4, 2, '21:30', 45, 'Licht', 'Strategie', 'Beginner', 'open');
  await rpc('join_table', { p_table: cen }, L);
  await rpc('create_event', { p_kind: 'thuis', p_title: 'Expertspellen bij Joris', p_date: day(8), p_start: '19:30', p_area: 'Almelo-Noord', p_game: 'Brass: Birmingham', p_description: 'Zware Euro’s, rustig tempo.', p_max: 3, p_approval: true, p_address: 'Voorbeeldstraat 12, Almelo' }, J);
  const coop = await rpc('create_event', { p_kind: 'thuis', p_title: 'Coöp-avond bij Kenneth', p_date: day(9), p_start: '19:30', p_area: 'Almelo', p_game: 'Spirit Island', p_description: '', p_max: 3, p_approval: true, p_address: 'Jouw adres hier' }, K);
  await rpc('rsvp_event', { p_event: coop }, E);
  await rpc('rsvp_event', { p_event: coop }, L);
  await rpc('rsvp_event', { p_event: coop }, S);
  await rpc('set_regular', { p_user: S, p_on: true }, K);
  await rpc('create_event', { p_kind: 'uitje', p_title: 'Samen naar een spellenbeurs', p_date: day(20), p_start: '10:00', p_area: 'Carpoolen vanaf Almelo', p_game: '', p_description: '', p_max: null, p_approval: false, p_address: '' }, S);
  const sell = (uid, game, cents, lang, cond, desc, pickup) => rpc('save_listing', { p_id: null, p_game: game, p_price_cents: cents, p_language: lang, p_condition: cond, p_description: desc, p_pickup: pickup }, uid);
  await sell(S, 'Libertalia', 2000, 'NL', 'goede staat', 'Compleet, alle kaarten en munten aanwezig.', 'Ophalen op de spelavond of in Almelo.');
  await sell(J, 'Race for the Galaxy', 3000, 'EN', 'gesleeved', 'Met de uitbreidingen The Gathering Storm en Rebel vs Imperium.', 'Ophalen op de spelavond.');
  await sell(E, 'Sky Team', 1500, 'NL', 'als nieuw', 'Twee keer gespeeld.', 'Ophalen in Wierden of op de spelavond.');
  await rpc('save_listing', { p_id: null, p_game: 'Dune: Imperium', p_price_cents: 0, p_language: 'EN', p_condition: 'goede staat', p_description: 'Basisspel, compleet.', p_pickup: 'Ruilen op de spelavond.', p_mode: 'ruil', p_trade_wish: 'Iets coöperatiefs, bijv. Spirit Island of Paleo' }, L);
  await sell(K, 'Cascadero', 1500, 'NL', 'goede staat', 'Compleet en weinig gespeeld.', 'Ophalen op de spelavond of in Almelo.');
  const lib = (name, players, minutes, kind, weight) => rpc('admin_save_library_game', { p_id: null, p_name: name, p_players: players, p_minutes: minutes, p_kind: kind, p_weight: weight }, K);
  await lib('Azul', '2-4', 40, 'familie', 'Licht');
  await lib('Spirit Island', '1-4', 120, 'coöperatief', 'Zwaar');
  await lib('Weerwolven van Wakkerdam', '8-18', 30, 'party', 'Licht');
  await lib('Terraforming Mars', '1-5', 120, 'strategie', 'Zwaar');
  await lib('Cascadia', '1-4', 45, 'familie', 'Licht');
  const own = (uid, name, players, minutes, weight, lend) => rpc('save_my_game', { p_id: null, p_name: name, p_players: players, p_minutes: minutes, p_weight: weight, p_lend: lend }, uid);
  await own(K, 'Het Witte Kasteel', '1-4', 80, 'Middel', false);
  await own(K, 'Cascadia', '1-4', 45, 'Licht', true);
  await own(S, 'Nemesis: Retaliation', '1-4', 180, 'Zwaar', false);
  await own(S, 'Cascadia', '1-4', 45, 'Licht', true);
  await own(S, 'Spirit Island', '1-4', 120, 'Zwaar', true);
  await own(J, 'Ark Nova', '1-4', 150, 'Zwaar', false);
  await own(J, 'Race for the Galaxy', '2-4', 45, 'Middel', false);
  await own(E, 'Sky Team', '2', 20, 'Licht', true);
  await own(E, 'Brass: Birmingham', '2-4', 120, 'Zwaar', false);
  await own(L, 'Codenames', '4-8', 15, 'Licht', true);
  await db.query('update public.notifications set read = true');

  return {
    users,
    session: () => (current ? { user: { id: current } } : null),
    login: (id) => { current = id; },
    logout: () => { current = null; },
    rpc: (fn, args) => rpc(fn, args),
    fn: async (name, body) => {
      if (name !== 'bgg-import') throw new Error('Onbekende functie');
      await new Promise((r) => setTimeout(r, 600));
      if (!body.username) throw new Error('Vul je BGG-gebruikersnaam in.');
      return { games: [
        { bgg_id: 266192, name: 'Wingspan', players: '1-5', minutes: 70, weight: 'Middel' },
        { bgg_id: 230802, name: 'Azul', players: '2-4', minutes: 45, weight: 'Licht' },
        { bgg_id: 342942, name: 'Ark Nova', players: '1-4', minutes: 150, weight: 'Zwaar' },
      ] };
    },
  };
}
