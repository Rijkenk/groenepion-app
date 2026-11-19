import { createContext } from 'preact';
import { useContext, useEffect, useState, useCallback } from 'preact/hooks';
import { rpc } from './api.js';

export const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

// Laadt data via een RPC en geeft [data, herladen, fout].
export function useRpc(fn, args, deps = []) {
  const [data, setData] = useState(undefined);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    try { setData(await rpc(fn, args)); setError(null); } catch (e) { setError(e.message); }
  }, deps);
  useEffect(() => { load(); }, [load]);
  return [data, load, error];
}

// Voert een actie uit met foutmelding en herladen.
export function useAction() {
  const { toast, refreshMe } = useApp();
  return async (fn, args, { ok, reload } = {}) => {
    try {
      const r = await rpc(fn, args);
      if (ok) toast(typeof ok === 'function' ? ok(r) : ok);
      if (reload) await reload();
      refreshMe();
      return r;
    } catch (e) { toast(e.message, true); return undefined; }
  };
}

const MAANDEN = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const MAANDEN_LANG = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
export function parseDate(s) { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); }
export function longDate(s) { const d = parseDate(s); return DAGEN[d.getDay()].replace(/^./, (c) => c.toUpperCase()) + ' ' + d.getDate() + ' ' + MAANDEN_LANG[d.getMonth()]; }
export function shortDate(s) { const d = parseDate(s); return d.getDate() + ' ' + MAANDEN[d.getMonth()]; }
export function monthShort(s) { return MAANDEN[parseDate(s).getMonth()]; }
export function dayNum(s) { return parseDate(s).getDate(); }
export function euro(cents) { return '€ ' + (cents % 100 === 0 ? cents / 100 : (cents / 100).toFixed(2).replace('.', ',')); }
export function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
export function durText(min) { if (min < 60) return 'ca. ' + min + ' min'; const h = min / 60; return 'ca. ' + (Number.isInteger(h) ? h : h.toFixed(1).replace('.', ',')) + ' uur'; }
export function waLink(phone, text) {
  let p = (phone || '').replace(/[^0-9+]/g, '');
  if (p.startsWith('+')) p = p.slice(1); else if (p.startsWith('00')) p = p.slice(2); else if (p.startsWith('0')) p = '31' + p.slice(1);
  return 'https://wa.me/' + p + '?text=' + encodeURIComponent(text);
}
export const COVERS = ['#1E6B43', '#2F5D8A', '#9A4A1C', '#6B4A8A', '#3E7A6E'];
export function coverColor(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return COVERS[h % COVERS.length]; }

export const WEIGHT_BADGE = { Licht: 'b-green', Middel: 'b-blue', Zwaar: 'b-orange' };
export const EXP = {
  Beginner: { label: 'Beginner welkom · uitleg', cls: 'b-green', form: 'Beginner welkom, ik leg uit' },
  Ervaren: { label: 'Ervaren spelers', cls: 'b-blue', form: 'Ervaren spelers' },
  Kenner: { label: 'Kenner · regels kennen', cls: 'b-orange', form: 'Kenners, regels kennen vereist' },
};

export function Chips({ options, value, onPick, cls = '', grid }) {
  return (
    <div class={grid || 'chips'}>
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value; const l = typeof o === 'string' ? o : o.label;
        return <button type="button" class={'chip ' + cls + (value === v ? ' on' : '')} aria-pressed={value === v} onClick={() => onPick(v)}>{l}</button>;
      })}
    </div>
  );
}

export function Stepper({ value, min, max, onChange, label }) {
  return (
    <div class="stepper">
      <button type="button" aria-label={label + ' minder'} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <b aria-live="polite">{value}</b>
      <button type="button" aria-label={label + ' meer'} onClick={() => onChange(Math.min(max, value + 1))}>+</button>
    </div>
  );
}

export function Loading({ error, retry }) {
  if (error) return <div class="empty"><div>{error}</div>{retry && <button class="btn grey sm" onClick={retry}>Opnieuw proberen</button>}</div>;
  return <div class="muted" role="status">Laden…</div>;
}

export function Person({ name, cls = '', children }) {
  return (
    <div class="row" style="min-height: 40px">
      <span class={'avatar ' + cls}>{(name || '?').charAt(0)}</span>
      <span class="grow" style="font-size: 14px">{name}</span>
      {children}
    </div>
  );
}

const ic = { fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' };
export const Icon = {
  avond: () => <svg width="22" height="22" viewBox="0 0 24 24" {...ic}><path d="M4 9h16v6H4z" /><path d="M7 9V6M17 9V6M6 15v3M18 15v3" /></svg>,
  spellen: () => <svg width="22" height="22" viewBox="0 0 24 24" {...ic}><path d="M4 4h4v16H4zM10 4h4v16h-4z" /><path d="M16 5l3.5-1 2.5 15-3.5 1z" /></svg>,
  agenda: () => <svg width="22" height="22" viewBox="0 0 24 24" {...ic}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>,
  koop: () => <svg width="22" height="22" viewBox="0 0 24 24" {...ic}><path d="M3 10l9-6 9 6v10H3z" /><path d="M9 20v-6h6v6" /></svg>,
  profiel: () => <svg width="22" height="22" viewBox="0 0 24 24" {...ic}><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></svg>,
  bell: () => <svg width="20" height="20" viewBox="0 0 24 24" {...ic}><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>,
  web: () => <svg width="20" height="20" viewBox="0 0 24 24" {...ic}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z" /></svg>,
  fb: () => <svg width="20" height="20" viewBox="0 0 24 24" {...ic}><path d="M15 3h-2.5A3.5 3.5 0 0 0 9 6.5V10H6v4h3v7h4v-7h3l1-4h-4V7a1 1 0 0 1 1-1h2z" /></svg>,
  pin: () => <svg width="16" height="16" viewBox="0 0 24 24" {...ic}><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>,
  close: () => <svg width="18" height="18" viewBox="0 0 24 24" {...ic} stroke-width="2.2"><path d="M6 6l12 12M18 6L6 18" /></svg>,
  back: () => <svg width="20" height="20" viewBox="0 0 24 24" {...ic}><path d="M15 5l-7 7 7 7" /></svg>,
};
