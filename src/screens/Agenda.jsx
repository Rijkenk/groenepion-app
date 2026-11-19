import { useState } from 'preact/hooks';
import { useRpc, useAction, Loading, Chips, Person, Icon, monthShort, dayNum, longDate, plural } from '../ui.jsx';

const KINDS = [{ value: 'thuis', label: 'Spellenavond thuis' }, { value: 'uitje', label: 'Uitje' }, { value: 'overig', label: 'Anders' }];
const KIND_LABEL = { thuis: 'Spellenavond thuis', uitje: 'Uitje', overig: 'Activiteit' };

function today(offset = 7) { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); }

function EventForm({ onDone, onClose }) {
  const act = useAction();
  const [f, setF] = useState({ kind: 'thuis', title: '', date: today(), start: '19:30', area: '', game: '', description: '', max: 4, unlimited: false, approval: true, address: '' });
  const set = (p) => setF({ ...f, ...p });
  async function submit(e) {
    e.preventDefault();
    const r = await act('create_event', { p_kind: f.kind, p_title: f.title, p_date: f.date, p_start: f.start, p_area: f.area, p_game: f.game, p_description: f.description,
      p_max: f.unlimited ? null : f.max, p_approval: f.approval, p_address: f.address }, { ok: 'Je activiteit staat in de agenda.' });
    if (r) onDone();
  }
  return (
    <form class="card strong" onSubmit={submit} style="gap: 12px">
      <div class="row between"><h3>Activiteit organiseren</h3><button type="button" class="round" style="background: #E6ECE7; color: var(--text)" onClick={onClose} aria-label="Sluiten"><Icon.close /></button></div>
      <div style="display: flex; flex-direction: column; gap: 6px"><b style="font-size: 14px">Wat organiseer je?</b>
        <Chips grid="grid3" options={KINDS} value={f.kind} onPick={(v) => set({ kind: v, approval: v === 'thuis' })} /></div>
      <label class="field">Titel<input class="input" required maxLength={120} value={f.title} onInput={(e) => set({ title: e.target.value })} placeholder={f.kind === 'thuis' ? 'Bijv. Coöp-avond bij mij' : 'Bijv. Samen naar de spellenbeurs'} /></label>
      <div class="grid2">
        <label class="field">Datum<input class="input" type="date" required value={f.date} min={today(0)} onInput={(e) => set({ date: e.target.value })} /></label>
        <label class="field">Tijd<input class="input" type="time" required value={f.start} onInput={(e) => set({ start: e.target.value })} /></label>
      </div>
      <label class="field">Wijk of plaats (voor iedereen zichtbaar)<input class="input" value={f.area} onInput={(e) => set({ area: e.target.value })} placeholder="Bijv. Almelo-Noord" /></label>
      <label class="field">Spel (optioneel)<input class="input" value={f.game} onInput={(e) => set({ game: e.target.value })} /></label>
      <label class="field">Toelichting (optioneel)<textarea class="input" value={f.description} onInput={(e) => set({ description: e.target.value })} /></label>
      <div class="grid2">
        <label class="field">Max. aantal gasten<input class="input" type="number" min="1" max="500" disabled={f.unlimited} value={f.max} onInput={(e) => set({ max: Math.max(1, +e.target.value || 1) })} /></label>
        <label class="check" style="align-self: end">Geen maximum<input type="checkbox" checked={f.unlimited} onChange={() => set({ unlimited: !f.unlimited })} /></label>
      </div>
      <label class="check"><input type="checkbox" checked={f.approval} onChange={() => set({ approval: !f.approval })} />Ik keur aanvragen zelf goed</label>
      {f.approval && <div class="small">Bezoekers sturen een aanvraag en zien alleen datum, wijk en spel. Pas als jij akkoord geeft, zien ze het adres. Wie je niet uitnodigt, krijgt de neutrale melding "Deze avond is helaas vol".</div>}
      <label class="field">Adres {f.approval ? '(alleen voor geaccepteerde gasten)' : '(voor aangemelde deelnemers)'}<input class="input" value={f.address} onInput={(e) => set({ address: e.target.value })} placeholder="Straat en huisnummer, plaats" /></label>
      <button class="btn full" disabled={!f.title.trim()}>Zet in de agenda</button>
    </form>
  );
}

