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

function vertaal(msg) {
  if (/rate limit/i.test(msg)) return 'Even wachten: er zijn net te veel inlogmails verstuurd. Probeer het over een minuut opnieuw.';
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Geen verbinding. Controleer je internet en probeer het opnieuw.';
  if (/invalid.*email/i.test(msg)) return 'Dit e-mailadres klopt niet.';
  return msg;
}
