import { useState } from 'preact/hooks';
import { useApp, useRpc, useAction, Loading, Chips, Person, longDate } from '../ui.jsx';
import { signOut, DEMO } from '../api.js';

function nextFriday() { const d = new Date(); const add = (5 - d.getDay() + 7) % 7 || 7; d.setDate(d.getDate() + add); return d.toISOString().slice(0, 10); }

function Beheer() {
  const act = useAction();
  const [members, reloadM] = useRpc('admin_list_members', {});
  const [loans, reloadL] = useRpc('admin_list_loans', {});
  const [av, setAv] = useState({ date: nextFriday(), start: '20:00', location: "'t Aahoes", address: 'Albardastraat 20, Aadorp', note: '' });
  const [g, setG] = useState({ name: '', players: '', minutes: '', kind: '', weight: 'Middel' });
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
      <form class="card" onSubmit={(e) => { e.preventDefault(); act('admin_create_avond', { p_date: av.date, p_start: av.start, p_location: av.location, p_address: av.address, p_note: av.note }, { ok: 'Spelavond van ' + longDate(av.date) + ' staat erin.' }); }}>
        <h3>Spelavond plannen</h3>
        <div class="grid2">
          <label class="field">Datum<input class="input" type="date" required value={av.date} onInput={(e) => setAv({ ...av, date: e.target.value })} /></label>
          <label class="field">Begintijd<input class="input" type="time" required value={av.start} onInput={(e) => setAv({ ...av, start: e.target.value })} /></label>
        </div>
        <label class="field">Locatie<input class="input" value={av.location} onInput={(e) => setAv({ ...av, location: e.target.value })} /></label>
        <label class="field">Adres<input class="input" value={av.address} onInput={(e) => setAv({ ...av, address: e.target.value })} /></label>
        <label class="field">Mededeling (optioneel)<input class="input" value={av.note} onInput={(e) => setAv({ ...av, note: e.target.value })} placeholder="Bijv. deze keer is er een Koopgoot-tafel" /></label>
        <button class="btn">Spelavond toevoegen</button>
      </form>
      <form class="card" onSubmit={(e) => { e.preventDefault(); act('admin_save_library_game', { p_id: null, p_name: g.name, p_players: g.players, p_minutes: g.minutes ? +g.minutes : null, p_kind: g.kind, p_weight: g.weight }, { ok: g.name + ' staat in de spellotheek.' }).then((r) => r && setG({ ...g, name: '', players: '', minutes: '', kind: '' })); }}>
        <h3>Spel toevoegen aan spellotheek</h3>
        <label class="field">Naam<input class="input" required value={g.name} onInput={(e) => setG({ ...g, name: e.target.value })} /></label>
        <div class="grid2">
          <label class="field">Spelers<input class="input" value={g.players} onInput={(e) => setG({ ...g, players: e.target.value })} placeholder="2-4" /></label>
          <label class="field">Minuten<input class="input" inputmode="numeric" value={g.minutes} onInput={(e) => setG({ ...g, minutes: e.target.value.replace(/\D/g, '') })} placeholder="45" /></label>
        </div>
        <label class="field">Soort<input class="input" value={g.kind} onInput={(e) => setG({ ...g, kind: e.target.value })} placeholder="familie, coöperatief, party…" /></label>
        <Chips grid="grid3" options={['Licht', 'Middel', 'Zwaar']} value={g.weight} onPick={(v) => setG({ ...g, weight: v })} />
        <button class="btn" disabled={!g.name.trim()}>Toevoegen</button>
      </form>
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

export function Profiel() {
  const { me } = useApp();
  const act = useAction();
  const [f, setF] = useState({ name: me.display_name, phone: me.phone, likes: me.likes, bio: me.bio });
  const set = (p) => setF({ ...f, ...p });
  return (
    <>
      <form class="card" onSubmit={(e) => { e.preventDefault(); act('update_profile', { p_name: f.name, p_phone: f.phone, p_bio: f.bio, p_likes: f.likes }, { ok: 'Profiel opgeslagen.' }); }}>
        <div class="row"><span class="avatar gold" style="width: 48px; height: 48px; border-radius: 24px; font-size: 20px">{(f.name || '?').charAt(0)}</span>
          <div class="grow"><div class="title">{f.name || 'Jouw naam'}</div><div class="small">{me.email}{me.status === 'admin' ? ' · beheerder' : ''}</div></div></div>
        <label class="field">Naam<input class="input" required maxLength={60} value={f.name} onInput={(e) => set({ name: e.target.value })} /></label>
        <label class="field">Telefoonnummer (voor WhatsApp)<input class="input" type="tel" inputmode="tel" autocomplete="tel" value={f.phone} onInput={(e) => set({ phone: e.target.value })} placeholder="06 12345678" /></label>
        <div class="small">Je nummer is niet zichtbaar voor andere leden. Alleen als jullie in de Koopgoot een koop accepteren, kan de ander je via WhatsApp bereiken.</div>
        <label class="field">Spellen die je graag speelt<input class="input" maxLength={300} value={f.likes} onInput={(e) => set({ likes: e.target.value })} placeholder="Bijv. coöperatief, Cascadia, deckbuilders" /></label>
        <label class="field">Over jou (optioneel)<textarea class="input" maxLength={500} value={f.bio} onInput={(e) => set({ bio: e.target.value })} /></label>
        <button class="btn">Opslaan</button>
      </form>
      <section class="card">
        <div class="row between"><h3>BoardGameGeek</h3><span class="badge b-grey">Binnenkort</span></div>
        <div class="small">Straks koppel je je BGG-gebruikersnaam, dan vult je collectie zich vanzelf en zien anderen wat je kunt meenemen.</div>
      </section>
      <section class="card">
        <h3>App op je beginscherm</h3>
        <div class="small">iPhone: tik in Safari op Delen en kies "Zet op beginscherm". Android: tik in Chrome op het menu en kies "App installeren".</div>
      </section>
      {me.status === 'admin' && <Beheer />}
      <button class="btn grey" onClick={signOut}>Uitloggen</button>
      <div class="small" style="text-align: center">De Groene Pion app{DEMO ? ' · demoversie' : ''} · gemaakt door KrCreations</div>
    </>
  );
}
