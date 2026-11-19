// Test van alle databasefuncties tegen een echte Postgres (PGlite).
import assert from 'node:assert/strict';
import { makeDb, client, addUser } from './pg.mjs';

const db = await makeDb();
const U = {
  admin: '00000000-0000-0000-0000-00000000000a',
  sanne: '00000000-0000-0000-0000-000000000001',
  joris: '00000000-0000-0000-0000-000000000002',
  eva: '00000000-0000-0000-0000-000000000003',
  lotte: '00000000-0000-0000-0000-000000000004',
  nieuw: '00000000-0000-0000-0000-000000000005',
};
await addUser(db, U.admin, 'kenneth@example.nl', 'Kenneth', 'admin');
await addUser(db, U.sanne, 'sanne@example.nl', 'Sanne', 'member');
await addUser(db, U.joris, 'joris@example.nl', 'Joris', 'member');
await addUser(db, U.eva, 'eva@example.nl', 'Eva', 'member');
await addUser(db, U.lotte, 'lotte@example.nl', 'Lotte', 'member');
await addUser(db, U.nieuw, 'nieuw@example.nl', '', null);
const as = Object.fromEntries(Object.entries(U).map(([k, v]) => [k, client(db, v)]));
const anon = client(db, null);
let passed = 0;
async function t(name, fn) { try { await fn(); passed++; console.log('ok  ', name); } catch (e) { console.log('FAIL', name, '\n    ', e.message); process.exitCode = 1; } }
async function rejects(p, re) { await assert.rejects(p, e => re.test(e.message)); }

await t('nieuwe gebruiker krijgt pending-profiel met naam uit e-mail', async () => {
  const me = await as.nieuw('get_me');
  assert.equal(me.status, 'pending');
  assert.equal(me.display_name, 'nieuw');
});
await t('niet ingelogd en pending kunnen niets lezen', async () => {
  await rejects(anon('get_avond'), /Niet ingelogd/);
  await rejects(as.nieuw('list_events'), /goedgekeurd/);
  assert.equal(await anon('get_me'), null);
});
await t('beheerder keurt goed, lid niet', async () => {
  await rejects(as.sanne('admin_set_status', { p_user: U.nieuw, p_status: 'member' }), /beheerders/);
  const list = await as.admin('admin_list_members');
  assert.equal(list[0].status, 'pending');
  await as.admin('admin_set_status', { p_user: U.nieuw, p_status: 'member' });
  assert.equal((await as.nieuw('get_me')).status, 'member');
  assert.match((await as.nieuw('list_notifications'))[0].body, /goedgekeurd/);
});

