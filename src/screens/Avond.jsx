import { useState } from 'preact/hooks';
import { useApp, useRpc, useAction, Loading, Chips, Stepper, Person, Icon, longDate, durText, plural, WEIGHT_BADGE, EXP } from '../ui.jsx';

function mapsLinks(address) {
  const a = encodeURIComponent(address);
  const ua = navigator.userAgent;
  return {
    def: /iPhone|iPad|iPod|Macintosh/.test(ua) ? 'https://maps.apple.com/?daddr=' + a : /Android/.test(ua) ? 'geo:0,0?q=' + a : 'https://www.google.com/maps/dir/?api=1&destination=' + a,
    google: 'https://www.google.com/maps/dir/?api=1&destination=' + a,
    apple: 'https://maps.apple.com/?daddr=' + a,
    waze: 'https://waze.com/ul?q=' + a + '&navigate=yes',
  };
}

const TIMES = ['19:30', '19:45', '20:00', '20:15', '20:30', '20:45', '21:00', '21:30', '22:00', '22:30'];
const DURS = [[30, '30 min'], [45, '45 min'], [60, '1 uur'], [90, '1,5 uur'], [120, '2 uur'], [150, '2,5 uur'], [180, '3 uur'], [240, '4 uur']];

function OfferForm({ avond, onDone, onClose }) {
  const act = useAction();
  const [f, setF] = useState({ game: '', max: 4, pre: 0, start: avond.start_time || '20:00', dur: 90, weight: 'Middel', kind: 'Strategie', exp: 'Beginner', mode: 'open' });
  const set = (p) => setF({ ...f, ...p });
  const still = f.max - 1 - f.pre;
  const [mine] = useRpc('list_my_games', {});
  const pick = (name) => { const g = (mine || []).find((x) => x.name.toLowerCase() === name.trim().toLowerCase()); return g && g.weight ? { weight: g.weight } : {}; };
  async function submit(e) {
    e.preventDefault();
    const r = await act('create_table', { p_avond: avond.id, p_game: f.game, p_max: f.max, p_pre: f.pre, p_start: f.start, p_duration: f.dur, p_weight: f.weight, p_kind: f.kind, p_exp: f.exp, p_mode: f.mode }, { ok: 'Je tafel staat erop.' });
    if (r) onDone();
  }
  return (
    <form class="card strong" onSubmit={submit} style="gap: 14px">
      <div class="row between"><h3>Tafel aanbieden</h3><button type="button" class="round" style="background: #E6ECE7; color: var(--text)" onClick={onClose} aria-label="Sluiten"><Icon.close /></button></div>
      <label class="field">Welk spel?<input class="input" required maxLength={120} value={f.game} list="mijn-spellen" autocomplete="off" onInput={(e) => set({ game: e.target.value, ...pick(e.target.value) })} placeholder="Bijv. Cascadia" /></label>
      {mine && mine.length > 0 && <datalist id="mijn-spellen">{mine.map((g) => <option value={g.name} />)}</datalist>}
      <div class="field" style="display: flex; flex-direction: column; gap: 6px"><b style="font-size: 14px">Aantal spelers (inclusief jij)</b>
        <Stepper label="Aantal spelers" value={f.max} min={2} max={12} onChange={(v) => set({ max: v, pre: Math.min(f.pre, v - 2) })} /></div>
      <div style="display: flex; flex-direction: column; gap: 6px"><b style="font-size: 14px">Plekken al bezet (bijv. vrienden die meespelen)</b>
        <Stepper label="Bezette plekken" value={f.pre} min={0} max={f.max - 2} onChange={(v) => set({ pre: v })} />
        <div class="small">{f.pre ? `Je zoekt nog ${plural(still, 'speler', 'spelers')}. Dat staat bij je tafel.` : 'Speel je al met vrienden? Zet hier hoeveel plekken al bezet zijn.'}</div></div>
      <div class="grid2">
        <label class="field">Starttijd<select class="input" value={f.start} onChange={(e) => set({ start: e.target.value })}>{TIMES.map((t) => <option>{t}</option>)}</select></label>
        <label class="field">Duur<select class="input" value={f.dur} onChange={(e) => set({ dur: +e.target.value })}>{DURS.map(([v, l]) => <option value={v}>{l}</option>)}</select></label>
      </div>
      <div style="display: flex; flex-direction: column; gap: 6px"><b style="font-size: 14px">Zwaarte</b><Chips grid="grid3" options={['Licht', 'Middel', 'Zwaar']} value={f.weight} onPick={(v) => set({ weight: v })} /></div>
      <div style="display: flex; flex-direction: column; gap: 6px"><b style="font-size: 14px">Soort spel</b><Chips grid="grid2" options={['Coöp', 'Party', 'Strategie', 'Overig']} value={f.kind} onPick={(v) => set({ kind: v })} /></div>
      <div style="display: flex; flex-direction: column; gap: 6px"><b style="font-size: 14px">Voor wie is je tafel?</b>
        <Chips grid="grid1" options={Object.entries(EXP).map(([v, e]) => ({ value: v, label: e.form }))} value={f.exp} onPick={(v) => set({ exp: v })} />
        {f.exp === 'Kenner' && <div class="note n-orange">Er wordt geen uitleg gegeven. Bij je tafel staat dat kennis van het spel vereist is, en wie aanschuift bevestigt eerst dat hij de regels kent.</div>}</div>
      <div style="display: flex; flex-direction: column; gap: 6px"><b style="font-size: 14px">Wie mag aanschuiven?</b>
        <Chips grid="grid2" options={[{ value: 'open', label: 'Open tafel' }, { value: 'aanvraag', label: 'Op aanvraag' }]} value={f.mode} onPick={(v) => set({ mode: v })} />
        <div class="small">{f.mode === 'open' ? 'Iedereen kan direct aanschuiven zolang er plek is. Je kunt spelers later nog verwijderen.' : 'Spelers vragen een plek aan en jij accepteert of weigert. Een weigering krijgt een neutrale melding, zonder reden.'}</div></div>
      <button class="btn full" disabled={!f.game.trim()}>Tafel plaatsen</button>
    </form>
  );
}

