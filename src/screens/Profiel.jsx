import { useState, useEffect } from 'preact/hooks';
import { useApp, useRpc, useAction, Loading, Chips, Person, longDate, InstallHint, isStandalone } from '../ui.jsx';
import { signOut, DEMO, rpc, callFunction, pushSupported, pushState, enablePush, disablePush } from '../api.js';
import { MijnCollectie } from './Collectie.jsx';

function nextFriday() { const d = new Date(); const add = (5 - d.getDay() + 7) % 7 || 7; d.setDate(d.getDate() + add); return d.toISOString().slice(0, 10); }
function addDays(s, n) { const [y, m, d] = s.split('-').map(Number); const x = new Date(y, m - 1, d + n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }

function AvondForm({ initial, onSave, onClose, saveLabel }) {
  const [av, setAv] = useState(initial);
  const set = (p) => setAv({ ...av, ...p });
  return (
    <form style="display: flex; flex-direction: column; gap: 10px" onSubmit={(e) => { e.preventDefault(); onSave(av); }}>
      <div class="grid2">
        <label class="field">Datum<input class="input" type="date" required value={av.date} onInput={(e) => set({ date: e.target.value })} /></label>
        <label class="field">Begintijd<input class="input" type="time" required value={av.start} onInput={(e) => set({ start: e.target.value })} /></label>
      </div>
      <label class="field">Locatie<input class="input" value={av.location} onInput={(e) => set({ location: e.target.value })} /></label>
      <label class="field">Adres<input class="input" value={av.address} onInput={(e) => set({ address: e.target.value })} /></label>
      <label class="field">Mededeling (optioneel)<input class="input" value={av.note} onInput={(e) => set({ note: e.target.value })} placeholder="Bijv. deze keer is er een Koopgoot-tafel" /></label>
      {av.repeat !== undefined && <label class="field">Hoe vaak?<select class="input" value={av.repeat} onChange={(e) => set({ repeat: +e.target.value })}>
        <option value={1}>Alleen deze avond</option>
        {[3, 6, 12].map((n) => <option value={n}>{n} avonden, elke 2 weken</option>)}
      </select></label>}
      <div class="row">{onClose && <button type="button" class="btn grey grow" onClick={onClose}>Annuleren</button>}<button class="btn grow">{saveLabel}</button></div>
    </form>
  );
}

function AvondenBeheer() {
  const act = useAction();
  const [list, reload] = useRpc('admin_list_avonden', {});
  const [edit, setEdit] = useState(null);
  const [cancel, setCancel] = useState(null);
  const [reason, setReason] = useState('');
  async function plan(av) {
    let n = 0;
    for (let i = 0; i < av.repeat; i++) {
      const r = await act('admin_create_avond', { p_date: addDays(av.date, i * 14), p_start: av.start, p_location: av.location, p_address: av.address, p_note: i === 0 ? av.note : '' });
      if (r) n++; else break;
    }
    if (n) { reload(); return true; }
  }
  return (
    <section class="card">
      <h3>Spelavonden</h3>
      {!list ? <Loading /> : list.length === 0 ? <div class="small">Er staan nog geen spelavonden gepland.</div> : list.map((a) => (
        <div style="display: flex; flex-direction: column; gap: 6px; border-top: 1px solid var(--line); padding-top: 8px">
          {edit === a.id ? <AvondForm saveLabel="Opslaan" initial={{ date: a.date, start: a.start_time, location: a.location, address: a.address, note: a.note }} onClose={() => setEdit(null)}
            onSave={(v) => act('admin_update_avond', { p_id: a.id, p_date: v.date, p_start: v.start, p_location: v.location, p_address: v.address, p_note: v.note }, { ok: 'Spelavond aangepast.', reload }).then(() => setEdit(null))} /> : <>
            <div class="row"><div class="grow"><b style="font-size: 14px">{longDate(a.date)} · {a.start_time}</b><div class="small">{a.location}{a.tables ? ' · ' + a.tables + ' tafels' : ''}{a.note ? ' · ' + a.note : ''}</div></div>
              <button class="btn grey sm" onClick={() => setEdit(a.id)}>Wijzigen</button>
              <button class="btn danger-ghost sm" onClick={() => { setCancel(a.id); setReason(''); }}>Afzeggen</button></div>
            {cancel === a.id && <div class="panel">
              <label class="field">Reden (optioneel, gaat mee in de melding)<input class="input" value={reason} onInput={(e) => setReason(e.target.value)} placeholder="Bijv. de zaal is niet beschikbaar" /></label>
              <div class="small">Iedereen met een tafel of aanmelding voor deze avond krijgt een melding. De tafels worden verwijderd.</div>
              <div class="grid2"><button class="btn grey" onClick={() => setCancel(null)}>Toch niet</button>
                <button class="btn danger" onClick={() => act('admin_cancel_avond', { p_id: a.id, p_reason: reason }, { ok: 'Spelavond afgezegd.', reload }).then(() => setCancel(null))}>Afzeggen</button></div>
            </div>}
          </>}
        </div>
      ))}
      <details style="border-top: 1px solid var(--line); padding-top: 8px"><summary style="min-height: 36px; cursor: pointer; font-weight: 600; color: var(--green)">+ Spelavond plannen</summary>
        <AvondForm saveLabel="Inplannen" initial={{ date: nextFriday(), start: '20:00', location: "'t Aahoes", address: 'Albardastraat 20, Aadorp', note: '', repeat: 1 }} onSave={plan} />
      </details>
    </section>
  );
}

function SpellotheekBeheer() {
  const act = useAction();
  const [games, reload] = useRpc('list_library', {});
  const empty = { id: null, name: '', players: '', minutes: '', kind: '', weight: 'Middel' };
  const [g, setG] = useState(empty);
  const [open, setOpen] = useState(false);
  const save = (e) => { e.preventDefault(); act('admin_save_library_game', { p_id: g.id, p_name: g.name, p_players: g.players, p_minutes: g.minutes ? +g.minutes : null, p_kind: g.kind, p_weight: g.weight }, { ok: g.name + (g.id ? ' is bijgewerkt.' : ' staat in de spellotheek.'), reload }).then((r) => { if (r) { setG(empty); setOpen(false); } }); };
  return (
    <section class="card">
      <div class="row between"><h3>Spellotheek ({(games || []).length})</h3><button class="btn sm ghost" onClick={() => { setG(empty); setOpen(!open); }}>{open ? 'Sluiten' : '+ Spel'}</button></div>
      {open && <form onSubmit={save} style="display: flex; flex-direction: column; gap: 10px">
        <label class="field">Naam<input class="input" required value={g.name} onInput={(e) => setG({ ...g, name: e.target.value })} /></label>
        <div class="grid2">
          <label class="field">Spelers<input class="input" value={g.players} onInput={(e) => setG({ ...g, players: e.target.value })} placeholder="2-4" /></label>
          <label class="field">Minuten<input class="input" inputmode="numeric" value={g.minutes} onInput={(e) => setG({ ...g, minutes: e.target.value.replace(/\D/g, '') })} placeholder="45" /></label>
        </div>
        <label class="field">Soort<input class="input" value={g.kind} onInput={(e) => setG({ ...g, kind: e.target.value })} placeholder="familie, coöperatief, party…" /></label>
        <Chips grid="grid3" options={['Licht', 'Middel', 'Zwaar']} value={g.weight} onPick={(v) => setG({ ...g, weight: v })} />
        <button class="btn" disabled={!g.name.trim()}>{g.id ? 'Opslaan' : 'Toevoegen'}</button>
      </form>}
      {games && games.length > 0 && <details><summary class="muted" style="min-height: 32px; cursor: pointer">Spellen wijzigen of weghalen</summary>
        {games.map((x) => (
          <div class="row" style="min-height: 40px">
            <span class="grow" style="font-size: 14px">{x.name}</span>
            <button class="link" onClick={() => { setG({ id: x.id, name: x.name, players: x.players, minutes: x.minutes ? String(x.minutes) : '', kind: x.kind, weight: x.weight || 'Middel' }); setOpen(true); }}>Wijzigen</button>
            <button class="link" style="color: var(--red)" onClick={() => act('admin_remove_library_game', { p_id: x.id }, { ok: x.name + ' is uit de spellotheek gehaald.', reload })}>Weghalen</button>
          </div>
        ))}
      </details>}
    </section>
  );
}

function Mededeling() {
  const act = useAction();
  const [text, setText] = useState('');
  return (
    <form class="card" onSubmit={(e) => { e.preventDefault(); act('admin_broadcast', { p_text: text }, { ok: (n) => 'Verstuurd naar ' + n + ' leden.' }).then((r) => r && setText('')); }}>
      <h3>Mededeling aan alle leden</h3>
      <div class="small">Iedereen krijgt dit als melding in de app{' '}(en op de telefoon, als pushmeldingen aan staan).</div>
      <textarea class="input" aria-label="Mededeling" maxLength={500} value={text} onInput={(e) => setText(e.target.value)} placeholder="Bijv. vrijdag nemen we afscheid van Henk, er is taart!" />
      <button class="btn" disabled={text.trim().length < 3}>Versturen</button>
    </form>
  );
}

function Beheer() {
  const act = useAction();
  const [members, reloadM] = useRpc('admin_list_members', {});
  const [loans, reloadL] = useRpc('admin_list_loans', {});
  const pending = (members || []).filter((m) => m.status === 'pending');
  const STATUS = { member: 'Lid', admin: 'Beheerder', blocked: 'Geblokkeerd', pending: 'Wacht' };
  return (
    <>
      <h2 style="margin-top: 8px">Beheer</h2>
      <section class="card">
        <h3>Nieuwe leden ({pending.length})</h3>
        {!members ? <Loading /> : pending.length === 0 ? <div class="small">Geen aanmeldingen die wachten.</div> : pending.map((m) => (
          <div style="display: flex; flex-direction: column; gap: 6px">
            <Person name={m.display_name || m.email}><span class="small">{m.email}</span></Person>
            <div class="row"><button class="btn grey sm" onClick={() => act('admin_set_status', { p_user: m.id, p_status: 'blocked' }, { ok: 'Geblokkeerd.', reload: reloadM })}>Weigeren</button>
              <button class="btn sm" onClick={() => act('admin_set_status', { p_user: m.id, p_status: 'member' }, { ok: (m.display_name || m.email) + ' is goedgekeurd.', reload: reloadM })}>Goedkeuren</button></div>
          </div>
        ))}
        <details><summary class="muted" style="min-height: 32px; cursor: pointer">Alle leden ({(members || []).length})</summary>
          {(members || []).filter((m) => m.status !== 'pending').map((m) => (
            <Person name={m.display_name || m.email}>
              <select class="input" style="width: auto; min-height: 36px" value={m.status} aria-label={'Status van ' + (m.display_name || m.email)} onChange={(e) => act('admin_set_status', { p_user: m.id, p_status: e.target.value }, { ok: 'Status aangepast.', reload: reloadM })}>
                {Object.entries(STATUS).map(([v, l]) => <option value={v}>{l}</option>)}
              </select>
            </Person>
          ))}
        </details>
      </section>
      <AvondenBeheer />
      <Mededeling />
      <SpellotheekBeheer />
      <section class="card">
        <h3>Uitleen</h3>
        {!loans ? <Loading /> : loans.length === 0 ? <div class="small">Geen openstaande reserveringen of uitleningen.</div> : loans.map((l) => (
          <div style="display: flex; flex-direction: column; gap: 6px">
            <div style="font-size: 14px"><b>{l.game}</b> · {l.user_name} · {{ avond: 'voor de spelavond', thuis: 'lenen voor thuis', wacht: 'wachtrij' }[l.kind]} · <span class="small">{l.state}</span></div>
            <div class="row wrap">
              {l.state === 'aangevraagd' && l.kind !== 'wacht' && <button class="btn sm" onClick={() => act('admin_set_loan_state', { p_loan: l.id, p_state: 'uitgeleend' }, { reload: reloadL })}>Meegegeven</button>}
              {l.state === 'uitgeleend' && <button class="btn sm" onClick={() => act('admin_set_loan_state', { p_loan: l.id, p_state: 'terug' }, { reload: reloadL })}>Terug ontvangen</button>}
              <button class="btn grey sm" onClick={() => act('admin_set_loan_state', { p_loan: l.id, p_state: 'geannuleerd' }, { reload: reloadL })}>Annuleren</button>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}

// BGG-gewichten (1-5) omzetten naar onze zwaarte.
const weightOf = (w) => (!w ? '' : w < 2.2 ? 'Licht' : w < 3.2 ? 'Middel' : 'Zwaar');

function BggKoppeling({ onImported }) {
  const { me, toast, refreshMe } = useApp();
  const [user, setUser] = useState(me.bgg_user || '');
  const [busy, setBusy] = useState(false);
  async function go(e) {
    e.preventDefault(); setBusy(true);
    try {
      const { games } = await callFunction('bgg-import', { username: user.trim() });
      const list = games.map((g) => ({ ...g, weight: typeof g.weight === 'number' ? weightOf(g.weight) : g.weight }));
      const r = await rpc('import_my_games', { p_bgg_user: user.trim(), p_games: JSON.stringify(list) });
      toast(r.added ? `${r.added} spellen toegevoegd aan je collectie${r.updated ? `, ${r.updated} bijgewerkt` : ''}.` : 'Je collectie was al bijgewerkt.');
      refreshMe(); onImported();
    } catch (x) { toast(x.message, true); }
    setBusy(false);
  }
  return (
    <form class="card" onSubmit={go}>
      <h3>BoardGameGeek</h3>
      <div class="small">Heb je je spellen al op BoardGameGeek staan? Vul je gebruikersnaam in, dan zetten we ze in één keer in je collectie. Je kunt dit later opnieuw doen; dubbele spellen komen er niet bij.</div>
      <label class="field">BGG-gebruikersnaam<input class="input" required maxLength={60} autocapitalize="off" autocomplete="off" value={user} onInput={(e) => setUser(e.target.value)} /></label>
      <button class="btn ghost" disabled={busy || !user.trim()}>{busy ? 'Ophalen bij BGG… (kan even duren)' : 'Collectie ophalen'}</button>
      <div class="small">Speldata via <a href="https://boardgamegeek.com/" target="_blank" rel="noopener">BoardGameGeek</a>.</div>
    </form>
  );
}

function PushKaart() {
  const { toast } = useApp();
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { pushState().then(setSt).catch(() => setSt({ supported: false })); }, []);
  if (DEMO || !st) return null;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (!st.key) return null; // nog niet aangezet door het bestuur
  async function toggle() {
    setBusy(true);
    try { if (st.on) { await disablePush(); toast('Meldingen op deze telefoon staan uit.'); } else { await enablePush(st.key); toast('Meldingen staan aan.'); } setSt(await pushState()); } catch (x) { toast(x.message, true); }
    setBusy(false);
  }
  return (
    <section class="card">
      <h3>Meldingen op je telefoon</h3>
      {!pushSupported() || (ios && !isStandalone())
        ? <div class="small">{ios ? 'Op een iPhone werkt dit alleen als je de app op je beginscherm zet en hem daar opent (iOS 16.4 of nieuwer).' : 'Deze browser ondersteunt geen meldingen. Probeer Chrome.'}</div>
        : <>
          <div class="small">Krijg een melding als iemand aanschuift aan je tafel, je aanvraag is geaccepteerd of er iets op je zoeklijst te koop is.</div>
          <button class="btn ghost" disabled={busy} aria-pressed={st.on} onClick={toggle}>{st.on ? 'Meldingen uitzetten' : 'Meldingen aanzetten'}</button>
        </>}
    </section>
  );
}

function PrivacyAccount() {
  const { showPrivacy, toast } = useApp();
  const [del, setDel] = useState(false);
  const [confirm, setConfirm] = useState('');
  async function download() {
    try {
      const data = await rpc('get_my_data');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'mijn-gegevens-groene-pion.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (x) { toast(x.message, true); }
  }
  async function remove() {
    try { await rpc('delete_my_account'); } catch (x) { toast(x.message, true); return; }
    try { await signOut(); } catch { /* account is al weg */ }
  }
  return (
    <section class="card">
      <h3>Privacy en account</h3>
      <button class="link" onClick={showPrivacy}>Hoe gaan we om met je gegevens?</button>
      <button class="btn grey" onClick={download}>Download mijn gegevens</button>
      {!del ? <button class="btn danger-ghost" onClick={() => setDel(true)}>Account verwijderen</button> : (
        <div class="panel">
          <b style="font-size: 14px">Weet je het zeker?</b>
          <div class="small">Je profiel, collectie, zoeklijst, advertenties, tafels en aanmeldingen worden verwijderd. Dit kan niet ongedaan worden. Typ VERWIJDER om te bevestigen.</div>
          <input class="input" aria-label="Typ VERWIJDER" value={confirm} onInput={(e) => setConfirm(e.target.value)} autocapitalize="characters" />
          <div class="grid2"><button class="btn grey" onClick={() => { setDel(false); setConfirm(''); }}>Annuleren</button>
            <button class="btn danger" disabled={confirm.trim().toUpperCase() !== 'VERWIJDER'} onClick={remove}>Verwijderen</button></div>
        </div>
      )}
    </section>
  );
}

export function Profiel() {
  const { me, showMembers } = useApp();
  const act = useAction();
  const [f, setF] = useState({ name: me.display_name, phone: me.phone, likes: me.likes, bio: me.bio });
  const [colKey, setColKey] = useState(0);
  const set = (p) => setF({ ...f, ...p });
  return (
    <>
      <InstallHint />
      <form class="card" onSubmit={(e) => { e.preventDefault(); act('update_profile', { p_name: f.name, p_phone: f.phone, p_bio: f.bio, p_likes: f.likes }, { ok: 'Profiel opgeslagen.' }); }}>
        <div class="row"><span class="avatar gold" style="width: 48px; height: 48px; border-radius: 24px; font-size: 20px">{(f.name || '?').charAt(0)}</span>
          <div class="grow"><div class="title">{f.name || 'Jouw naam'}</div><div class="small">{me.email}{me.status === 'admin' ? ' · beheerder' : ''}</div></div></div>
        <label class="field">Naam<input class="input" required maxLength={60} value={f.name} onInput={(e) => set({ name: e.target.value })} /></label>
        <label class="field">Telefoonnummer (voor WhatsApp)<input class="input" type="tel" inputmode="tel" autocomplete="tel" value={f.phone} onInput={(e) => set({ phone: e.target.value })} placeholder="06 12345678" /></label>
        <div class="small">Je nummer is niet zichtbaar voor andere leden. Alleen als jullie in de Koopgoot een koop accepteren, of als jij iemand om een spel vraagt, krijgt die ander je nummer.</div>
        <label class="field">Spellen die je graag speelt<input class="input" maxLength={300} value={f.likes} onInput={(e) => set({ likes: e.target.value })} placeholder="Bijv. coöperatief, Cascadia, deckbuilders" /></label>
        <label class="field">Over jou (optioneel)<textarea class="input" maxLength={500} value={f.bio} onInput={(e) => set({ bio: e.target.value })} /></label>
        <button class="btn">Opslaan</button>
      </form>
      <button class="btn ghost full" onClick={showMembers}>Bekijk de leden van de club</button>
      <MijnCollectie key={colKey} />
      <BggKoppeling onImported={() => setColKey(colKey + 1)} />
      <PushKaart />
      {me.status === 'admin' && <Beheer />}
      <PrivacyAccount />
      <button class="btn grey" onClick={signOut}>Uitloggen</button>
      <div class="small" style="text-align: center">De Groene Pion app{DEMO ? ' · demoversie' : ''} · gemaakt door KrCreations</div>
    </>
  );
}
