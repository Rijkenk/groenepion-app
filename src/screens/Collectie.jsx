import { useState } from 'preact/hooks';
import { useApp, useRpc, useAction, Loading, Chips, coverColor } from '../ui.jsx';

const meta = (g) => [g.players && g.players + ' spelers', g.minutes && g.minutes + ' min', g.weight].filter(Boolean).join(' · ');

// Profiel: je eigen spellen bijhouden.
export function MijnCollectie() {
  const act = useAction();
  const [games, reload, error] = useRpc('list_my_games', {});
  const empty = { name: '', players: '', minutes: '', weight: '', lend: false };
  const [f, setF] = useState(empty);
  const [open, setOpen] = useState(false);
  const set = (p) => setF({ ...f, ...p });
  async function add(e) {
    e.preventDefault();
    const r = await act('save_my_game', { p_id: null, p_name: f.name, p_players: f.players, p_minutes: f.minutes ? +f.minutes : null, p_weight: f.weight, p_lend: f.lend },
      { ok: f.name.trim() + ' staat in je collectie.', reload });
    if (r) setF({ ...empty, lend: f.lend });
  }
  const save = (g, p) => act('save_my_game', { p_id: g.id, p_name: g.name, p_players: g.players, p_minutes: g.minutes, p_weight: g.weight, p_lend: g.lend, ...p }, { reload });
  return (
    <section class="card">
      <div class="row between"><h3>Mijn collectie{games && games.length ? ` (${games.length})` : ''}</h3>
        <button type="button" class="btn sm ghost" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Klaar' : '+ Spel'}</button></div>
      <div class="small">Andere leden zien welke spellen je hebt en kunnen vragen of je er een meeneemt naar de spelavond.</div>
      {open && (
        <form onSubmit={add} style="display: flex; flex-direction: column; gap: 10px">
          <label class="field">Naam van het spel<input class="input" required maxLength={120} value={f.name} onInput={(e) => set({ name: e.target.value })} placeholder="Bijv. Cascadia" /></label>
          <div class="grid2">
            <label class="field">Spelers<input class="input" maxLength={20} value={f.players} onInput={(e) => set({ players: e.target.value })} placeholder="2-4" /></label>
            <label class="field">Minuten<input class="input" inputmode="numeric" value={f.minutes} onInput={(e) => set({ minutes: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="45" /></label>
          </div>
          <Chips grid="grid3" options={['Licht', 'Middel', 'Zwaar']} value={f.weight} onPick={(v) => set({ weight: f.weight === v ? '' : v })} />
          <label class="check"><input type="checkbox" checked={f.lend} onChange={() => set({ lend: !f.lend })} />Ik wil dit spel uitlenen aan leden</label>
          <button class="btn" disabled={!f.name.trim()}>Toevoegen</button>
        </form>
      )}
      {!games ? <Loading error={error} retry={reload} /> : games.length === 0 ? <div class="small">Nog geen spellen. Tik op "+ Spel" om te beginnen.</div> : (
        <div style="display: flex; flex-direction: column">
          {games.map((g) => (
            <div class="row" style="min-height: 48px; border-top: 1px solid var(--line)">
              <div class="grow"><div style="font-weight: 600; font-size: 14px">{g.name}</div>{meta(g) && <div class="small">{meta(g)}</div>}</div>
              <button type="button" class={'badge ' + (g.lend ? 'b-green' : 'b-grey')} style="border: 0; min-height: 32px; cursor: pointer" aria-pressed={g.lend}
                aria-label={(g.lend ? 'Uitlenen staat aan' : 'Uitlenen staat uit') + ' voor ' + g.name} onClick={() => save(g, { p_lend: !g.lend })}>{g.lend ? 'Leen ik uit' : 'Niet uitlenen'}</button>
              <button type="button" class="link" style="min-height: 32px" aria-label={g.name + ' verwijderen'} onClick={() => act('delete_my_game', { p_id: g.id }, { ok: g.name + ' is verwijderd.', reload })}>Verwijder</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// Spellotheek-tab: wat hebben de leden zelf?
export function SpellenVanLeden() {
  const act = useAction();
  const { showMember } = useApp();
  const [games, reload, error] = useRpc('list_member_games', {});
  const [q, setQ] = useState('');
  const [openName, setOpenName] = useState(null);
  if (!games) return <Loading error={error} retry={reload} />;
  const term = q.trim().toLowerCase();
  const shown = games.filter((g) => !term || [g.name, g.players, g.weight, ...g.owners.map((o) => o.name)].join(' ').toLowerCase().includes(term));
  const ask = (g, o, kind) => act('ask_member_game', { p_game: o.game_id, p_kind: kind },
    { ok: o.name + ' krijgt een melding' + (kind === 'meenemen' ? ' met je vraag om ' + g.name + ' mee te nemen.' : ' dat je ' + g.name + ' wilt lenen.') });
  return (
    <>
      <label for="zoek-leden" class="muted">Zoek in de spellen van leden</label>
      <input id="zoek-leden" class="input" type="search" value={q} onInput={(e) => setQ(e.target.value)} placeholder="Bijv. Ark Nova of een naam" />
      {games.length === 0 && <div class="empty">Nog geen leden hebben hun spellen ingevuld. Zet die van jou erin via Profiel → Mijn collectie.</div>}
      {games.length > 0 && shown.length === 0 && <div class="empty">Geen spellen gevonden.</div>}
      {shown.map((g) => {
        const others = g.owners.filter((o) => !o.me);
        const isOpen = openName === g.name;
        const who = g.owners.map((o) => (o.me ? 'jij' : o.name)).join(', ');
        return (
          <article class="card" style="flex-direction: row; flex-wrap: wrap; align-items: center; gap: 12px">
            <div class="cover" style={'background:' + coverColor(g.name)}>{g.name.charAt(0)}</div>
            <div class="grow" style="display: flex; flex-direction: column; gap: 3px">
              <div style="font-weight: 700; font-size: 15px">{g.name}</div>
              {meta(g) && <div class="small">{meta(g)}</div>}
              <div style="font-size: 12px; font-weight: 600; color: var(--green)">Bij {who}</div>
            </div>
            {others.length > 0 && <button type="button" class="btn sm ghost" aria-expanded={isOpen} onClick={() => setOpenName(isOpen ? null : g.name)}>{isOpen ? 'Sluiten' : 'Vragen'}</button>}
            {isOpen && (
              <div style="flex-basis: 100%; display: flex; flex-direction: column; gap: 8px">
                <div class="small">De eigenaar krijgt een melding met je naam en, als je dat in je profiel hebt ingevuld, je telefoonnummer.</div>
                {others.map((o) => (
                  <div class="row wrap" style="gap: 8px">
                    <span class="avatar">{o.name.charAt(0)}</span><button type="button" class="link grow" style="text-align: left; font-size: 14px" onClick={() => showMember(o.user_id)}>{o.name}</button>
                    <button type="button" class="btn sm" onClick={() => ask(g, o, 'meenemen')}>Meenemen naar spelavond?</button>
                    {o.lend && <button type="button" class="btn sm ghost" onClick={() => ask(g, o, 'lenen')}>Lenen?</button>}
                  </div>
                ))}
              </div>
            )}
          </article>
        );
      })}
    </>
  );
}
