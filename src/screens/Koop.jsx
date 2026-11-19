import { useState } from 'preact/hooks';
import { useApp, useRpc, useAction, Loading, Chips, Person, Icon, euro, shortDate, waLink, coverColor, plural } from '../ui.jsx';

const priceText = (l) => l.mode === 'ruil' ? 'Te ruil' : l.mode === 'beide' ? euro(l.price_cents) + ' of ruilen' : euro(l.price_cents);
const offerText = (o) => o.kind === 'ruil' ? 'ruilt tegen ' + o.trade_game : (o.kind === 'bod' ? 'bod ' : 'koopt voor ') + euro(o.amount_cents);
const STATUS = { te_koop: ['Te koop', 'b-green'], gereserveerd: ['Gereserveerd', 'b-blue'], verkocht: ['Verkocht', 'b-grey'] };
function statusOf(l) {
  if (l.my_offer === 'accepted') return ['Voor jou gereserveerd', 'b-blue'];
  if (l.my_offer === 'pending') return ['Verzoek verstuurd', 'b-blue'];
  if (l.mine && l.open_offers > 0) return [plural(l.open_offers, 'verzoek', 'verzoeken'), 'b-sand'];
  return STATUS[l.status] || ['', 'b-grey'];
}

function ListingForm({ initial, onDone, onClose }) {
  const act = useAction();
  const [f, setF] = useState(initial ? { game: initial.game, price: String(initial.price_cents / 100).replace('.', ','), language: initial.language, condition: initial.condition, description: initial.description, pickup: initial.pickup, mode: initial.mode || 'verkoop', wish: initial.trade_wish || '' }
    : { game: '', price: '', language: 'NL', condition: '', description: '', pickup: 'Ophalen op de spelavond.', mode: 'verkoop', wish: '' });
  const set = (p) => setF({ ...f, ...p });
  const cents = f.mode === 'ruil' ? 0 : Math.round(parseFloat(String(f.price).replace(',', '.')) * 100);
  async function submit(e) {
    e.preventDefault();
    const r = await act('save_listing', { p_id: initial?.id ?? null, p_game: f.game, p_price_cents: cents, p_language: f.language, p_condition: f.condition, p_description: f.description, p_pickup: f.pickup, p_mode: f.mode, p_trade_wish: f.mode === 'verkoop' ? '' : f.wish }, { ok: initial ? 'Advertentie bijgewerkt.' : 'Je spel staat in de Koopgoot.' });
    if (r) onDone(r);
  }
  return (
    <form class="card strong" onSubmit={submit} style="gap: 12px">
      <div class="row between"><h3>{initial ? 'Advertentie bewerken' : 'Spel aanbieden'}</h3><button type="button" class="round" style="background: #E6ECE7; color: var(--text)" onClick={onClose} aria-label="Sluiten"><Icon.close /></button></div>
      <label class="field">Spel<input class="input" required maxLength={120} value={f.game} onInput={(e) => set({ game: e.target.value })} /></label>
      <div role="group" aria-label="Verkopen of ruilen"><Chips grid="grid3" options={[{ value: 'verkoop', label: 'Verkopen' }, { value: 'ruil', label: 'Ruilen' }, { value: 'beide', label: 'Allebei' }]} value={f.mode} onPick={(v) => set({ mode: v })} /></div>
      {f.mode !== 'verkoop' && <label class="field">Wat zoek je in ruil? (optioneel)<input class="input" maxLength={300} value={f.wish} onInput={(e) => set({ wish: e.target.value })} placeholder="Bijv. iets coöperatiefs, of Cascadia" /></label>}
      <div class="grid2">
        {f.mode !== 'ruil' && <label class="field">Prijs in euro<input class="input" required inputmode="decimal" value={f.price} onInput={(e) => set({ price: e.target.value })} placeholder="15" /></label>}
        <label class="field">Taal<select class="input" value={f.language} onChange={(e) => set({ language: e.target.value })}>{['NL', 'EN', 'DE', 'Taalonafhankelijk'].map((l) => <option>{l}</option>)}</select></label>
      </div>
      <label class="field">Staat<input class="input" value={f.condition} onInput={(e) => set({ condition: e.target.value })} placeholder="Bijv. als nieuw, 3x gespeeld, gesleeved" /></label>
      <label class="field">Omschrijving<textarea class="input" value={f.description} onInput={(e) => set({ description: e.target.value })} placeholder="Compleet? Uitbreidingen erbij?" /></label>
      <label class="field">Ophalen<input class="input" value={f.pickup} onInput={(e) => set({ pickup: e.target.value })} /></label>
      <button class="btn full" disabled={!f.game.trim() || !(cents >= 0)}>{initial ? 'Opslaan' : 'Plaatsen'}</button>
    </form>
  );
}