function Seats({ t }) {
  const dots = [];
  const filled = t.max_players - t.free;
  for (let i = 0; i < t.max_players; i++) {
    const me = (t.mine && i === 0) || (t.my_state === 'seated' && i === filled - 1);
    dots.push(<span class={'seat' + (me ? ' me' : i < filled ? ' taken' : '')} />);
  }
  return <div class="seats" aria-label={`${filled} van ${t.max_players} plekken bezet`}>{dots}<span class="muted" style="margin-left: 6px">{seatText(t)}</span></div>;
}
function seatText(t) {
  if (t.free <= 0) return t.waitlist_count ? `Vol · ${t.waitlist_count} op wachtlijst` : 'Vol';
  return plural(t.free, 'plek vrij', 'plekken vrij');
}

function HostPanel({ t, reload }) {
  const act = useAction();
  const { me } = useApp();
  const seated = t.players.filter((p) => p.state === 'seated');
  const req = t.players.filter((p) => p.state === 'requested');
  const wait = t.players.filter((p) => p.state === 'waitlist');
  return (
    <div class="panel">
      <div style="font-size: 13px; font-weight: 700">Spelers aan jouw tafel · {t.mode === 'open' ? 'open tafel' : 'op aanvraag'}</div>
      <Person name={(me.display_name || 'Jij') + ' (jij) · aanbieder'} cls="gold" />
      {t.pre_taken > 0 && <div class="row" style="min-height: 40px"><span class="avatar" style="background: #CFE3D6; color: var(--green-dark); font-size: 13px">+{t.pre_taken}</span><span style="font-size: 14px">Eigen groep · {plural(t.pre_taken, 'plek', 'plekken')} al bezet</span></div>}
      {seated.map((p) => <Person name={p.name}><button class="btn grey sm" onClick={() => act('remove_table_player', { p_table: t.id, p_user: p.user_id }, { ok: p.name + ' krijgt een neutrale melding dat de plek is vrijgegeven.', reload })}>Verwijderen</button></Person>)}
      {req.length > 0 && <div style="font-size: 13px; font-weight: 700; margin-top: 4px">Aanvragen</div>}
      {req.map((p) => <Person name={p.name} cls="blue">
        <button class="btn grey sm" onClick={() => act('respond_table_request', { p_table: t.id, p_user: p.user_id, p_accept: false }, { ok: p.name + ' krijgt een neutrale melding.', reload })}>Weigeren</button>
        <button class="btn sm" onClick={() => act('respond_table_request', { p_table: t.id, p_user: p.user_id, p_accept: true }, { ok: p.name + ' zit aan je tafel.', reload })}>Accepteren</button>
      </Person>)}
      {wait.length > 0 && <div class="muted">Wachtlijst: {wait.map((p) => p.name).join(', ')}</div>}
      {seated.length === 0 && req.length === 0 && <div class="small">Nog niemand aangeschoven. Spelers zien je tafel nu in de app.</div>}
    </div>
  );
}

