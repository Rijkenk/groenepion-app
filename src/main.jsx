import { render } from 'preact';
import { useEffect, useState, useCallback, useRef } from 'preact/hooks';
import './style.css';
import { init, getSession, onAuthChange, sendMagicLink, verifyCode, demoLogin, demoUsers, signOut, rpc, DEMO } from './api.js';
import { Ctx, Icon, InstallHint } from './ui.jsx';
import { Avond } from './screens/Avond.jsx';
import { Spellen } from './screens/Spellen.jsx';
import { Agenda } from './screens/Agenda.jsx';
import { Koop } from './screens/Koop.jsx';
import { Profiel } from './screens/Profiel.jsx';
import { Leden, Privacy } from './screens/Leden.jsx';

const LOGO = import.meta.env.BASE_URL + 'logo.png';
const TABS = [
  { id: 'avond', label: 'Spelavond', title: 'Spelavond', icon: Icon.avond },
  { id: 'spellen', label: 'Spellotheek', title: 'Spellotheek', icon: Icon.spellen },
  { id: 'agenda', label: 'Agenda', title: 'Agenda', icon: Icon.agenda },
  { id: 'koop', label: 'Koopgoot', title: 'Koopgoot', icon: Icon.koop },
  { id: 'profiel', label: 'Profiel', title: 'Mijn profiel', icon: Icon.profiel },
];

function Header({ title, unread, onBell }) {
  return (
    <header class="top">
      <div class="logo-tile"><img src={LOGO} alt="Logo De Groene Pion" /></div>
      <div class="top-title"><b>{title}</b><span>De Groene Pion</span></div>
      <a class="round" href="https://groenepion.nl/" target="_blank" rel="noopener" aria-label="Website De Groene Pion"><Icon.web /></a>
      <a class="round" href="https://www.facebook.com/groups/groenepion" target="_blank" rel="noopener" aria-label="Facebook-groep De Groene Pion"><Icon.fb /></a>
      {onBell && <button class="round" onClick={onBell} aria-label={unread ? `Meldingen, ${unread} nieuw` : 'Meldingen'}><Icon.bell />{unread > 0 && <span class="dot" />}</button>}
    </header>
  );
}

function Login() {
  const [privacy, setPrivacy] = useState(false);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [code, setCode] = useState('');
  const [users, setUsers] = useState(null);
  useEffect(() => { if (DEMO) demoUsers().then(setUsers); }, []);
  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await sendMagicLink(email.trim()); setSent(true); } catch (x) { setErr(x.message); }
    setBusy(false);
  }
  async function submitCode(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await verifyCode(email.trim(), code.replace(/\s/g, '')); } catch (x) { setErr(x.message); }
    setBusy(false);
  }
  return (
    <div class="shell">
      <Header title="Welkom" />
      <div class="center">
        <h2 style="font-size: 24px">Speel mee bij De Groene Pion</h2>
        {!DEMO && <InstallHint />}
        {DEMO ? (
          <>
            <p class="muted" style="margin: 0">Dit is de demoversie. Kies met wie je wilt inloggen. Alles begint opnieuw als je de pagina ververst.</p>
            {!users ? <div class="muted">Demo laden…</div> : users.map((u) => (
              <button class="btn ghost full" style="justify-content: flex-start; display: flex; align-items: center; gap: 10px" onClick={() => demoLogin(u.id)}>
                <span class="avatar">{u.name.charAt(0)}</span><span>{u.name} <span class="small">({u.note})</span></span>
              </button>
            ))}
          </>
        ) : sent ? (
          <form onSubmit={submitCode} style="display: flex; flex-direction: column; gap: 12px">
            <div class="note n-green" role="status"><strong>Check je mail.</strong> We hebben een mail gestuurd naar {email}. Typ hieronder de code uit de mail. Geen mail gezien? Kijk ook even in je spam.</div>
            <label class="field">Code uit de mail<input class="input" required autocomplete="one-time-code" inputmode="numeric" maxLength={10} value={code} onInput={(e) => setCode(e.target.value)} placeholder="123456" style="font-size: 22px; letter-spacing: 4px" /></label>
            {err && <div class="note n-orange" role="alert">{err}</div>}
            <button class="btn full" disabled={busy || code.replace(/\s/g, '').length < 6}>{busy ? 'Controleren…' : 'Inloggen'}</button>
            <div class="small">Op een computer kun je ook gewoon op de link in de mail klikken.</div>
            <button type="button" class="link" onClick={() => { setSent(false); setCode(''); setErr(''); }}>Ander e-mailadres of nieuwe code</button>
          </form>
        ) : (
          <form onSubmit={submit} style="display: flex; flex-direction: column; gap: 12px">
            <p class="muted" style="margin: 0">Log in met je e-mailadres. Je krijgt een code per mail, een wachtwoord is niet nodig. Nieuwe leden worden eerst goedgekeurd door een beheerder.</p>
            <label class="field">E-mailadres<input class="input" type="email" required autocomplete="email" inputmode="email" value={email} onInput={(e) => setEmail(e.target.value)} placeholder="naam@voorbeeld.nl" /></label>
            {err && <div class="note n-orange" role="alert">{err}</div>}
            <button class="btn full" disabled={busy}>{busy ? 'Versturen…' : 'Stuur inlogcode'}</button>
          </form>
        )}
        <button type="button" class="link" onClick={() => setPrivacy(true)}>Hoe gaan we om met je gegevens?</button>
      </div>
      {privacy && <Privacy onClose={() => setPrivacy(false)} />}
    </div>
  );
}

