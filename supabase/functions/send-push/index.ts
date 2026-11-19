// Supabase Edge Function: stuurt een pushmelding naar de telefoon(s) van een lid
// zodra er een rij in public.notifications bijkomt (via een Database Webhook).
//
// Secrets (Edge Functions -> Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY  sleutelpaar, te maken met sleutels.html in de app
//   PUSH_WEBHOOK_SECRET                  zelfde waarde als de header x-webhook-secret in de webhook
//   VAPID_SUBJECT (optioneel)            bijv. mailto:info@groenepion.nl
// SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn er automatisch.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:info@groenepion.nl',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

Deno.serve(async (req) => {
  const secret = Deno.env.get('PUSH_WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) return new Response('Geen toegang', { status: 401 });

  const payload = await req.json().catch(() => null);
  const rec = payload?.record;
  if (payload?.type !== 'INSERT' || !rec?.user_id || !rec?.body) return new Response('Niets te doen');

  const { data: subs, error } = await supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', rec.user_id);
  if (error) return new Response(error.message, { status: 500 });

  const message = JSON.stringify({ title: 'De Groene Pion', body: rec.body, tag: 'gp-' + rec.id, url: './' });
  let sent = 0;
  await Promise.all((subs ?? []).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, message, { TTL: 60 * 60 * 24 });
      sent++;
    } catch (e) {
      // 404/410: telefoon heeft het abonnement opgezegd of de app verwijderd.
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await supabase.from('push_subscriptions').delete().eq('id', s.id);
      else console.error('push mislukt', code, (e as Error).message);
    }
  }));
  return Response.json({ sent });
});