function Detail({ id, onBack }) {
  const { me } = useApp();
  const act = useAction();
  const [d, reload, error] = useRpc('get_listing', { p_listing: id }, [id]);
  const [bid, setBid] = useState(null);
  const [swap, setSwap] = useState(null);
  const [warn, setWarn] = useState(false);
  const [edit, setEdit] = useState(false);
  const [remove, setRemove] = useState(null);
  if (!d) return <><button class="link" onClick={onBack}>← Terug naar de Koopgoot</button><Loading error={error} retry={reload} /></>;
  if (edit) return <ListingForm initial={d} onClose={() => setEdit(false)} onDone={() => { setEdit(false); reload(); }} />;
  const [st, cls] = d.status === 'te_koop' ? STATUS.te_koop : d.my_offer?.state === 'accepted' ? ['Voor jou gereserveerd', 'b-blue'] : (STATUS[d.status] || ['', '']);
  const contact = d.contact_phone ? waLink(d.contact_phone, d.mine
    ? `Hoi ${d.contact_name}, je kunt ${d.game} van me kopen via de Groene Pion-app. Wanneer wil je hem ophalen?`
    : d.my_offer.kind === 'ruil' ? `Hoi ${d.contact_name}, je hebt mijn ruilvoorstel (${d.my_offer.trade_game} voor ${d.game}) via de Groene Pion-app geaccepteerd. Zullen we ruilen op de spelavond?`
    : `Hoi ${d.contact_name}, je hebt mijn aankoop van ${d.game} (${euro(d.my_offer.amount_cents)}) via de Groene Pion-app geaccepteerd. Zullen we afspreken op de spelavond?`) : null;
  const waBlock = (who) => !warn ? <button class="btn full" style="background: #25D366; border-color: #25D366" onClick={() => setWarn(true)}>App {who} via WhatsApp</button> : (
    <div class="note n-sand" role="alertdialog" style="display: flex; flex-direction: column; gap: 8px">
      <b style="color: var(--text)">Let op: jullie zien elkaars telefoonnummer</b>
      <span>Via WhatsApp ziet {who} jouw nummer en jij het zijne. Deel daarna geen bank- of inloggegevens en betaal bij voorkeur bij het ophalen.</span>
      <div class="grid2"><button class="btn grey" onClick={() => setWarn(false)}>Annuleren</button><a class="btn" style="display: flex; align-items: center; justify-content: center; text-decoration: none; background: #25D366; border-color: #25D366" href={contact} target="_blank" rel="noopener">Open WhatsApp</a></div>
    </div>
  );
  return (
    <>
      <button class="link" onClick={onBack}>← Terug naar de Koopgoot</button>
      <article class="card" style="padding: 0; overflow: hidden; gap: 0">
        <div style={'height: 140px; color: #fff; display: flex; align-items: center; justify-content: center; font-family: Space Grotesk, sans-serif; font-weight: 700; font-size: 56px; background:' + coverColor(d.game)}>{d.game.charAt(0)}</div>
        <div style="padding: 14px 16px; display: flex; flex-direction: column; gap: 8px">
          <div class="row between" style="align-items: flex-start"><div class="grow"><div class="big">{d.game}</div><div class="muted">{[d.language, d.condition].filter(Boolean).join(' · ')}</div></div><span class={'badge ' + cls}>{st}</span></div>
          <div class="big" style="font-size: 26px">{priceText(d)}</div>
          {d.mode !== 'verkoop' && d.trade_wish && <div style="font-size: 14px"><b>Zoekt in ruil:</b> {d.trade_wish}</div>}
          {d.description && <div style="font-size: 14px">{d.description}</div>}
          {d.pickup && <div class="muted">{d.pickup}</div>}
          <div class="small">Aangeboden {shortDate(d.created_at)}</div>
        </div>
      </article>
      {!d.mine && (
        <section class="card">
          <Person name={d.seller_name}><span class="small">lid sinds {d.seller_since}</span></Person>
          <div class="small">{plural(d.seller_sold, 'spel', 'spellen')} verkocht via de app{d.seller_likes ? ' · houdt van ' + d.seller_likes : ''}</div>
        </section>
      )}
      {!d.mine && !d.my_offer && (d.status === 'te_koop' || d.status === 'gereserveerd') && d.mode !== 'verkoop' && (
        swap === null ? <button class={'btn ' + (d.mode === 'ruil' ? '' : 'ghost')} onClick={() => setSwap('')}>Ruil voorstellen</button> : (
          <form class="card" onSubmit={(e) => { e.preventDefault(); act('make_offer', { p_listing: d.id, p_kind: 'ruil', p_amount_cents: 0, p_trade_game: swap }, { ok: 'Ruilvoorstel verstuurd naar ' + d.seller_name + '.', reload }).then((r) => r !== undefined && setSwap(null)); }}>
            <label class="field">Welk spel bied je aan in ruil?<input class="input" required maxLength={200} value={swap} onInput={(e) => setSwap(e.target.value)} placeholder="Bijv. Azul, compleet" /></label>
            <div class="grid2"><button type="button" class="btn grey" onClick={() => setSwap(null)}>Annuleren</button><button class="btn" disabled={swap.trim().length < 2}>Voorstel versturen</button></div>
          </form>
        )
      )}
      {!d.mine && !d.my_offer && (d.status === 'te_koop' || d.status === 'gereserveerd') && d.mode !== 'ruil' && swap === null && (
        bid === null ? (
          <div class="grid2">
            <button class="btn" onClick={() => act('make_offer', { p_listing: d.id, p_kind: 'kopen', p_amount_cents: d.price_cents }, { ok: 'Koopverzoek verstuurd naar ' + d.seller_name + '.', reload })}>{d.status === 'gereserveerd' ? 'Op wachtlijst' : 'Kopen voor ' + euro(d.price_cents)}</button>
            <button class="btn ghost" onClick={() => setBid(String(Math.max(1, Math.round(d.price_cents * 0.8 / 100))))}>Doe een bod</button>
          </div>
        ) : (
          <form class="card" onSubmit={(e) => { e.preventDefault(); const c = Math.round(parseFloat(bid.replace(',', '.')) * 100); if (c > 0) act('make_offer', { p_listing: d.id, p_kind: 'bod', p_amount_cents: c }, { ok: 'Bod verstuurd naar ' + d.seller_name + '.', reload }).then(() => setBid(null)); }}>
            <label class="field">Jouw bod in euro<input class="input" inputmode="decimal" value={bid} onInput={(e) => setBid(e.target.value)} style="font-size: 18px" /></label>
            <div class="grid2"><button type="button" class="btn grey" onClick={() => setBid(null)}>Annuleren</button><button class="btn">Bod versturen</button></div>
          </form>
        )
      )}
      {!d.mine && d.my_offer?.state === 'pending' && (
        <div class="card"><div class="note n-blue">{d.my_offer.kind === 'ruil' ? `Ruilvoorstel verstuurd: ${d.my_offer.trade_game}.` : d.my_offer.kind === 'bod' ? `Bod van ${euro(d.my_offer.amount_cents)} verstuurd.` : 'Koopverzoek verstuurd.'} {d.seller_name} krijgt een melding en accepteert of wijst af.</div>
          <button class="btn grey sm" style="align-self: flex-start" onClick={() => act('withdraw_offer', { p_listing: d.id }, { reload })}>Verzoek intrekken</button></div>
      )}
      {!d.mine && d.my_offer?.state === 'accepted' && (
        <div class="card"><div class="note n-green"><strong>{d.seller_name} heeft {d.my_offer.kind === 'ruil' ? 'je ruilvoorstel' : d.my_offer.kind === 'bod' ? 'je bod van ' + euro(d.my_offer.amount_cents) : 'je aankoop'} geaccepteerd.</strong> Spreek samen af waar en wanneer {d.my_offer.kind === 'ruil' ? 'jullie ruilen' : 'je het spel ophaalt'}.</div>
          {contact ? waBlock(d.seller_name) : <div class="small">{d.seller_name} heeft nog geen telefoonnummer in het profiel. Spreek af op de spelavond.</div>}
          <button class="link" onClick={() => act('withdraw_offer', { p_listing: d.id }, { reload })}>{d.my_offer.kind === 'ruil' ? 'Toch niet ruilen' : 'Toch niet kopen'}</button></div>
      )}
      {d.mine && (
        <section class="card">
          <h3>Verzoeken</h3>
          {d.offers.length === 0 && <div class="small">Nog geen verzoeken. Je krijgt een melding als iemand wil kopen, een bod doet of een ruil voorstelt.</div>}
          {d.offers.map((o) => (
            <div style="display: flex; flex-direction: column; gap: 6px">
              <Person name={o.buyer_name + ' · ' + offerText(o)} cls={o.state === 'accepted' ? '' : 'blue'} />
              {o.state === 'pending' && <div class="row"><button class="btn grey sm" onClick={() => act('respond_offer', { p_offer: o.id, p_accept: false }, { reload })}>Afwijzen</button><button class="btn sm" onClick={() => act('respond_offer', { p_offer: o.id, p_accept: true }, { ok: o.buyer_name + ' krijgt een melding.', reload })}>Accepteren</button></div>}
              {o.state === 'accepted' && <div class="small">Geaccepteerd</div>}
            </div>
          ))}
          {contact && waBlock(d.contact_name)}
          {d.mine && !me.phone && <div class="small">Tip: zet je telefoonnummer in je profiel, dan kan de koper je via WhatsApp bereiken.</div>}
        </section>
      )}
      {d.mine && (
        <section class="card">
          <h3>Jouw advertentie</h3>
          <div class="grid2">
            <button class="btn ghost" onClick={() => setEdit(true)}>Bewerken</button>
            <button class="btn ghost" onClick={() => act('set_listing_status', { p_listing: d.id, p_status: d.status === 'verkocht' ? 'te_koop' : 'verkocht' }, { reload })}>{d.status === 'verkocht' ? 'Weer aanbieden' : d.mode === 'ruil' ? 'Markeer als geruild' : 'Markeer als verkocht'}</button>
          </div>
          {remove === null ? <button class="btn danger-ghost" onClick={() => setRemove('')}>Advertentie verwijderen</button> : (
            <div class="panel">
              <b style="font-size: 14px">Waarom verwijder je de advertentie?</b>
              <Chips grid="grid2" options={['Verkocht of geruild buiten de app', 'Niet meer beschikbaar']} value={remove} onPick={setRemove} />
              <div class="small">Wie een verzoek of bod had, krijgt een melding dat het spel niet meer te koop is.</div>
              <div class="grid2"><button class="btn grey" onClick={() => setRemove(null)}>Annuleren</button>
                <button class="btn danger" disabled={!remove} onClick={async () => { await act('set_listing_status', { p_listing: d.id, p_status: 'verwijderd' }, { ok: d.game + ' is verwijderd uit de Koopgoot.' }); onBack(); }}>Verwijderen</button></div>
            </div>
          )}
        </section>
      )}
    </>
  );
}

