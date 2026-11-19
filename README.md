# De Groene Pion app

Web-app (PWA) voor De Groene Pion: spelavonden met tafels, agenda met thuisavonden, Koopgoot met zoeklijst,
spellotheek, collecties van leden (met BGG-import), ledenprofielen, pushmeldingen en beheer.
Gemaakt door KrCreations.

- Live: https://rijkenk.github.io/groenepion-app/
- Demo met voorbeelddata: https://rijkenk.github.io/groenepion-app/?demo

## Techniek

- Frontend: Preact + Vite, gebouwd naar `docs/` en gehost met GitHub Pages (branch `main`, map `/docs`).
- Backend: Supabase (Postgres + Auth, regio Frankfurt). Inloggen met een code uit de mail.
- Alle gegevens lopen via databasefuncties in `supabase/schema.sql`. Tabellen hebben row level security aan zonder policies,
  dus de app kan alleen via die functies lezen en schrijven. Elke functie controleert wie je bent.
- Demomodus (`?demo` of zonder Supabase-gegevens) draait dezelfde SQL in de browser met PGlite.

## Supabase inrichten (eenmalig)

1. SQL Editor → New query → plak `supabase/schema.sql` → Run.
2. Authentication → URL Configuration:
   - Site URL: `https://rijkenk.github.io/groenepion-app/`
   - Redirect URLs: `https://rijkenk.github.io/groenepion-app/**`
3. Log één keer in via de app en maak jezelf beheerder in de SQL Editor:
   `update public.profiles set status = 'admin' where email = 'jouw@email.nl';`
4. Daarna keur je nieuwe leden goed in de app onder Profiel → Beheer.

`schema.sql` is veilig opnieuw te draaien na een update: bestaande gegevens blijven staan.

## Pushmeldingen (optioneel)

1. Open `https://rijkenk.github.io/groenepion-app/sleutels.html` en klik "Maak sleutels" (alles lokaal).
2. Draai de SQL-regel van die pagina in de SQL Editor (zet de publieke sleutel in `app_config`).
3. Edge Functions → Secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `PUSH_WEBHOOK_SECRET`.
4. Edge Functions → Deploy a new function → via editor, naam `send-push`, plak `supabase/functions/send-push/index.ts`,
   en zet "Verify JWT" uit (de functie controleert zelf de webhook-header).
5. Database → Webhooks → Create: tabel `public.notifications`, event Insert, type Supabase Edge Functions → `send-push`,
   HTTP header `x-webhook-secret` = de waarde van `PUSH_WEBHOOK_SECRET`.

## BGG-import (optioneel)

1. Vraag XML API-toegang aan op boardgamegeek.com/applications en maak een token.
2. Edge Functions → Secrets: `BGG_TOKEN`.
3. Deploy `supabase/functions/bgg-import/index.ts` als functie `bgg-import` (Verify JWT aan laten).

## Ontwikkelen

```
npm install
npm test              # databasefuncties testen tegen Postgres (PGlite)
npm run dev           # lokaal, demomodus als .env ontbreekt
npm run build         # productie-build naar docs/ (leest .env.production)
```

`.env.production` bevat alleen de publieke Supabase-URL en de anon/publishable key. De service_role-sleutel komt nooit in deze repo.