function Pending({ me, refresh }) {
  const [name, setName] = useState(me.display_name || '');
  const [saved, setSaved] = useState(false);
  async function save(e) {
    e.preventDefault();
    try { await rpc('update_profile', { p_name: name, p_phone: me.phone, p_bio: me.bio, p_likes: me.likes }); setSaved(true); refresh(); } catch (x) { alert(x.message); }
  }
  return (
    <div class="shell">
      <Header title="Bijna klaar" />
      <div class="center">
        <h2 style="font-size: 22px">Je aanmelding wacht op goedkeuring</h2>
        {me.status === 'blocked'
          ? <p class="muted">Je account is niet actief. Neem contact op met het bestuur van De Groene Pion.</p>
          : <p class="muted" style="margin: 0">Een beheerder van De Groene Pion keurt nieuwe leden goed. Zo houden we spam buiten de app. Je krijgt toegang zodra dat gebeurd is.</p>}
        <form onSubmit={save} style="display: flex; flex-direction: column; gap: 10px">
          <label class="field">Hoe heet je? (zodat de beheerder je herkent)<input class="input" value={name} onInput={(e) => setName(e.target.value)} required /></label>
          <button class="btn ghost">{saved ? 'Opgeslagen' : 'Naam opslaan'}</button>
        </form>
        <button class="btn grey" onClick={refresh}>Opnieuw kijken</button>
        <button class="link" onClick={signOut}>Uitloggen</button>
      </div>
    </div>
  );
}

function Notifications({ onClose }) {
  const [list, setList] = useState(null);
  useEffect(() => { rpc('list_notifications').then((l) => { setList(l); rpc('mark_notifications_read'); }); }, []);
  return (
    <div class="sheet-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog" aria-label="Meldingen">
        <div class="row between"><h2>Meldingen</h2><button class="round" style="background: #E6ECE7; color: var(--text)" onClick={onClose} aria-label="Sluiten"><Icon.close /></button></div>
        {!list ? <div class="muted">Laden…</div> : list.length === 0 ? <div class="muted">Nog geen meldingen.</div> : list.map((n) => (
          <div class="card" style={'gap: 4px;' + (n.read ? '' : 'border-color: var(--green)')}>
            <div style="font-size: 14px">{n.body}</div>
            <div class="small">{new Date(n.created_at).toLocaleString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function App() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null);
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState('avond');
  const [bell, setBell] = useState(false);
  const [sheet, setSheet] = useState(null); // { kind: 'leden' | 'privacy', id }
  const [toastMsg, setToastMsg] = useState(null);
  const timer = useRef(null);
  const mainRef = useRef(null);

  const toast = useCallback((text, err) => {
    clearTimeout(timer.current); setToastMsg({ text, err });
    timer.current = setTimeout(() => setToastMsg(null), err ? 6000 : 3500);
  }, []);
  const refreshMe = useCallback(async () => { try { setMe(await rpc('get_me')); } catch { /* stil */ } }, []);

  useEffect(() => {
    (async () => {
      await init();
      setSession(await getSession());
      setReady(true);
    })();
    return onAuthChange((s) => setSession(s));
  }, []);
  useEffect(() => { if (session) refreshMe(); else setMe(null); }, [session]);
  useEffect(() => { const id = setInterval(() => { if (session && document.visibilityState === 'visible') refreshMe(); }, 30000); return () => clearInterval(id); }, [session]);

  if (!ready) return <div class="shell"><Header title="De Groene Pion" /><div class="center"><div class="muted">Laden…</div></div></div>;
  if (!session) return <Login />;
  if (!me) return <div class="shell"><Header title="De Groene Pion" /><div class="center"><div class="muted">Laden…</div></div></div>;
  if (me.status === 'pending' || me.status === 'blocked') return <Pending me={me} refresh={refreshMe} />;

  const cur = TABS.find((t) => t.id === tab);
  const go = (id) => { setTab(id); if (mainRef.current) mainRef.current.scrollTop = 0; };
  return (
    <Ctx.Provider value={{ me, toast, refreshMe, go, showMember: (id) => setSheet({ kind: 'leden', id }), showMembers: () => setSheet({ kind: 'leden' }), showPrivacy: () => setSheet({ kind: 'privacy' }) }}>
      <div class="shell">
        {DEMO && <div class="demo-bar">Demoversie: voorbeelddata, niets wordt bewaard</div>}
        <Header title={cur.title} unread={me.unread} onBell={() => setBell(true)} />
        <main class="main" ref={mainRef}>
          <InstallHint compact />
          {tab === 'avond' && <Avond />}
          {tab === 'spellen' && <Spellen />}
          {tab === 'agenda' && <Agenda />}
          {tab === 'koop' && <Koop />}
          {tab === 'profiel' && <Profiel />}
        </main>
        <nav class="tabs" aria-label="Hoofdmenu">
          {TABS.map((t) => <button class={'tab' + (tab === t.id ? ' on' : '')} aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}><t.icon />{t.label}</button>)}
        </nav>
        {toastMsg && <div class={'toast' + (toastMsg.err ? ' err' : '')} role={toastMsg.err ? 'alert' : 'status'}>{toastMsg.text}</div>}
        {bell && <Notifications onClose={() => { setBell(false); refreshMe(); }} />}
        {sheet && sheet.kind === 'leden' && <Leden startId={sheet.id} onClose={() => setSheet(null)} />}
        {sheet && sheet.kind === 'privacy' && <Privacy onClose={() => setSheet(null)} />}
      </div>
    </Ctx.Provider>
  );
}

render(<App />, document.getElementById('app'));
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {}));
}
