# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recette.spec.ts >> acte 1 [admin] : délai de garde coupé à l’écran, motif exigé, historique ; un ADMIN est refusé
- Location: e2e/recette.spec.ts:316:5

# Error details

```
Error: réglage lu par un ADMIN

expect(locator).toBeVisible() failed

Locator: getByRole('listitem').filter({ has: getByText('Délai de garde des ventes', { exact: true }) }).getByText('Désactivé', { exact: true })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - réglage lu par un ADMIN getByRole('listitem').filter({ has: getByText('Délai de garde des ventes', { exact: true }) }).getByText('Désactivé', { exact: true }) with timeout 15000ms
  - waiting for getByRole('listitem').filter({ has: getByText('Délai de garde des ventes', { exact: true }) }).getByText('Désactivé', { exact: true })

```

```yaml
- complementary:
  - link "Event Village, accueil":
    - /url: /
    - text: EVENT VILLAGE
  - navigation "Navigation principale":
    - text: Administration
    - link "Tableau de bord":
      - /url: /admin/dashboard
      - img
      - text: Tableau de bord
    - paragraph: Gestion
    - link "Événements":
      - /url: /admin/events
      - img
      - text: Événements
    - link "Utilisateurs":
      - /url: /admin/users
      - img
      - text: Utilisateurs
    - link "Catalogues et services":
      - /url: /admin/services
      - img
      - text: Catalogues et services
    - paragraph: Finances
    - link "Finance":
      - /url: /admin/finance
      - img
      - text: Finance
    - link "Tarification":
      - /url: /admin/pricing
      - img
      - text: Tarification
    - paragraph: Engagement
    - link "Parrainage":
      - /url: /admin/referral
      - img
      - text: Parrainage
    - link "Communications":
      - /url: /admin/communications
      - img
      - text: Communications
    - paragraph: Système
    - link "Notifications":
      - /url: /admin/notifications
      - img
      - text: Notifications
    - link "Scanner":
      - /url: /scan
      - img
      - text: Scanner
    - link "Retour au site":
      - /url: /
      - img
      - text: Retour au site
  - link "Aïda Diallo Administrateur":
    - /url: /profile
  - button "Se déconnecter"
  - button "Basculer le thème"
- banner:
  - link "Rechercher un événement, un concert, un restaurant…":
    - /url: /explore
  - button "Notifications, 45 non lues": "45"
- main:
  - link "Administration":
    - /url: /admin
  - heading "Réglages de la plateforme" [level=1]
  - paragraph: "Lecture seule : seul un superadministrateur peut modifier ces réglages. Chaque modification est historisée et ne s’applique qu’aux opérations futures."
  - button "Actualiser"
  - alert:
    - heading "Réglages indisponibles" [level=3]
    - paragraph: "Action non autorisée : votre compte n’a pas la permission « Lire les réglages »."
    - button "Réessayer"
- alert
```

# Test source

