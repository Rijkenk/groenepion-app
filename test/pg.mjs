// PGlite-harnas dat Supabase nabootst: auth-schema, rollen, auth.uid() uit de JWT-claims.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

export const AUTH_STUB = `
create role anon; create role authenticated;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claims'', true)::json->>''sub'','''')::uuid';
`;

export async function makeDb(schemaSql) {
  const db = new PGlite();
  await db.exec(AUTH_STUB);
  await db.exec(schemaSql ?? fs.readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
  return db;
}

export function client(db, uid) {
  return async function rpc(fn, args = {}) {
    const keys = Object.keys(args);
    await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: uid || '' })]);
    const params = keys.map((k, i) => `${k} => $${i + 1}`).join(', ');
    const r = await db.query(`select public.${fn}(${params}) as v`, keys.map(k => args[k]));
    return r.rows[0].v;
  };
}

export async function addUser(db, id, email, name, status) {
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [id, email, JSON.stringify({ name })]);
  if (status) await db.query(`update public.profiles set status = $2 where id = $1`, [id, status]);
}
