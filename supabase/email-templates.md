# Nederlandse inlogmails voor Supabase

Ga naar https://supabase.com/dashboard/project/bsmrrtvtdkalscmcjtcf/auth/templates
Vervang bij de twee templates hieronder het onderwerp en de inhoud (Source), en klik op Save.

## 1. Confirm signup (eerste keer inloggen)

Onderwerp:

    Welkom bij De Groene Pion: bevestig je e-mailadres

Inhoud:

```html
<div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; color: #1C211E">
  <div style="background: #1E6B43; padding: 20px; border-radius: 16px 16px 0 0; text-align: center">
    <img src="https://rijkenk.github.io/groenepion-app/icon-192.png" alt="De Groene Pion" width="64" height="64" style="border-radius: 14px">
  </div>
  <div style="background: #F6F7F3; padding: 24px; border-radius: 0 0 16px 16px">
    <h2 style="margin: 0 0 12px">Welkom bij De Groene Pion!</h2>
    <p style="text-align: center; font-size: 13px; color: #5B625D; margin: 0">Je inlogcode:</p>
    <p style="text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 6px; margin: 4px 0 16px">{{ .Token }}</p>
    <p>Typ deze code in de app. Op een computer kun je ook op de knop klikken.</p>
    <p style="text-align: center; margin: 24px 0">
      <a href="{{ .ConfirmationURL }}" style="background: #1E6B43; color: #FFFFFF; padding: 14px 24px; border-radius: 12px; text-decoration: none; font-weight: bold">Bevestig en log in</a>
    </p>
    <p style="font-size: 13px; color: #5B625D">Na je eerste keer inloggen keurt een beheerder je aanmelding goed. Zo houden we spam buiten de app.</p>
    <p style="font-size: 13px; color: #5B625D">Heb je dit niet aangevraagd? Dan kun je deze mail negeren.</p>
  </div>
</div>
```

## 2. Magic Link (daarna inloggen)

Onderwerp:

    Je inlogcode voor De Groene Pion

Inhoud:

```html
<div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; color: #1C211E">
  <div style="background: #1E6B43; padding: 20px; border-radius: 16px 16px 0 0; text-align: center">
    <img src="https://rijkenk.github.io/groenepion-app/icon-192.png" alt="De Groene Pion" width="64" height="64" style="border-radius: 14px">
  </div>
  <div style="background: #F6F7F3; padding: 24px; border-radius: 0 0 16px 16px">
    <h2 style="margin: 0 0 12px">Inloggen bij De Groene Pion</h2>
    <p style="text-align: center; font-size: 13px; color: #5B625D; margin: 0">Je inlogcode:</p>
    <p style="text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 6px; margin: 4px 0 16px">{{ .Token }}</p>
    <p>Typ deze code in de app. Op een computer kun je ook op de knop klikken.</p>
    <p style="text-align: center; margin: 24px 0">
      <a href="{{ .ConfirmationURL }}" style="background: #1E6B43; color: #FFFFFF; padding: 14px 24px; border-radius: 12px; text-decoration: none; font-weight: bold">Log in</a>
    </p>
    <p style="font-size: 13px; color: #5B625D">De code werkt één keer en verloopt na een uur. Heb je dit niet aangevraagd? Dan kun je deze mail negeren.</p>
  </div>
</div>
```

Let op: de gratis mailserver van Supabase verstuurt maar een paar mails per uur. Voor de echte lancering bij de club
koppelen we een eigen mailserver (SMTP), bijvoorbeeld via Resend of Brevo (gratis voor dit volume).
