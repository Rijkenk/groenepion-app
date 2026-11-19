# De Groene Pion app

Web-app (PWA) voor De Groene Pion: spelavonden met tafels, agenda met thuisavonden, Koopgoot en spellotheek.
Gemaakt door KrCreations.

- Live: https://rijkenk.github.io/groenepion-app/
- Demo met voorbeelddata: https://rijkenk.github.io/groenepion-app/?demo

## Techniek

- Frontend: Preact + Vite, gebouwd naar `docs/` en gehost met GitHub Pages (branch `main`, map `/docs`).
- Backend: Supabase (Postgres + Auth, regio Frankfurt). Inloggen met een e-maillink.
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

## Ontwikkelen

```
npm install
npm test              # databasefuncties testen tegen Postgres (PGlite)
npm run dev           # lokaal, demomodus als .env ontbreekt
npm run build         # productie-build naar docs/ (leest .env.production)
```

`.env.production` bevat alleen de publieke Supabase-URL en de anon/publishable key. De service_role-sleutel komt nooit in deze repo.