let avond, nemesis, century, brass, harmonies;
await t('spelavond aanmaken en tafels aanbieden', async () => {
  const d = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
  avond = await as.admin('admin_create_avond', { p_date: d, p_start: '20:00', p_location: '', p_address: '', p_note: '' });
  const mk = (who, game, max, pre, start, dur, weight, kind, exp, mode) => as[who]('create_table', { p_avond: avond, p_game: game, p_max: max, p_pre: pre, p_start: start, p_duration: dur, p_weight: weight, p_kind: kind, p_exp: exp, p_mode: mode });
  nemesis = await mk('sanne', 'Nemesis', 4, 0, '20:00', 180, 'Zwaar', 'Coöp', 'Ervaren', 'aanvraag');
  century = await mk('joris', 'Century', 3, 0, '20:00', 45, 'Licht', 'Strategie', 'Beginner', 'open');
  brass = await mk('eva', 'Brass', 4, 1, '20:15', 150, 'Zwaar', 'Strategie', 'Kenner', 'open');
  harmonies = await mk('lotte', 'Harmonies', 4, 2, '21:30', 45, 'Licht', 'Strategie', 'Beginner', 'open');
  await rejects(mk('lotte', 'Te vol', 4, 3, '20:00', 60, 'Licht', 'Party', 'Beginner', 'open'), /plek vrij/);
  const a = await as.admin('get_avond');
  assert.equal(a.tables.length, 4);
  assert.equal(a.avond.location, "'t Aahoes");
  assert.equal(a.tables.find(x => x.id === harmonies).free, 1);
  assert.equal(a.tables.find(x => x.id === brass).end_time, '22:45');
});
await t('open tafel: aanschuiven, kennerstafel vraagt eerst om regels', async () => {
  assert.equal((await as.admin('join_table', { p_table: century })).status, 'seated');
  assert.equal((await as.admin('join_table', { p_table: brass })).status, 'need_rules');
});
await t('overlap geeft conflict, wisselen verlaat de andere tafel', async () => {
  const r = await as.admin('join_table', { p_table: brass, p_rules_ok: true });
  assert.equal(r.status, 'conflict');
  assert.equal(r.conflicts[0].game, 'Century');
  const r2 = await as.admin('join_table', { p_table: brass, p_rules_ok: true, p_switch: true });
  assert.equal(r2.status, 'seated');
  const a = await as.admin('get_avond');
  assert.equal(a.tables.find(x => x.id === century).my_state, null);
  assert.equal(a.tables.find(x => x.id === brass).my_state, 'seated');
});
await t('geen overlap met tafel die later begint', async () => {
  assert.equal((await as.joris('join_table', { p_table: harmonies })).status, 'seated');
});
await t('vol: wachtlijst, bij afmelden schuift wachtlijst door met melding', async () => {
  // Harmonies: max 4, host + 2 bezet + Joris = vol
  assert.equal((await as.sanne('join_table', { p_table: harmonies })).status, 'waitlist');
  await as.joris('leave_table', { p_table: harmonies });
  const a = await as.sanne('get_avond');
  assert.equal(a.tables.find(x => x.id === harmonies).my_state, 'seated');
  assert.match((await as.sanne('list_notifications'))[0].body, /plek vrijgekomen/);
});
await t('op aanvraag: gastheer accepteert of weigert neutraal', async () => {
  // Joris is zelf gastheer van Century (20:00): overlap met eigen tafel mag niet weggewisseld worden
  assert.equal((await as.joris('join_table', { p_table: nemesis })).status, 'conflict');
  await rejects(as.joris('join_table', { p_table: nemesis, p_switch: true }), /eigen tafel/);
  await as.joris('cancel_table', { p_table: century });
  assert.equal((await as.joris('join_table', { p_table: nemesis })).status, 'requested');
  assert.equal((await as.nieuw('join_table', { p_table: nemesis })).status, 'requested');
  const host = (await as.sanne('get_avond')).tables.find(x => x.id === nemesis);
  assert.equal(host.players.length, 2);
  await rejects(as.joris('respond_table_request', { p_table: nemesis, p_user: U.nieuw, p_accept: true }), /niet jouw tafel/);
  await as.sanne('respond_table_request', { p_table: nemesis, p_user: U.joris, p_accept: true });
  await as.sanne('respond_table_request', { p_table: nemesis, p_user: U.nieuw, p_accept: false });
  assert.match((await as.nieuw('list_notifications'))[0].body, /geen plek meer/);
  const other = (await as.joris('get_avond')).tables.find(x => x.id === nemesis);
  assert.equal(other.my_state, 'seated');
  assert.deepEqual(other.players, []); // niet-gastheer ziet geen spelerslijst
});
await t('gastheer verwijdert speler en annuleert tafel', async () => {
  await as.sanne('remove_table_player', { p_table: nemesis, p_user: U.joris });
  assert.match((await as.joris('list_notifications'))[0].body, /vrijgegeven/);
  await as.eva('cancel_table', { p_table: brass });
  assert.match((await as.admin('list_notifications'))[0].body, /gaat niet door/);
  assert.ok((await as.admin('get_avond')).tables.length >= 1);
});

