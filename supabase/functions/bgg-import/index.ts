// Supabase Edge Function: haalt de collectie van een BoardGameGeek-gebruiker op.
// De app zet het resultaat daarna zelf in de collectie van het lid (rpc import_my_games).
//
// Secret (Edge Functions -> Secrets):
//   BGG_TOKEN  het token van de geregistreerde BGG-applicatie (boardgamegeek.com/applications)
// Alleen ingelogde gebruikers kunnen deze functie aanroepen (Verify JWT staat aan).

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function decode(s: string): string {
  return s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
const attr = (tag: string, name: string) => { const m = tag.match(new RegExp('\\b' + name + '="([^"]*)"')); return m ? decode(m[1]) : ''; };

export type Game = { bgg_id: number; name: string; players: string; minutes: number | null; weight?: number };

export function parseCollection(xml: string): Game[] {
  const out: Game[] = [];
  for (const m of xml.matchAll(/<item\b([^>]*)>([\s\S]*?)<\/item>/g)) {
    const id = +attr(m[1], 'objectid');
    const name = decode((m[2].match(/<name\b[^>]*>([\s\S]*?)<\/name>/) || [])[1] || '').trim();
    const st = (m[2].match(/<stats\b[^>]*>/) || [''])[0];
    const min = +attr(st, 'minplayers'), max = +attr(st, 'maxplayers');
    const minutes = +attr(st, 'playingtime') || +attr(st, 'maxplaytime') || null;
    if (!id || !name) continue;
    out.push({ bgg_id: id, name, players: min && max ? (min === max ? String(min) : min + '-' + max) : '', minutes });
  }
  // BGG kan een spel dubbel geven (meerdere exemplaren); één is genoeg.
  const seen = new Set<number>();
  return out.filter((g) => !seen.has(g.bgg_id) && seen.add(g.bgg_id));
}

export function parseWeights(xml: string): Map<number, number> {
  const w = new Map<number, number>();
  for (const m of xml.matchAll(/<item\b([^>]*)>([\s\S]*?)<\/item>/g)) {
    const v = parseFloat(attr((m[2].match(/<averageweight\b[^>]*>/) || [''])[0], 'value'));
    if (v > 0) w.set(+attr(m[1], 'id'), Math.round(v * 100) / 100);
  }
  return w;
}

async function bgg(path: string, token: string): Promise<Response> {
  // BGG antwoordt eerst met 202 terwijl het de collectie klaarzet; dan even wachten en opnieuw.
  for (let i = 0; i < 8; i++) {
    const res = await fetch('https://boardgamegeek.com/xmlapi2/' + path, { headers: { Authorization: 'Bearer ' + token, 'User-Agent': 'GroenePionApp/1.0' } });
    if (res.status === 202 || res.status === 429) { await res.body?.cancel(); await sleep(2500 + i * 1000); continue; }
    return res;
  }
  throw new Error('BGG is nu erg druk. Probeer het over een paar minuten opnieuw.');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const token = Deno.env.get('BGG_TOKEN');
  if (!token) return json({ error: 'De BGG-koppeling is nog niet aangezet. Vraag het bestuur.' }, 503);
  const { username } = await req.json().catch(() => ({}));
  const user = String(username ?? '').trim();
  if (!/^[\w .-]{1,60}$/.test(user)) return json({ error: 'Vul een geldige BGG-gebruikersnaam in.' }, 400);
  try {
    const res = await bgg(`collection?username=${encodeURIComponent(user)}&own=1&excludesubtype=boardgameexpansion&stats=1`, token);
    const xml = await res.text();
    if (/Invalid username/i.test(xml)) return json({ error: `BGG kent de gebruiker "${user}" niet.` }, 404);
    if (!res.ok) return json({ error: 'BGG gaf een fout (' + res.status + '). Probeer het later opnieuw.' }, 502);
    const games = parseCollection(xml);
    // Zwaarte ophalen in blokjes van 20 (de BGG-limiet). Lukt dat niet, dan zonder zwaarte verder.
    try {
      for (let i = 0; i < Math.min(games.length, 400); i += 20) {
        const part = games.slice(i, i + 20);
        const r = await bgg('thing?stats=1&id=' + part.map((g) => g.bgg_id).join(','), token);
        if (!r.ok) break;
        const w = parseWeights(await r.text());
        for (const g of part) if (w.has(g.bgg_id)) g.weight = w.get(g.bgg_id);
      }
    } catch { /* zwaarte is een extraatje */ }
    return json({ games });
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
});