function HostEvent({ e, reload }) {
  const act = useAction();
  const going = e.attendees.filter((a) => a.state === 'going');
  const req = e.attendees.filter((a) => a.state === 'requested');
  const wait = e.attendees.filter((a) => a.state === 'waitlist');
  const star = (a) => <button class={'btn sm ' + (a.regular ? 'ghost' : 'grey')} aria-pressed={a.regular} onClick={() => act('set_regular', { p_user: a.user_id, p_on: !a.regular }, { ok: a.regular ? a.name + ' is geen vaste speler meer.' : a.name + ' is nu een vaste speler.', reload })}>{a.regular ? '★ Vaste speler' : '☆ Vast'}</button>;
  return (
    <div class="panel">
      {e.approval && <label class="check"><input type="checkbox" checked={e.auto_regulars} onChange={() => act('set_auto_regulars', { p_event: e.id, p_on: !e.auto_regulars }, { reload })} />Vaste spelers direct goedkeuren</label>}
      <div style="font-size: 13px; font-weight: 700">Gasten ({going.length}{e.max_people ? ' van ' + e.max_people : ''})</div>
      {going.length === 0 && <div class="small">Nog geen gasten.</div>}
      {going.map((a) => <Person name={a.name}>{star(a)}</Person>)}
      {req.length > 0 && <div style="font-size: 13px; font-weight: 700; margin-top: 4px">Aanvragen</div>}
      {req.map((a) => (
        <div style="display: flex; flex-direction: column; gap: 6px">
          <Person name={a.name + (a.regular ? ' · vaste speler' : '')} cls="blue" />
          <div class="row wrap">
            <button class="btn grey sm" onClick={() => act('respond_event_request', { p_event: e.id, p_user: a.user_id, p_accept: false }, { ok: a.name + ' ziet alleen "Deze avond is helaas vol".', reload })}>Niet deze keer</button>
            <button class="btn sm" onClick={() => act('respond_event_request', { p_event: e.id, p_user: a.user_id, p_accept: true }, { ok: a.name + ' is erbij en ziet nu het adres.', reload })}>Accepteren</button>
            {star(a)}
          </div>
        </div>
      ))}
      {wait.length > 0 && <div class="muted">Wachtlijst: {wait.map((a) => a.name).join(', ')}</div>}
      {e.approval && <div class="small">Open aanvragen vervallen vanzelf als je avond vol is.</div>}
      <button class="btn danger-ghost sm" onClick={() => confirm('Activiteit afzeggen? Iedereen die zich heeft aangemeld krijgt een melding.') && act('cancel_event', { p_event: e.id }, { ok: 'Activiteit afgezegd.', reload })}>Activiteit afzeggen</button>
    </div>
  );
}

function EventCard({ e, reload }) {
  const act = useAction();
  const s = e.my_state;
  const count = e.max_people ? `${e.going_count} van ${e.max_people} plekken bezet` : plural(e.going_count, 'aanmelding', 'aanmeldingen');
  const place = [e.address || e.area, e.start_time, e.game].filter(Boolean).join(' · ');
  const rsvp = () => act('rsvp_event', { p_event: e.id }, { reload, ok: (st) => ({ going: 'Je bent aangemeld.', waitlist: 'Je staat op de wachtlijst.', requested: 'Aanvraag verstuurd naar ' + e.host_name + '.', full: 'Deze avond is helaas vol.' })[st] });
  const cancel = () => act('cancel_rsvp', { p_event: e.id }, { reload });
  return (
    <article class="card" style="flex-direction: row; gap: 14px">
      <div class="datebox"><span>{monthShort(e.date)}</span><b>{dayNum(e.date)}</b></div>
      <div class="grow" style="display: flex; flex-direction: column; gap: 4px">
        <div style="font-size: 12px; color: var(--green); font-weight: 600">{e.mine ? 'Jij organiseert' : KIND_LABEL[e.kind]}{e.approval ? ' · op aanvraag' : ''}</div>
        <div class="title">{e.title}</div>
        <div class="muted">{place}</div>
        {!e.mine && <div class="small">Georganiseerd door {e.host_name}</div>}
        {e.description && <div style="font-size: 13px">{e.description}</div>}
        <div style="font-size: 13px; color: var(--muted2)">{count}</div>
        {e.mine ? <HostEvent e={e} reload={reload} /> : e.approval ? (
          <>
            {!s && <><div class="small">De organisator keurt aanvragen goed. Het adres zie je pas na akkoord.</div><button class="btn" style="align-self: flex-start" onClick={rsvp}>Aanvraag sturen</button></>}
            {s === 'requested' && <><div class="note n-blue" role="status">Aanvraag verstuurd naar {e.host_name}. Je krijgt een melding zodra er een reactie is, en dan zie je ook het adres.</div><button class="btn grey sm" style="align-self: flex-start" onClick={cancel}>Aanvraag intrekken</button></>}
            {s === 'going' && <><div class="note n-green" role="status"><strong>Je bent erbij.</strong> Het adres staat hierboven.</div><button class="btn ghost sm" style="align-self: flex-start" onClick={cancel}>Afmelden</button></>}
            {s === 'full' && <div class="note n-grey" role="status">Deze avond is helaas vol.</div>}
          </>
        ) : (
          <>
            {s === 'waitlist' && <div class="note n-blue">Je staat op de wachtlijst. Komt er plek vrij, dan word je automatisch aangemeld.</div>}
            <button class={'btn ' + (s ? 'ghost' : '')} style="align-self: flex-start; margin-top: 4px" onClick={s ? cancel : rsvp}>
              {s === 'going' ? 'Afmelden' : s === 'waitlist' ? 'Van wachtlijst af' : (e.max_people && e.going_count >= e.max_people ? 'Op wachtlijst' : 'Ik kom')}
            </button>
          </>
        )}
      </div>
    </article>
  );
}

export function Agenda() {
  const [events, reload, error] = useRpc('list_events', {});
  const [form, setForm] = useState(false);
  if (!events) return <Loading error={error} retry={reload} />;
  return (
    <>
      <div class="row between"><h2>Agenda</h2>{!form && <button class="btn ghost pill" onClick={() => setForm(true)}>+ Organiseren</button>}</div>
      {form && <EventForm onClose={() => setForm(false)} onDone={() => { setForm(false); reload(); }} />}
      {events.length === 0 && !form && <div class="empty">Er staat nog niets in de agenda. Organiseer zelf een spellenavond thuis of een uitje.</div>}
      {events.map((e) => <EventCard key={e.id} e={e} reload={reload} />)}
      <div class="small">Spelavonden van de club vind je onder Spelavond.</div>
    </>
  );
}