let thuis, uitje;
await t('thuisavond: adres verborgen tot akkoord', async () => {
  const d = new Date(Date.now() + 8 * 864e5).toISOString().slice(0, 10);
  thuis = await as.joris('create_event', { p_kind: 'thuis', p_title: 'Expertspellen bij Joris', p_date: d, p_start: '19:30', p_area: 'Almelo-Noord', p_game: 'Brass', p_description: '', p_max: 2, p_approval: true, p_address: 'Voorbeeldstraat 12, Almelo' });
  uitje = await as.admin('create_event', { p_kind: 'uitje', p_title: 'Spellenbeurs', p_date: d, p_start: '10:00', p_area: 'Essen', p_game: '', p_description: '', p_max: 1, p_approval: false, p_address: '' });
  let ev = (await as.sanne('list_events')).find(e => e.id === thuis);
  assert.equal(ev.address, null);
  assert.equal(await as.sanne('rsvp_event', { p_event: thuis }), 'requested');
  ev = (await as.sanne('list_events')).find(e => e.id === thuis);
  assert.equal(ev.address, null);
  assert.equal((await as.joris('list_events')).find(e => e.id === thuis).address, 'Voorbeeldstraat 12, Almelo');
  await as.joris('respond_event_request', { p_event: thuis, p_user: U.sanne, p_accept: true });
  ev = (await as.sanne('list_events')).find(e => e.id === thuis);
  assert.equal(ev.my_state, 'going');
  assert.equal(ev.address, 'Voorbeeldstraat 12, Almelo');
});
await t('thuisavond: weigeren is neutraal, vol laat open aanvragen vervallen', async () => {
  await as.eva('rsvp_event', { p_event: thuis });
  await as.lotte('rsvp_event', { p_event: thuis });
  await as.joris('respond_event_request', { p_event: thuis, p_user: U.eva, p_accept: false });
  assert.match((await as.eva('list_notifications'))[0].body, /helaas vol/);
  await as.joris('respond_event_request', { p_event: thuis, p_user: U.lotte, p_accept: true });
  // max 2 bereikt; nieuwe aanvraag geeft direct 'full'
  assert.equal(await as.admin('rsvp_event', { p_event: thuis }), 'full');
  assert.equal((await as.eva('list_events')).find(e => e.id === thuis).address, null);
});
await t('vaste spelers direct goedkeuren', async () => {
  const d = new Date(Date.now() + 9 * 864e5).toISOString().slice(0, 10);
  const ev2 = await as.joris('create_event', { p_kind: 'thuis', p_title: 'Coöp bij Joris', p_date: d, p_start: '19:30', p_area: 'Almelo', p_game: '', p_description: '', p_max: 1, p_approval: true, p_address: 'Adres 1' });
  await as.eva('rsvp_event', { p_event: ev2 });
  await as.lotte('rsvp_event', { p_event: ev2 });
  await as.joris('set_regular', { p_user: U.lotte, p_on: true });
  await as.joris('set_auto_regulars', { p_event: ev2, p_on: true });
  const list = (await as.joris('list_events')).find(e => e.id === ev2).attendees;
  assert.equal(list.find(a => a.name === 'Lotte').state, 'going');
  assert.equal(list.find(a => a.name === 'Eva'), undefined); // vervallen ('full') en niet meer in de lijst
  assert.equal((await as.eva('list_events')).find(e => e.id === ev2).my_state, 'full');
});
await t('gewone activiteit: wachtlijst schuift door', async () => {
  assert.equal(await as.sanne('rsvp_event', { p_event: uitje }), 'going');
  assert.equal(await as.eva('rsvp_event', { p_event: uitje }), 'waitlist');
  await as.sanne('cancel_rsvp', { p_event: uitje });
  assert.equal((await as.eva('list_events')).find(e => e.id === uitje).my_state, 'going');
});

