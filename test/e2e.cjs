// End-to-end test van de demoversie op telefoonformaat.
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173/groenepion-app/';
const OUT = process.env.OUT || '.';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const shot = async (n) => { await p.waitForTimeout(250); await p.screenshot({ path: `${OUT}/${n}.png` }); };
  const step = async (name, fn) => { try { await fn(); console.log('ok  ', name); } catch (e) { console.log('FAIL', name, e.message.split('\n')[0]); errs.push(name); } };
  await p.goto(BASE);
  await p.getByRole('button', { name: /Kenneth/ }).waitFor({ timeout: 30000 });
  await shot('01-login');
  await step('inloggen als Kenneth', async () => { await p.getByRole('button', { name: /Kenneth/ }).click(); await p.getByText('Volgende spelavond').waitFor(); });
  await shot('02-avond');
  await step('kennerstafel vraagt regels, dan aanschuiven', async () => {
    const brass = p.locator('article', { hasText: 'Brass: Birmingham' });
    await brass.getByRole('button', { name: 'Aanschuiven' }).click();
    await brass.getByText('Ken je de regels al?').waitFor();
    await brass.scrollIntoViewIfNeeded(); await shot('03-regels');
    await brass.getByRole('button', { name: 'Ja, ik ken ze' }).click();
    await brass.getByRole('button', { name: 'Afmelden' }).waitFor();
  });
  await step('overlap met Century geeft conflict en wisselen werkt', async () => {
    const cen = p.locator('article', { hasText: 'Century' });
    await cen.getByRole('button', { name: 'Aanschuiven' }).click();
    await cen.getByText('Dit overlapt met een andere tafel').waitFor();
    await cen.scrollIntoViewIfNeeded(); await shot('04-overlap');
    await cen.getByRole('button', { name: 'Wissel naar deze tafel' }).click();
    await cen.getByRole('button', { name: 'Afmelden' }).waitFor();
    await p.locator('article', { hasText: 'Brass' }).getByRole('button', { name: 'Aanschuiven' }).waitFor();
  });
  await step('filter Zwaar toont geen Century', async () => {
    await p.getByRole('group', { name: 'Filter op zwaarte' }).getByRole('button', { name: 'Zwaar' }).click();
    if (await p.locator('article', { hasText: 'Century' }).count()) throw new Error('Century nog zichtbaar');
    await p.getByRole('group', { name: 'Filter op zwaarte' }).getByRole('button', { name: 'Alles' }).click();
  });
  await step('tafel aanbieden met al bezette plek', async () => {
    await p.getByRole('button', { name: '+ Tafel aanbieden' }).click();
    await p.getByLabel('Welk spel?').fill('Cascadia');
    await p.getByRole('button', { name: 'Bezette plekken meer' }).click();
    await p.getByRole('button', { name: 'Tafel plaatsen' }).scrollIntoViewIfNeeded(); await shot('05-aanbieden');
    await p.getByRole('button', { name: 'Tafel plaatsen' }).click();
    const mine = p.locator('article', { hasText: 'Cascadia' });
    await mine.getByText('Zoekt nog 2 spelers').waitFor();
    await mine.scrollIntoViewIfNeeded(); await shot('06-mijntafel');
  });
  await step('agenda: eigen thuisavond met aanvragen, vaste speler direct goedkeuren', async () => {
    await p.getByRole('button', { name: 'Agenda', exact: true }).click();
    const coop = p.locator('article', { hasText: 'Coöp-avond bij Kenneth' });
    await coop.waitFor();
    await coop.getByText('Vaste spelers direct goedkeuren').click();
    await coop.getByText('Gasten (1 van 3)').waitFor();
    await coop.getByRole('button', { name: 'Accepteren' }).first().click();
    await coop.getByText('Gasten (2 van 3)').waitFor();
    await coop.scrollIntoViewIfNeeded(); await shot('07-gastheer');
  });
  await step('agenda: aanvraag bij Joris, adres verborgen', async () => {
    const j = p.locator('article', { hasText: 'Expertspellen bij Joris' });
    await j.getByRole('button', { name: 'Aanvraag sturen' }).click();
    await j.getByText('Aanvraag verstuurd naar Joris').waitFor();
    if (await j.getByText('Voorbeeldstraat').count()) throw new Error('adres zichtbaar');
    await j.scrollIntoViewIfNeeded(); await shot('08-aanvraag');
  });
  await step('koopgoot: sorteren, bod doen', async () => {
    await p.getByRole('button', { name: 'Koopgoot', exact: true }).click();
    await p.selectOption('#sorteer', 'prijsop');
    await shot('09-koopgoot');
    await p.getByRole('button', { name: /Libertalia/ }).click();
    await p.getByRole('button', { name: 'Doe een bod' }).click();
    await p.getByRole('button', { name: 'Bod versturen' }).click();
    await p.getByText('Bod van € 16 verstuurd.').waitFor();
    await shot('10-bod');
  });
  await step('wissel naar Sanne: bod accepteren, Kenneth ziet WhatsApp', async () => {
    await p.getByRole('button', { name: 'Profiel', exact: true }).click();
    await p.getByRole('button', { name: 'Uitloggen' }).click();
    await p.getByRole('button', { name: /Sanne/ }).click();
    await p.getByRole('button', { name: 'Koopgoot', exact: true }).click();
    await p.getByRole('button', { name: /Libertalia/ }).click();
    await p.getByRole('button', { name: 'Accepteren' }).click();
    await p.getByRole('button', { name: /App Kenneth via WhatsApp/ }).waitFor();
    await p.getByRole('button', { name: /App Kenneth via WhatsApp/ }).click();
    await p.getByText('jullie zien elkaars telefoonnummer').waitFor();
    const href = await p.getByRole('link', { name: 'Open WhatsApp' }).getAttribute('href');
    if (!href.startsWith('https://wa.me/31611111111')) throw new Error('verkeerde link ' + href);
    await shot('11-whatsapp');
  });
  await step('meldingen: Sanne ziet melding van bod', async () => {
    await p.getByRole('button', { name: /Meldingen/ }).click();
    await p.getByText(/biedt € 16/).waitFor();
    await shot('12-meldingen');
    await p.getByRole('button', { name: 'Sluiten' }).click();
  });
  await step('spellotheek: lenen voor thuis', async () => {
    await p.getByRole('button', { name: 'Spellotheek', exact: true }).click();
    const azul = p.locator('article', { hasText: 'Azul' });
    await azul.getByRole('button', { name: 'Lenen voor thuis' }).click();
    await azul.getByText('Leenaanvraag ingediend').waitFor();
    await shot('13-spellotheek');
  });
  await step('nieuw lid ziet wachtscherm, beheerder keurt goed', async () => {
    await p.getByRole('button', { name: 'Profiel', exact: true }).click();
    await p.getByRole('button', { name: 'Uitloggen' }).click();
    await p.getByRole('button', { name: /Nieuw lid/ }).click();
    await p.getByText('Je aanmelding wacht op goedkeuring').waitFor();
    await shot('14-wacht');
    await p.getByRole('button', { name: 'Uitloggen' }).click();
    await p.getByRole('button', { name: /Kenneth/ }).click();
    await p.getByRole('button', { name: 'Profiel', exact: true }).click();
    await p.getByText('Nieuwe leden (1)').scrollIntoViewIfNeeded();
    await shot('15-beheer');
    await p.getByRole('button', { name: 'Goedkeuren' }).click();
    await p.getByText('Nieuwe leden (0)').waitFor();
  });
  console.log(errs.length ? 'FOUTEN: ' + JSON.stringify(errs) : 'alles ok, geen consolefouten');
  await b.close();
})();