function Zoeklijst() {
  const act = useAction();
  const [w, reload, error] = useRpc('list_wanted', {});
  const [term, setTerm] = useState('');
  const [max, setMax] = useState('');
  if (!w) return <Loading error={error} retry={reload} />;
  const maxCents = max ? Math.round(parseFloat(max.replace(',', '.')) * 100) : null;
  async function add(e) {
    e.preventDefault();
    const r = await act('add_wanted', { p_term: term, p_max_cents: maxCents }, { ok: 'Je krijgt een melding zodra ' + term.trim() + ' in de Koopgoot komt.', reload });
    if (r) { setTerm(''); setMax(''); }
  }
  return (
    <>
      <form class="card" onSubmit={add}>
        <h3>Mijn zoeklijst</h3>
        <div class="small">Zet hier spellen die je zoekt. Komt er een in de Koopgoot, dan krijg je meteen een melding.</div>
        <label class="field">Welk spel zoek je?<input class="input" required maxLength={80} value={term} onInput={(e) => setTerm(e.target.value)} placeholder="Bijv. Wingspan" /></label>
        <label class="field">Maximaal bedrag (optioneel)<input class="input" inputmode="decimal" value={max} onInput={(e) => setMax(e.target.value.replace(/[^0-9,.]/g, ''))} placeholder="Geen maximum" /></label>
        <button class="btn" disabled={term.trim().length < 2}>Op mijn zoeklijst</button>
        {w.mine.map((x) => (
          <div class="row" style="min-height: 44px; border-top: 1px solid var(--line)">
            <div class="grow"><div style="font-weight: 600; font-size: 14px">{x.term}</div>
              <div class="small">{x.max_cents != null ? 'tot ' + euro(x.max_cents) : 'elke prijs'}{x.matches ? ' · ' + plural(x.matches, 'advertentie', 'advertenties') + ' te koop' : ''}</div></div>
            <button type="button" class="link" aria-label={x.term + ' van zoeklijst halen'} onClick={() => act('delete_wanted', { p_id: x.id }, { reload })}>Weghalen</button>
          </div>
        ))}
      </form>
      <section class="card">
        <h3>Wat leden zoeken</h3>
        <div class="small">Heb je een van deze spellen over? Zet hem in de Koopgoot, de zoekers krijgen een melding.</div>
        {w.all.length === 0 ? <div class="small">Nog niemand zoekt iets.</div> : w.all.map((x) => (
          <div class="row" style="min-height: 40px">
            <span class="grow" style="font-size: 14px"><b>{x.term}</b> <span class="small">· {x.names.join(', ')}</span></span>
            <span class="badge b-sand" style="font-size: 11px; padding: 3px 8px">{x.count}×</span>
          </div>
        ))}
      </section>
    </>
  );
}