function TableCard({ t, reload }) {
  const act = useAction();
  const [ask, setAsk] = useState(null); // {type:'rules'} | {type:'conflict', conflicts}
  async function join(rulesOk = false, sw = false) {
    const r = await act('join_table', { p_table: t.id, p_rules_ok: rulesOk, p_switch: sw });
    if (!r) return;
    if (r.status === 'need_rules') return setAsk({ type: 'rules' });
    if (r.status === 'conflict') return setAsk({ type: 'conflict', conflicts: r.conflicts, rulesOk });
    setAsk(null);
    await reload();
  }
  const leave = () => act('leave_table', { p_table: t.id }, { reload });
  let btn;
  if (t.mine) btn = <button class="btn ghost" onClick={() => confirm('Weet je zeker dat je je tafel wilt annuleren? Spelers krijgen een melding.') && act('cancel_table', { p_table: t.id }, { ok: 'Je tafel is geannuleerd.', reload })}>Tafel annuleren</button>;
  else if (t.my_state === 'seated') btn = <button class="btn ghost" onClick={leave}>Afmelden</button>;
  else if (t.my_state === 'requested') btn = <button class="btn ghost" onClick={leave}>Aanvraag intrekken</button>;
  else if (t.my_state === 'waitlist') btn = <button class="btn ghost" onClick={leave}>Van wachtlijst af</button>;
  else if (t.free <= 0) btn = <button class="btn" onClick={() => join()}>Op wachtlijst</button>;
  else btn = <button class="btn" onClick={() => join()}>{t.mode === 'aanvraag' ? 'Aanvragen' : 'Aanschuiven'}</button>;
  const hasMine = ask?.conflicts?.some((c) => c.mine);
  return (
    <article class="card">
      <div class="row between" style="align-items: flex-start">
        <div class="grow"><div class="title">{t.game}</div>
          <div class="muted">{t.mine ? 'Jouw tafel' : 'Tafel van ' + t.host_name} · {t.start_time}{t.mode === 'aanvraag' ? ' · op aanvraag' : ''}</div>
          <div class="small">{t.kind} · {durText(t.duration_min)} · tot {t.end_time}</div></div>
        <span class={'badge ' + WEIGHT_BADGE[t.weight]}>{t.weight}</span>
      </div>
      <Seats t={t} />
      <div class="row wrap">
        <span class={'badge ' + EXP[t.exp].cls}>{EXP[t.exp].label}</span>
        {t.pre_taken > 0 && t.free > 0 && <span class="badge b-sand">Zoekt nog {plural(t.free, 'speler', 'spelers')}</span>}
        {t.my_state === 'requested' && <span class="badge b-blue">Aanvraag verstuurd</span>}
      </div>
      {t.mine && <HostPanel t={t} reload={reload} />}
      {ask?.type === 'rules' && (
        <div class="note n-sand" role="alertdialog" aria-label="Ken je de regels al?" style="display: flex; flex-direction: column; gap: 8px">
          <b style="font-size: 15px; color: var(--text)">Ken je de regels al?</b>
          <span>Aan deze kennerstafel wordt geen uitleg gegeven. Je schuift aan als je het spel al eens gespeeld hebt.</span>
          <div class="grid2"><button class="btn grey" onClick={() => setAsk(null)}>Nee, nog niet</button><button class="btn" onClick={() => join(true)}>Ja, ik ken ze</button></div>
        </div>
      )}
      {ask?.type === 'conflict' && (
        <div class="note n-orange" role="alertdialog" aria-label="Overlap met een andere tafel" style="display: flex; flex-direction: column; gap: 8px">
          <b style="font-size: 15px; color: var(--text)">Dit overlapt met een andere tafel</b>
          <span>{ask.conflicts.map((c) => (c.mine ? 'Je bent zelf aanbieder van ' : 'Je zit al aan ') + `${c.game} (${c.start_time} tot ${c.end_time})`).join('. ')}. {hasMine ? 'Annuleer eerst je eigen tafel als je hier wilt meespelen.' : 'Wissel je, dan komt je plek aan de andere tafel vrij.'}</span>
          <div class="grid2"><button class="btn grey" onClick={() => setAsk(null)}>Annuleren</button>{!hasMine && <button class="btn" onClick={() => join(ask.rulesOk, true)}>Wissel naar deze tafel</button>}</div>
        </div>
      )}
      {!ask && btn}
    </article>
  );
}

