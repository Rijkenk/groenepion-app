// Datalaag. Alle gegevens lopen via databasefuncties (RPC), zodat de regels op één plek staan.
// Echte modus: Supabase. Demomodus (geen Supabase-gegevens of ?demo): Postgres in de browser (PGlite).
import { createClient } from '@supabase/supabase-js';

const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const DEMO = import.meta.env.MODE === 'demo' || !URL_ || !KEY || new URLSearchParams(location.search).has('demo');

let supabase = null;
let demo = null;
const listeners = new Set();

async function getDemo() {
  if (!demo) demo = await (await import('./demo.js')).createDemo();
  return demo;
}

export async function init() {
  if (DEMO) { await getDemo(); return; }
  supabase = createClient(URL_, KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  supabase.auth.onAuthStateChange((_e, session) => listeners.forEach((fn) => fn(session)));
}

export function onAuthChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export async function getSession() {
  if (DEMO) return (await getDemo()).session();
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function sendMagicLink(email) {
  const redirect = location.origin + location.pathname;
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
  if (error) throw new Error(vertaal(error.message));
}

export async function verifyCode(email, token) {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw new Error(/expired|invalid/i.test(error.message) ? 'Deze code klopt niet of is verlopen. Vraag een nieuwe aan.' : vertaal(error.message));
}

export async function demoLogin(userId) {
  const d = await getDemo();
  d.login(userId);
  listeners.forEach((fn) => fn(d.session()));
}
export async function demoUsers() { return (await getDemo()).users; }

export async function signOut() {
  if (DEMO) { (await getDemo()).logout(); listeners.forEach((fn) => fn(null)); return; }
  await supabase.auth.signOut();
}

export async function rpc(fn, args = {}) {
  if (DEMO) {
    try { return await (await getDemo()).rpc(fn, args); }
    catch (e) { throw new Error(vertaal(e.message)); }
  }
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(vertaal(error.message));
  return data;
}

// Roept een Supabase Edge Function aan (bijv. de BGG-import).
export async function callFunction(name, body) {
  if (DEMO) return (await getDemo()).fn(name, body);
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let msg = error.message;
    try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch { /* geen json */ }
    if (/Failed to send|not found|404/i.test(msg)) msg = 'Deze koppeling is nog niet aangezet. Vraag het bestuur.';
    throw new Error(vertaal(msg));
  }
  return data;
}

// Pushmeldingen: werkt in Chrome/Android en op iPhone alleen vanaf het beginscherm (iOS 16.4+).
export function pushSupported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
function b64ToBytes(b64) {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}
export async function pushState() {
  if (!pushSupported() || DEMO) return { supported: pushSupported(), on: false, key: null };
  const cfg = await rpc('get_push_config');
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  return { supported: true, on: !!sub && Notification.permission === 'granted', key: cfg && cfg.vapid_public };
}
export async function enablePush(key) {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Je hebt meldingen geweigerd. Zet ze aan in de instellingen van je telefoon.');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) }));
  const j = sub.toJSON();
  await rpc('save_push_subscription', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
}
export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  if (sub) { await rpc('delete_push_subscription', { p_endpoint: sub.endpoint }); await sub.unsubscribe(); }
}

function vertaal(msg) {
  if (/rate limit/i.test(msg)) return 'Even wachten: er zijn net te veel inlogmails verstuurd. Probeer het over een minuut opnieuw.';
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Geen verbinding. Controleer je internet en probeer het opnieuw.';
  if (/invalid.*email/i.test(msg)) return 'Dit e-mailadres klopt niet.';
  return msg;
}