```ts
  248 |     if (error) throw new Error(`[e2e] billets de ${userId} : ${error.message}`);
  249 |     return (data ?? []).map((t) => String(t.id));
  250 | }
  251 | 
  252 | async function ticketStatus(id: string): Promise<string> {
  253 |     const { data, error } = await serviceClient().from('tickets').select('status').eq('id', id).single();
  254 |     if (error || !data) throw new Error(`[e2e] billet ${id} : ${error?.message ?? 'introuvable'}`);
  255 |     return String(data.status);
  256 | }
  257 | 
  258 | /** Plein écran du résultat refermé : le scanner reçoit de nouveau les gestes. */
  259 | async function resultClosed(page: Page): Promise<void> {
  260 |     await expect(page.locator('[data-scan-state="result"]'), 'plein écran du résultat refermé').toHaveCount(0, { timeout: 20_000 });
  261 | }
  262 | 
  263 | async function expectScan(page: Page, payload: string, what: string, expected: string): Promise<void> {
  264 |     const { record } = await presentPayload(page, payload, what);
  265 |     await expect(page.locator(`[data-scan-result="${expected}"]`).first(), `${what} : « ${expected} » attendu (sonde : « ${record.result ?? '—'} »)`).toBeVisible();
  266 |     await resultClosed(page);
  267 | }
  268 | 
  269 | async function videoPlaying(page: Page, what: string): Promise<void> {
  270 |     await page.waitForFunction(() => Array.from(document.querySelectorAll('video')).some((v) => v.readyState >= 2), null, { timeout: 30_000 })
  271 |         .catch((err: unknown) => {
  272 |             throw new Error(`${what} : aucun flux vidéo en lecture (${err instanceof Error ? err.message.split('\n')[0] : String(err)})`);
  273 |         });
  274 | }
  275 | 
  276 | /** Remboursement unitaire à l'écran (A4) : recherche, motif, confirmation ; le POST ne part que de la seconde étape. */
  277 | async function refundOnScreen(page: Page, ticketNumber: string, reason: string, expectedNotice: RegExp): Promise<void> {
  278 |     await page.goto(`/partner/events/${r.e1.id}`);
  279 |     await openTab(page, /^ventes/i);
  280 |     await page.getByLabel(/^numéro du billet/i).fill(ticketNumber);
  281 |     await expectRoute(page, 'GET', /\/tickets\/lookup$/, () => page.getByRole('button', { name: /^rechercher le billet$/i }).click(), 200, `recherche du billet ${ticketNumber}`);
  282 |     await page.getByRole('button', { name: /^rembourser ce billet$/i }).click();
  283 |     const reasonDialog = page.getByRole('dialog', { name: /^motif du remboursement$/i });
  284 |     await expect(reasonDialog).toBeVisible();
  285 |     await reasonDialog.getByRole('textbox').fill(reason);
  286 |     await reasonDialog.getByRole('button', { name: /^continuer$/i }).click();
  287 |     const confirm = page.getByRole('alertdialog', { name: /^confirmer le remboursement/i });
  288 |     await expect(confirm).toBeVisible();
  289 |     await expect(confirm.getByText(reason), 'motif rappelé dans la confirmation').toBeVisible();
  290 |     await expect(confirm.getByRole('button', { name: /^revenir à la fiche$/i })).toBeVisible();
  291 |     await expectRoute(page, 'POST', /\/tickets\/[^/]+\/refund$/, () => confirm.getByRole('button', { name: /^rembourser le client$/i }).click(), 200, `remboursement du billet ${ticketNumber}`);
  292 |     await expect(page.getByText(expectedNotice).first(), `issue du remboursement du billet ${ticketNumber}`).toBeVisible();
  293 | }
  294 | 
  295 | test.beforeAll(() => {
  296 |     e2eConfig();
  297 | });
  298 | 
  299 | test.afterAll(async () => {
  300 |     const problems: string[] = [];
  301 |     const superadminId = await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email);
  302 |     for (const [key, value] of Array.from(previousSettings.entries())) {
  303 |         await restoreSetting(key, value, superadminId).catch((err: unknown) => problems.push(err instanceof Error ? err.message : String(err)));
  304 |     }
  305 |     const balance = await fakeServices('/__test/samirpay/balance', { solde: FAKE_BALANCE })
  306 |         .catch((err: unknown) => ({ status: 0, json: { error: err instanceof Error ? err.message : String(err) } }));
  307 |     if (balance.status !== 200) problems.push(`solde du faux SamirPay non rétabli : ${JSON.stringify(balance)}`);
  308 |     for (const { who, guard } of opened) {
  309 |         const seen = [...guard.blockingIssues(), ...guard.nonBlockingIssues()];
  310 |         if (seen.length > 0) console.log(`[e2e][recette] ${who} — observations du navigateur (non bloquantes) :\n${seen.join('\n')}`);
  311 |     }
  312 |     for (const c of Array.from(new Set(opened.map((o) => o.context)))) await c.close();
  313 |     if (problems.length > 0) throw new Error(`[e2e][recette] remise en état incomplète :\n${problems.join('\n')}`);
  314 | });
  315 | 
  316 | test('acte 1 [admin] : délai de garde coupé à l’écran, motif exigé, historique ; un ADMIN est refusé', async ({ browser }, testInfo) => {
  317 |     for (const key of [HOLD_KEY, SCAN_WINDOW_KEY]) previousSettings.set(key, await settingValue(key));
  318 |     const page = await asRole(browser, testInfo, 'fumee-superadmin');
  319 |     const hold = 'Délai de garde des ventes';
  320 |     const holdReason = `Recette ${STAMP} : fonds disponibles dès le paiement`;
  321 | 
  322 |     await test.step('motif exigé, puis réglage enregistré et historisé', async () => {
  323 |         await page.goto('/admin/finance-settings');
  324 |         const row = settingRow(page, hold);
  325 |         await row.getByRole('button', { name: `Modifier ${hold}` }).click();
  326 |         await row.getByLabel(/^nouvelle valeur/i).selectOption('false');
  327 |         await row.getByRole('button', { name: /^enregistrer$/i }).click();
  328 |         await expect(row.getByText(/indiquez le motif/i), 'sans motif, rien n’est envoyé').toBeVisible();
  329 |         await row.getByRole('button', { name: /^annuler$/i }).click();
  330 | 
  331 |         const edited = await editSetting(page, hold, (l) => l.getByLabel(/^nouvelle valeur/i).selectOption('false'), holdReason);
  332 |         await saveSetting(page, hold, edited, 'Désactivé');
  333 |         await expect(page.getByRole('listitem').filter({ hasText: holdReason }), 'motif dans l’historique des modifications').toBeVisible();
  334 |         expect(await settingValue(HOLD_KEY), `${HOLD_KEY} en base`).toBe(false);
  335 |     });
  336 | 
  337 |     await test.step('fenêtre de scan portée à 24 h (billet et contrôle de la veille)', async () => {
  338 |         const label = 'Ouverture du contrôle avant le début';
  339 |         const row = await editSetting(page, label, (l) => l.getByLabel(/^nouvelle valeur/i).fill('24'), `Recette ${STAMP} : contrôle ouvert la veille`);
  340 |         await saveSetting(page, label, row, '24 h');
  341 |         expect(await settingValue(SCAN_WINDOW_KEY), `${SCAN_WINDOW_KEY} en base`).toBe(24);
  342 |     });
  343 | 
  344 |     await test.step('un ADMIN lit les réglages sans « Modifier » (R51), sa modification envoyée directement est refusée', async () => {
  345 |         const admin = await asRole(browser, testInfo, 'admin');
  346 |         await admin.goto('/admin/finance-settings');
  347 |         await expect(admin.getByText(/^lecture seule : seul un superadministrateur peut modifier ces réglages\./i), 'lecture seule annoncée').toBeVisible();
> 348 |         await expect(settingRow(admin, hold).getByText('Désactivé', { exact: true }), 'réglage lu par un ADMIN').toBeVisible();
      |                                                                                                                  ^ Error: réglage lu par un ADMIN
  349 |         await expect(admin.getByRole('button', { name: /^modifier /i }), 'aucun bouton « Modifier » sans le droit (R51, B34)').toHaveCount(0);
  350 |         // Le serveur reste juge : la même modification envoyée sans l'écran est refusée
  351 |         const status = await admin.evaluate(async (key) => {
  352 |             const res = await fetch('/api/admin/finance-settings', {
  353 |                 method: 'PUT', headers: { 'Content-Type': 'application/json' },
  354 |                 body: JSON.stringify({ key, value: true, reason: 'Tentative d’un ADMIN sans le droit' }),
  355 |             });
  356 |             return res.status;
  357 |         }, HOLD_KEY);
  358 |         expect(status, 'modification par un ADMIN').toBe(403);
  359 |         expect(await settingValue(HOLD_KEY), `${HOLD_KEY} inchangé après le refus`).toBe(false);
  360 |     });
  361 | });
  362 | 
  363 | test('acte 2 [partenaire] [admin] : inscription avec pièces, validation, E1 et ses canaux, soumission, publication, E2', async ({ browser }, testInfo) => {
  364 |     const partner = await asNew(browser, testInfo, 'P1');
  365 |     const admin = await asRole(browser, testInfo, 'fumee-superadmin');
  366 | 
  367 |     await test.step('inscription du partenaire : formulaire, 2 pièces, code SMS', async () => {
  368 |         await partner.goto('/partner/register');
  369 |         await partner.locator('#partenaire-raison-sociale').fill(r.p1.company);
  370 |         await partner.locator('#partenaire-description').fill('Organisateur de la recette de la billetterie. Données fictives.');
  371 |         await partner.locator('#partenaire-adresse').fill('12, route de la Corniche, Ngor');
  372 |         await partner.locator('#partenaire-ville').fill('Dakar');
  373 |         await partner.locator('#partenaire-prenom').fill(r.p1.firstName);
  374 |         await partner.locator('#partenaire-nom').fill('Recette');
  375 |         await partner.locator('#partenaire-telephone').fill(r.p1.local);
  376 |         await partner.locator('#partenaire-email').fill(r.p1.email);
  377 |         await partner.locator('#partenaire-mot-de-passe').fill(TEST_PASSWORD);
  378 |         await partner.locator('#partenaire-confirmation').fill(TEST_PASSWORD);
  379 |         await partner.locator('#partenaire-piece-identite').setInputFiles(pdfDocument('piece-identite.pdf'));
  380 |         await partner.locator('#partenaire-document-entreprise').setInputFiles(pdfDocument('rccm.pdf'));
  381 |         const seen = await smsSeen(r.p1.phone);
  382 |         // Lot 9 bis (R53, B40) : appel 1, code envoyé, rien n'est créé tant que le code n'est pas saisi
  383 |         await expectRoute(partner, 'POST', '/api/partner/register', () => partner.getByRole('button', { name: /^envoyer mon dossier$/i }).click(), 200, 'dossier, appel 1 : envoi du code');
  384 |         await expect(partner.getByRole('heading', { name: /^vérifiez votre numéro$/i })).toBeVisible();
  385 |         const { data: early, error: earlyErr } = await serviceClient().from('users').select('id').in('phone', [r.p1.phone, r.p1.phone.slice(1)]);
  386 |         if (earlyErr) throw new Error(`[e2e] compte de P1 avant le code : ${earlyErr.message}`);
  387 |         expect(early ?? [], 'aucun compte créé avant le code (R53)').toEqual([]);
  388 |         await fillOtp(partner, await smsCode(r.p1.phone, seen, 'inscription du partenaire'));
  389 |         await expectRoute(partner, 'POST', '/api/partner/register', () => partner.getByRole('button', { name: /^vérifier le code$/i }).click(), 201, 'dossier, appel 2 : compte et fiche créés');
  390 |         await expect(partner.getByRole('heading', { name: /^dossier reçu$/i })).toBeVisible();
  391 |     });
  392 | 
  393 |     await test.step('R7 : espace partenaire en attente, « Compte en cours de vérification » avant la validation', async () => {
  394 |         await partner.getByRole('button', { name: /^ouvrir mon espace partenaire$/i }).click();
  395 |         await partner.waitForURL(/\/partner\/dashboard/, { timeout: 30_000 });
  396 |         await expect(partner.getByText('Compte en cours de vérification', { exact: true }).first(), 'bandeau du compte en attente (R7)').toBeVisible();
  397 |         // Session de l'inscription refermée : la connexion de P1 par son numéro est prouvée après la validation
  398 |         await partner.context().clearCookies();
  399 |     });
  400 | 
  401 |     await test.step('validation par le SUPERADMIN, après consultation d’une pièce', async () => {
  402 |         await admin.goto('/admin/dashboard');
  403 |         await openTab(admin, /^en attente/i);
  404 |         const row = admin.locator('tr').filter({ hasText: r.p1.company });
  405 |         await row.getByRole('button', { name: /^dossier$/i }).click();
  406 |         const details = admin.getByRole('dialog', { name: /^dossier du partenaire/i });
  407 |         await expect(details).toBeVisible();
  408 |         const signed = await expectRoute(admin, 'GET', '/api/partner/documents/signed-url',
  409 |             () => details.getByRole('button', { name: /^ouvrir la pièce d’identité/i }).click(), 200, 'lien de consultation de la pièce d’identité');
  410 |         expect(typeof signed.signedUrl, 'URL signée de la pièce').toBe('string');
  411 |         const file = await fetch(String(signed.signedUrl));
  412 |         expect(file.status, 'pièce lue par son URL signée').toBe(200);
  413 |         expect((await file.text()).startsWith('%PDF-'), 'pièce d’identité : le fichier déposé').toBe(true);
  414 |         await details.getByRole('button', { name: /^valider la candidature$/i }).click();
  415 |         const validation = admin.getByRole('alertdialog', { name: /^valider la candidature/i });
  416 |         await expectRoute(admin, 'PATCH', /^\/api\/admin\/partners\/[^/]+\/status$/, () => validation.getByRole('button', { name: /^valider la candidature$/i }).click(), 200, 'validation de la candidature');
  417 |         await expect(row, 'candidature sortie de la file').toHaveCount(0);
  418 |     });
  419 | 
  420 |     await test.step('P1 se connecte, crée E1 : affiche, programme, infos pratiques, 4 catégories et leurs canaux', async () => {
  421 |         // Lot 9 bis (R87) : l'adresse saisie attend sa vérification, P1 se connecte par son numéro
  422 |         await signIn(partner, r.p1.local, /^\/partner(\/|$)/);
  423 |         r.p1.userId = await userIdByPhone(r.p1.phone);
  424 | 
  425 |         const start = new Date(Date.now() + 20 * 3600_000);
  426 |         start.setUTCSeconds(0, 0);
  427 |         start.setUTCMinutes(Math.ceil(start.getUTCMinutes() / 5) * 5);
  428 |         const s = dakarParts(start);
  429 |         const e = dakarParts(new Date(start.getTime() + 4 * 3600_000));
  430 |         await partner.goto('/partner/events/new');
  431 |         await partner.getByLabel(/^titre/i).fill(r.e1.title);
  432 |         await partner.getByRole('radio', { name: /concerts/i }).or(partner.getByRole('button', { name: /^concerts/i })).first().click();
  433 |         await partner.getByLabel(/^description/i).fill('Soirée de la recette : vente en ligne et au guichet, scan, annulation et finance. Données fictives.');
  434 |         await partner.getByLabel(/date de début/i).fill(s.date);
  435 |         await partner.getByLabel(/heure de début/i).fill(s.time);
  436 |         await partner.getByLabel(/date de fin/i).fill(e.date);
  437 |         await partner.getByLabel(/heure de fin/i).fill(e.time);
  438 |         await partner.getByLabel(/^lieu/i).fill('Corniche de Ngor');
  439 |         await partner.getByLabel(/^ville/i).selectOption({ label: 'Dakar' });
  440 |         await partner.getByLabel(/capacité/i).fill('100');
  441 |         const upload = partner.waitForResponse((res) => res.url().includes('/api/partner/upload') && res.request().method() === 'POST');
  442 |         await partner.getByLabel(/affiche/i).setInputFiles({ name: 'affiche-recette.png', mimeType: 'image/png', buffer: await posterPng(partner, 'Nuit de Ngor', `${s.date} · ${s.time}`) });
  443 |         expect((await upload).ok(), 'téléversement de l’affiche').toBe(true);
  444 | 
  445 |         await partner.getByRole('button', { name: /^suivant/i }).click();
  446 |         await expect(partner.getByRole('heading', { level: 2, name: /^programme$/i })).toBeVisible();
  447 |         await partner.getByRole('button', { name: /^ajouter une ligne$/i }).click();
  448 |         await partner.getByLabel(/^heure/i).fill(PROGRAM.time);
```