import { useState } from 'preact/hooks';
import { useRpc, useAction, Loading, Chips, coverColor } from '../ui.jsx';

export function Spellen() {
  const [games, reload, error] = useRpc('list_library', {});
  const act = useAction();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('Alles');
  if (!games) return <Loading error={error} retry={reload} />;
  const term = q.trim().toLowerCase();
  const shown = games.filter((g) => {
    if (filter === 'Beschikbaar' && g.lent) return false;
    if (filter === 'Licht' && g.weight !== 'Licht') return false;
    if (filter === 'Zwaar' && g.weight !== 'Zwaar') return false;
    return !term || [g.name, g.kind, g.players].join(' ').toLowerCase().includes(term);
  });
  const toggle = (g, kind) => act('toggle_library_request', { p_game: g.id, p_kind: kind }, {
    reload, ok: (r) => r === 'avond' ? g.name + ' ligt voor je klaar op de volgende spelavond.' : r === 'thuis' ? 'Leenaanvraag voor ' + g.name + ' verstuurd. Het bestuur laat weten wanneer je hem kunt ophalen.' : r === 'wacht' ? 'Je staat in de wachtrij voor ' + g.name + '.' : 'Geannuleerd.',
  });
  return (
    <>
      <label for="zoek" class="muted">Zoek in de spellotheek van de club</label>
      <input id="zoek" class="input" type="search" value={q} onInput={(e) => setQ(e.target.value)} placeholder="Bijv. Azul, coöperatief, 2-4" />
      <Chips cls="sm" options={['Alles', 'Beschikbaar', 'Licht', 'Zwaar']} value={filter} onPick={setFilter} />
      {games.length === 0 && <div class="empty">De spellotheek is nog leeg. Het bestuur voegt de clubspellen toe via Profiel → Beheer.</div>}
      {games.length > 0 && shown.length === 0 && <div class="empty">Geen spellen gevonden.</div>}
      {shown.map((g) => {
        const r = g.my_request;
        const status = g.lent ? 'Uitgeleend' + (r === 'wacht' ? ' · jij staat in de wachtrij' : g.queue ? ` · ${g.queue} in wachtrij` : '')
          : r === 'avond' ? 'Voor jou gereserveerd op de volgende spelavond' : r === 'thuis' ? 'Leenaanvraag ingediend' : 'Beschikbaar';
        const color = g.lent ? 'var(--orange-text)' : r ? 'var(--blue-text)' : 'var(--green)';
        return (
          <article class="card" style="flex-direction: row; flex-wrap: wrap; align-items: center; gap: 12px">
            <div class="cover" style={'background:' + coverColor(g.name)}>{g.name.charAt(0)}</div>
            <div class="grow" style="display: flex; flex-direction: column; gap: 3px">
              <div style="font-weight: 700; font-size: 15px">{g.name}</div>
              <div class="small">{[g.players && g.players + ' spelers', g.minutes && g.minutes + ' min', g.kind, g.weight].filter(Boolean).join(' · ')}</div>
              <div style={'font-size: 12px; font-weight: 600; color:' + color}>{status}</div>
            </div>
            <div style="flex-basis: 100%; display: flex; gap: 8px">
              {g.lent ? <button class={'btn sm grow ' + (r === 'wacht' ? '' : 'ghost')} onClick={() => toggle(g, 'wacht')}>{r === 'wacht' ? 'Uit wachtrij' : 'In wachtrij'}</button> : <>
                <button class={'btn sm grow ' + (r === 'avond' ? '' : 'ghost')} onClick={() => toggle(g, 'avond')}>{r === 'avond' ? 'Spelavond: annuleren' : 'Voor de spelavond'}</button>
                <button class={'btn sm grow ' + (r === 'thuis' ? '' : 'ghost')} onClick={() => toggle(g, 'thuis')}>{r === 'thuis' ? 'Lenen: annuleren' : 'Lenen voor thuis'}</button>
              </>}
            </div>
          </article>
        );
      })}
    </>
  );
}