export function Avond() {
  const { me } = useApp();
  const [data, reload, error] = useRpc('get_avond', {});
  const [offer, setOffer] = useState(false);
  const [mapsOpen, setMapsOpen] = useState(false);
  const [fw, setFw] = useState('Alles');
  const [fk, setFk] = useState('Alles');
  if (!data) return <Loading error={error} retry={reload} />;
  if (!data.avond) return (
    <div class="empty"><b>Er is nog geen spelavond gepland.</b><span>Zodra het bestuur de volgende spelavond in de app zet, zie je hem hier.</span>
      {me.status === 'admin' && <span class="small">Als beheerder plan je een spelavond via Profiel → Beheer.</span>}</div>
  );
  const a = data.avond;
  const addr = `${a.location}, ${a.address}`;
  const m = mapsLinks(addr);
  const free = data.tables.reduce((s, t) => s + Math.max(0, t.free), 0);
  const hasMine = data.tables.some((t) => t.mine);
  const shown = data.tables.filter((t) => t.mine || ((fw === 'Alles' || t.weight === fw) && (fk === 'Alles' || t.kind === fk)));
  return (
    <>
      <section class="card" style="gap: 6px">
        <div class="eyebrow">Volgende spelavond</div>
        <div class="big">{longDate(a.date)}</div>
        <div class="row wrap muted">
          <a href={m.def} target="_blank" rel="noopener" style="display: inline-flex; align-items: center; gap: 4px; min-height: 32px; font-weight: 600"><Icon.pin />{addr}</a>
          <span>· vanaf {a.start_time}</span>
        </div>
        {a.note && <div class="note n-sand">{a.note}</div>}
        <button class="link" onClick={() => setMapsOpen(!mapsOpen)}>{mapsOpen ? 'Sluiten' : 'Andere routeplanner kiezen'}</button>
        {mapsOpen && <div class="grid3">
          <a class="btn grey sm" style="display: flex; align-items: center; justify-content: center; text-decoration: none" href={m.google} target="_blank" rel="noopener">Google Maps</a>
          <a class="btn grey sm" style="display: flex; align-items: center; justify-content: center; text-decoration: none" href={m.apple} target="_blank" rel="noopener">Apple Kaarten</a>
          <a class="btn grey sm" style="display: flex; align-items: center; justify-content: center; text-decoration: none" href={m.waze} target="_blank" rel="noopener">Waze</a>
        </div>}
        <div class="stats" style="margin-top: 8px">
          <div class="stat"><b>{data.going_count}</b><span>aan een tafel</span></div>
          <div class="stat"><b>{free}</b><span>plekken vrij</span></div>
          <div class="stat sand"><b>{data.tables.length}</b><span>tafels</span></div>
        </div>
      </section>
      <div class="row between" style="margin-top: 4px">
        <h2>Tafels</h2>
        {!offer && !hasMine && <button class="btn ghost pill" onClick={() => setOffer(true)}>+ Tafel aanbieden</button>}
      </div>
      {offer && <OfferForm avond={a} onClose={() => setOffer(false)} onDone={() => { setOffer(false); reload(); }} />}
      {data.tables.length > 0 && (
        <div style="display: flex; flex-direction: column; gap: 6px">
          <div class="filterrow" role="group" aria-label="Filter op zwaarte"><span>Zwaarte</span><Chips cls="sm" options={['Alles', 'Licht', 'Middel', 'Zwaar']} value={fw} onPick={setFw} /></div>
          <div class="filterrow" role="group" aria-label="Filter op soort"><span>Soort</span><Chips cls="sm" options={['Alles', 'Coöp', 'Party', 'Strategie']} value={fk} onPick={setFk} /></div>
        </div>
      )}
      {data.tables.length === 0 && !offer && <div class="empty">Nog geen tafels. Wees de eerste en bied een tafel aan!</div>}
      {data.tables.length > 0 && shown.length === 0 && <div class="empty">Geen tafels met deze filters.<button class="btn grey sm" onClick={() => { setFw('Alles'); setFk('Alles'); }}>Filters wissen</button></div>}
      {shown.map((t) => <TableCard key={t.id} t={t} reload={reload} />)}
    </>
  );
}