let listing;
await t('koopgoot: kopen, accepteren, telefoonnummer pas na akkoord', async () => {
  await as.sanne('update_profile', { p_name: 'Sanne', p_phone: '0612345678', p_bio: '', p_likes: 'Nemesis' });
  await as.joris('update_profile', { p_name: 'Joris', p_phone: '0687654321', p_bio: '', p_likes: '' });
  listing = await as.sanne('save_listing', { p_id: null, p_game: 'Libertalia', p_price_cents: 2000, p_language: 'NL', p_condition: 'goede staat', p_description: 'Compleet', p_pickup: 'Spelavond' });
  assert.equal((await as.joris('list_listings')).length, 1);
  await as.joris('make_offer', { p_listing: listing, p_kind: 'bod', p_amount_cents: 1600 });
  await rejects(as.joris('make_offer', { p_listing: listing, p_kind: 'kopen', p_amount_cents: 0 }), /al een verzoek/);
  await as.eva('make_offer', { p_listing: listing, p_kind: 'kopen', p_amount_cents: 1 });
  let d = await as.joris('get_listing', { p_listing: listing });
  assert.equal(d.contact_phone, null);
  assert.equal(d.my_offer.amount_cents, 1600);
  const seller = await as.sanne('get_listing', { p_listing: listing });
  assert.equal(seller.offers.length, 2);
  assert.equal(seller.offers.find(o => o.kind === 'kopen').amount_cents, 2000);
  await as.sanne('respond_offer', { p_offer: seller.offers.find(o => o.buyer_name === 'Joris').id, p_accept: true });
  d = await as.joris('get_listing', { p_listing: listing });
  assert.equal(d.contact_phone, '0612345678');
  assert.equal(d.status, 'gereserveerd');
  assert.equal((await as.sanne('get_listing', { p_listing: listing })).contact_phone, '0687654321');
  assert.equal((await as.eva('get_listing', { p_listing: listing })).contact_phone, null);
});
await t('koopgoot: verwijderen meldt open bieders, alleen verkoper mag', async () => {
  await rejects(as.joris('set_listing_status', { p_listing: listing, p_status: 'verwijderd' }), /niet jouw/);
  await as.sanne('set_listing_status', { p_listing: listing, p_status: 'verwijderd' });
  assert.match((await as.eva('list_notifications'))[0].body, /niet meer te koop/);
  assert.equal((await as.joris('list_listings')).length, 0);
});

