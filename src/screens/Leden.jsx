import { useState } from 'preact/hooks';
import { useRpc, Loading, Icon, euro, coverColor } from '../ui.jsx';

function Sheet({ label, onClose, children }) {
  return (
    <div class="sheet-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog" aria-label={label} style="max-height: 88%">
        {children}
      </div>
    </div>
  );
}
const CloseBtn = ({ onClose }) => <button class="round" style="background: #E6ECE7; color: var(--text); flex: none" onClick={onClose} aria-label="Sluiten"><Icon.close /></button>;

function MemberList({ onPick, onClose }) {
  const [list, reload, error] = useRpc('list_members', {});
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const shown = (list || []).filter((m) => !term || (m.name + ' ' + m.likes).toLowerCase().includes(term));
  return (
    <>
      <div class="row between"><h2>Leden{list ? ` (${list.length})` : ''}</h2><CloseBtn onClose={onClose} /></div>
      <input class="input" type="search" aria-label="Zoek een lid" value={q} onInput={(e) => setQ(e.target.value)} placeholder="Zoek op naam of wat iemand graag speelt" />
      {!list ? <Loading error={error} retry={reload} /> : shown.length === 0 ? <div class="muted">Niemand gevonden.</div> : shown.map((m) => (
        <button class="card" style="flex-direction: row; align-items: center; gap: 10px; text-align: left; cursor: pointer; font: inherit; color: inherit" onClick={() => onPick(m.id)}>
          <span class="avatar">{(m.name || '?').charAt(0)}</span>
          <span class="grow" style="display: flex; flex-direction: column; gap: 2px">
            <b style="font-size: 15px">{m.name}{m.admin ? <span class="badge b-green" style="margin-left: 6px; font-size: 11px; padding: 2px 7px">bestuur</span> : null}</b>
            {m.likes && <span class="small">Houdt van {m.likes}</span>}
          </span>
          <span class="small" style="flex: none">{m.games ? m.games + ' spellen' : ''}</span>
        </button>
      ))}
    </>
  );
}

function MemberProfile({ id, onBack, onClose }) {
  const [m, reload, error] = useRpc('get_member', { p_user: id }, [id]);
  return (
    <>
      <div class="row between">{onBack ? <button class="link" onClick={onBack}>← Alle leden</button> : <span />}<CloseBtn onClose={onClose} /></div>
      {!m ? <Loading error={error} retry={reload} /> : <>
        <div class="row"><span class="avatar gold" style="width: 52px; height: 52px; border-radius: 26px; font-size: 22px">{(m.name || '?').charAt(0)}</span>
          <div class="grow"><div class="big">{m.name}</div><div class="small">{m.admin ? 'Bestuur · ' : ''}lid sinds {m.since}{m.bgg_user ? ' · BGG: ' + m.bgg_user : ''}</div></div></div>
        {m.likes && <div style="font-size: 14px"><b>Speelt graag:</b> {m.likes}</div>}
        {m.bio && <div style="font-size: 14px; white-space: pre-line">{m.bio}</div>}
        {m.wanted.length > 0 && <div style="font-size: 14px"><b>Zoekt:</b> {m.wanted.join(', ')}</div>}
        {m.listings.length > 0 && <section class="card" style="gap: 6px"><h3>In de Koopgoot</h3>
          {m.listings.map((l) => <div class="row between" style="font-size: 14px"><span>{l.game}</span><b>{l.mode === 'ruil' ? 'te ruil' : euro(l.price_cents) + (l.mode === 'beide' ? ' of ruilen' : '')}</b></div>)}</section>}
        <section class="card" style="gap: 6px">
          <h3>Collectie ({m.games.length})</h3>
          {m.games.length === 0 ? <div class="small">{m.me ? 'Je hebt nog geen spellen ingevuld.' : m.name + ' heeft nog geen spellen ingevuld.'}</div> : m.games.map((g) => (
            <div class="row" style="min-height: 40px">
              <div class="cover" style={'width: 32px; height: 32px; font-size: 15px; border-radius: 8px; background:' + coverColor(g.name)}>{g.name.charAt(0)}</div>
              <div class="grow"><div style="font-size: 14px; font-weight: 600">{g.name}</div>
                <div class="small">{[g.players && g.players + ' spelers', g.minutes && g.minutes + ' min', g.weight].filter(Boolean).join(' · ')}</div></div>
              {g.lend && <span class="badge b-green" style="font-size: 11px; padding: 3px 8px">leent uit</span>}
            </div>
          ))}
          {!m.me && m.games.length > 0 && <div class="small">Iets vragen? Ga naar Spellotheek → Bij leden.</div>}
        </section>
      </>}
    </>
  );
}

// Eén venster voor de ledenlijst en losse profielen.
export function Leden({ startId, onClose }) {
  const [id, setId] = useState(startId || null);
  return (
    <Sheet label="Leden" onClose={onClose}>
      {id ? <MemberProfile id={id} onBack={startId ? null : () => setId(null)} onClose={onClose} /> : <MemberList onPick={setId} onClose={onClose} />}
    </Sheet>
  );
}

export function Privacy({ onClose }) {
  return (
    <Sheet label="Privacy" onClose={onClose}>
      <div class="row between"><h2>Privacy</h2><CloseBtn onClose={onClose} /></div>
      <div style="font-size: 14px; display: flex; flex-direction: column; gap: 10px; line-height: 1.5">
        <p style="margin: 0">De Groene Pion-app is van en voor de leden van De Groene Pion. We bewaren zo weinig mogelijk en verkopen niets.</p>
        <div><b>Wat we bewaren</b><br />Je e-mailadres (om in te loggen), je naam, en wat je zelf invult: telefoonnummer, wat je graag speelt, over jou, je collectie en zoeklijst. Daarnaast wat je in de app doet: tafels, aanmeldingen, advertenties, biedingen, leningen en meldingen.</div>
        <div><b>Wie wat ziet</b><br />Andere leden zien je naam, wat je graag speelt, je tekst over jou, je collectie en zoeklijst. Je e-mailadres ziet alleen het bestuur. Je telefoonnummer ziet niemand, behalve als jullie in de Koopgoot een koop accepteren, of als jij een lid vraagt om een spel mee te nemen of te lenen. Het adres van een thuisavond ziet alleen wie door de gastheer is toegelaten.</div>
        <div><b>Waar het staat</b><br />Bij Supabase, op servers in Frankfurt (EU). De app zelf staat op GitHub Pages. Er zijn geen advertenties en geen tracking.</div>
        <div><b>Je rechten</b><br />Onder Profiel kun je al je gegevens downloaden en je account met alles erop en eraan verwijderen. Vragen? Neem contact op met het bestuur via groenepion.nl.</div>
      </div>
    </Sheet>
  );
}