export function Koop() {
  const [view, setView] = useState('koop');
  return (
    <>
      <div role="group" aria-label="Koopgoot"><Chips grid="grid2" options={[{ value: 'koop', label: 'Te koop' }, { value: 'zoek', label: 'Zoeklijst' }]} value={view} onPick={setView} /></div>
      {view === 'koop' ? <TeKoop /> : <Zoeklijst />}
    </>
  );
}

function TeKoop() {
  const [list, reload, error] = useRpc('list_listings', {});
  const [open, setOpen] = useState(null);
  const [form, setForm] = useState(false);
  const [sort, setSort] = useState('nieuw');
  const [kind, setKind] = useState('Alles');
  if (open) return <Detail id={open} onBack={() => { setOpen(null); reload(); }} />;
  if (!list) return <Loading error={error} retry={reload} />;
  const sorted = list.filter((l) => kind === 'Alles' || (kind === 'Te koop' ? l.mode !== 'ruil' : l.mode !== 'verkoop')).sort((a, b) => ({
    nieuw: () => (a.created_at < b.created_at ? 1 : -1), oud: () => (a.created_at > b.created_at ? 1 : -1),
    az: () => a.game.localeCompare(b.game, 'nl'), za: () => b.game.localeCompare(a.game, 'nl'),
    prijsop: () => (a.mode === 'ruil') - (b.mode === 'ruil') || a.price_cents - b.price_cents, prijsaf: () => (a.mode === 'ruil') - (b.mode === 'ruil') || b.price_cents - a.price_cents,
  })[sort]());
  return (
    <>
      <div class="row between"><h2>Te koop en te ruil</h2>{!form && <button class="btn pill" onClick={() => setForm(true)}>+ Spel aanbieden</button>}</div>
      {form && <ListingForm onClose={() => setForm(false)} onDone={(id) => { setForm(false); reload(); setOpen(id); }} />}
      <div class="row"><label for="sorteer" class="muted" style="flex: none">Sorteer op</label>
        <select id="sorteer" class="input" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="nieuw">Nieuwste eerst</option><option value="oud">Oudste eerst</option><option value="az">Naam A-Z</option>
          <option value="za">Naam Z-A</option><option value="prijsop">Prijs laag-hoog</option><option value="prijsaf">Prijs hoog-laag</option>
        </select></div>
      <div role="group" aria-label="Filter koop of ruil"><Chips cls="sm" options={['Alles', 'Te koop', 'Te ruil']} value={kind} onPick={setKind} /></div>
      {list.length === 0 && <div class="empty">Er staat nog niets in de Koopgoot. Bied als eerste een spel aan.</div>}
      <div class="lgrid">
        {sorted.map((l) => { const [s, c] = statusOf(l); return (
          <button class="lcard" onClick={() => setOpen(l.id)} aria-label={`${l.game}, ${priceText(l)}, bekijk advertentie`}>
            <div class="lcover" style={'background:' + coverColor(l.game)}>{l.game.charAt(0)}</div>
            <div class="lbody">
              <div style="font-weight: 700; font-size: 15px">{l.game}</div>
              <div class="small">{[l.language, l.condition].filter(Boolean).join(' · ')}</div>
              <div class="small">{l.mine ? 'Jouw advertentie' : l.seller_name} · {shortDate(l.created_at)}</div>
              <div class="row between" style="margin-top: 4px"><b>{priceText(l)}</b><span class={'badge ' + c} style="font-size: 11px; padding: 3px 8px">{s}</span></div>
            </div>
          </button>
        ); })}
      </div>
    </>
  );
}