await t('spellotheek: reserveren voor spelavond en lenen, wisselen en annuleren', async () => {
  const g = await as.admin('admin_save_library_game', { p_id: null, p_name: 'Azul', p_players: '2-4', p_minutes: 40, p_kind: 'familie', p_weight: 'Licht' });
  await rejects(as.sanne('admin_save_library_game', { p_id: null, p_name: 'X', p_players: '', p_minutes: null, p_kind: '', p_weight: '' }), /beheerders/);
  assert.equal(await as.sanne('toggle_library_request', { p_game: g, p_kind: 'avond' }), 'avond');
  assert.equal(await as.sanne('toggle_library_request', { p_game: g, p_kind: 'thuis' }), 'thuis');
  assert.equal((await as.sanne('list_library'))[0].my_request, 'thuis');
  const loans = await as.admin('admin_list_loans');
  assert.equal(loans.length, 1);
  await as.admin('admin_set_loan_state', { p_loan: loans[0].id, p_state: 'uitgeleend' });
  assert.equal((await as.joris('list_library'))[0].lent, true);
  assert.equal(await as.joris('toggle_library_request', { p_game: g, p_kind: 'wacht' }), 'wacht');
  assert.equal(await as.joris('toggle_library_request', { p_game: g, p_kind: 'wacht' }), null);
});
await t('collectie: toevoegen, dubbel weigeren, samenvoegen per spel, vragen om mee te nemen', async () => {
  const a = await as.sanne('save_my_game', { p_id: null, p_name: 'Cascadia', p_players: '1-4', p_minutes: 45, p_weight: 'Licht', p_lend: true });
  await rejects(as.sanne('save_my_game', { p_id: null, p_name: ' cascadia ', p_players: '', p_minutes: null, p_weight: '', p_lend: false }), /al in je collectie/);
  await as.joris('save_my_game', { p_id: null, p_name: 'CASCADIA', p_players: '', p_minutes: null, p_weight: '', p_lend: false });
  await as.joris('save_my_game', { p_id: null, p_name: 'Ark Nova', p_players: '1-4', p_minutes: 150, p_weight: 'Zwaar', p_lend: false });
  const all = await as.eva('list_member_games');
  assert.equal(all.length, 2);
  const cas = all.find((g) => g.name.toLowerCase() === 'cascadia');
  assert.equal(cas.owners.length, 2);
  assert.equal(cas.players, '1-4');
  assert.equal(cas.mine, false);
  assert.equal((await as.sanne('list_my_games')).length, 1);
  await rejects(as.joris('save_my_game', { p_id: a, p_name: 'Gestolen', p_players: '', p_minutes: null, p_weight: '', p_lend: false }), /niet in jouw collectie/);
  await as.joris('delete_my_game', { p_id: a });
  assert.equal((await as.sanne('list_my_games')).length, 1);
  const ark = all.find((g) => g.name === 'Ark Nova').owners[0].game_id;
  await rejects(as.eva('ask_member_game', { p_game: ark, p_kind: 'lenen' }), /niet uitgeleend/);
  await as.eva('ask_member_game', { p_game: ark, p_kind: 'meenemen' });
  assert.match((await as.joris('list_notifications'))[0].body, /^Eva vraagt of je Ark Nova meeneemt/);
  await rejects(as.eva('ask_member_game', { p_game: ark, p_kind: 'meenemen' }), /vandaag al gevraagd/);
  await as.eva('ask_member_game', { p_game: a, p_kind: 'lenen' });
  assert.match((await as.sanne('list_notifications'))[0].body, /Cascadia wilt uitlenen/);
  await rejects(as.sanne('ask_member_game', { p_game: a, p_kind: 'meenemen' }), /eigen spel/);
  await as.admin('admin_set_status', { p_user: U.joris, p_status: 'blocked' });
  assert.equal((await as.eva('list_member_games')).length, 1);
  await as.admin('admin_set_status', { p_user: U.joris, p_status: 'member' });
});
await t('meldingen gelezen markeren', async () => {
  assert.ok((await as.sanne('get_me')).unread > 0);
  await as.sanne('mark_notifications_read');
  assert.equal((await as.sanne('get_me')).unread, 0);
});
await t('zoeklijst: melding bij nieuw spel in de koopgoot, met maximumprijs', async () => {
  await as.eva('add_wanted', { p_term: 'Wingspan', p_max_cents: 3000 });
  await as.lotte('add_wanted', { p_term: 'wingspan', p_max_cents: null });
  await rejects(as.eva('add_wanted', { p_term: 'WINGSPAN ', p_max_cents: null }), /al op je zoeklijst/);
  await rejects(as.eva('add_wanted', { p_term: 'W', p_max_cents: null }), /twee letters/);
  await as.joris('save_listing', { p_id: null, p_game: 'Wingspan + Europa', p_price_cents: 3500, p_language: 'NL', p_condition: '', p_description: '', p_pickup: '' });
  assert.match((await as.lotte('list_notifications'))[0].body, /^Op je zoeklijst: Wingspan \+ Europa staat in de Koopgoot voor € 35 \(van Joris\)/);
  assert.doesNotMatch((await as.eva('list_notifications'))[0]?.body || '', /Wingspan/);
  const w = await as.eva('list_wanted');
  assert.equal(w.mine.length, 1);
  assert.equal(w.mine[0].matches, 0);
  assert.equal(w.all[0].count, 2);
  assert.equal((await as.lotte('list_wanted')).mine[0].matches, 1);
  await as.eva('delete_wanted', { p_id: w.mine[0].id });
  assert.equal((await as.eva('list_wanted')).mine.length, 0);
});
await t('leden bekijken zonder e-mail of telefoon', async () => {
  const list = await as.eva('list_members');
  assert.ok(list.length >= 5);
  assert.equal(list[0].email, undefined);
  const s = await as.eva('get_member', { p_user: U.sanne });
  assert.equal(s.name, 'Sanne');
  assert.equal(s.phone, undefined);
  assert.equal(s.games.length, 1);
  await rejects(anon('list_members'), /Niet ingelogd/);
});
await t('beheer: avond verplaatsen en afzeggen meldt de spelers, mededeling aan iedereen', async () => {
  const day = new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10);
  const av = await as.admin('admin_create_avond', { p_date: day, p_start: '20:00', p_location: '', p_address: '', p_note: '' });
  const tb = await as.eva('create_table', { p_avond: av, p_game: 'Azul', p_max: 4, p_pre: 0, p_start: '20:00', p_duration: 60, p_weight: 'Licht', p_kind: 'Overig', p_exp: 'Beginner', p_mode: 'open' });
  await as.lotte('join_table', { p_table: tb });
  await rejects(as.eva('admin_update_avond', { p_id: av, p_date: day, p_start: '20:30', p_location: '', p_address: '', p_note: '' }), /beheerders/);
  await as.admin('admin_update_avond', { p_id: av, p_date: day, p_start: '20:30', p_location: '', p_address: '', p_note: 'Koffie staat klaar' });
  assert.match((await as.lotte('list_notifications'))[0].body, /verplaatst naar .* om 20:30/);
  assert.ok((await as.admin('admin_list_avonden')).some((a) => a.id === av && a.note === 'Koffie staat klaar'));
  await as.admin('admin_cancel_avond', { p_id: av, p_reason: 'De zaal is dicht.' });
  assert.match((await as.eva('list_notifications'))[0].body, /gaat niet door\. De zaal is dicht\./);
  const n = await as.admin('admin_broadcast', { p_text: 'Vrijdag is er taart!' });
  assert.ok(n >= 5);
  assert.equal((await as.joris('list_notifications'))[0].body, 'Mededeling: Vrijdag is er taart!');
});
await t('push: abonnement opslaan en weer weghalen, sleutel uit instellingen', async () => {
  assert.equal((await as.eva('get_push_config')).vapid_public, null);
  await db.query("insert into public.app_config values ('vapid_public', 'BPUBLIEK') on conflict (key) do update set value = excluded.value");
  assert.equal((await as.eva('get_push_config')).vapid_public, 'BPUBLIEK');
  await rejects(as.eva('save_push_subscription', { p_endpoint: 'http://x', p_p256dh: 'a', p_auth: 'b' }), /Ongeldig/);
  await as.eva('save_push_subscription', { p_endpoint: 'https://push.example/1', p_p256dh: 'a', p_auth: 'b' });
  assert.equal((await db.query('select count(*)::int as c from public.push_subscriptions')).rows[0].c, 1);
  await as.eva('delete_push_subscription', { p_endpoint: 'https://push.example/1' });
  assert.equal((await db.query('select count(*)::int as c from public.push_subscriptions')).rows[0].c, 0);
});
await t('BGG-import: nieuwe spellen erbij, bestaande bijgewerkt', async () => {
  const r = await as.sanne('import_my_games', { p_bgg_user: 'sanne_bgg', p_games: JSON.stringify([
    { bgg_id: 266192, name: 'Wingspan', players: '1-5', minutes: 70, weight: 'Middel' },
    { bgg_id: 291453, name: 'cascadia', players: '1-4', minutes: 45 },
    { bgg_id: 1, name: '' }]) });
  assert.deepEqual(r, { added: 1, updated: 1 });
  assert.equal((await as.sanne('list_my_games')).length, 2);
  assert.equal((await as.sanne('get_me')).bgg_user, 'sanne_bgg');
  const again = await as.sanne('import_my_games', { p_bgg_user: 'sanne_bgg', p_games: JSON.stringify([{ bgg_id: 266192, name: 'Wingspan (NL)' }]) });
  assert.deepEqual(again, { added: 0, updated: 1 });
});
await t('privacy: eigen gegevens downloaden en account verwijderen', async () => {
  const d = await as.lotte('get_my_data');
  assert.equal(d.profiel.display_name, 'Lotte');
  assert.ok(d.meldingen.length > 0);
  await as.admin('admin_set_status', { p_user: U.joris, p_status: 'admin' });
  await as.joris('delete_my_account');
  assert.equal(await as.joris('get_me'), null);
  assert.equal((await db.query("select count(*)::int as c from auth.users where id = $1", [U.joris])).rows[0].c, 0);
  await rejects(as.admin('delete_my_account'), /enige beheerder/);
});
await t('schema is opnieuw te draaien', async () => {
  const fs = await import('node:fs');
  await db.exec(fs.readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
  assert.ok((await as.admin('get_avond')).tables.length >= 1);
});
console.log(`\n${passed} tests geslaagd`);
