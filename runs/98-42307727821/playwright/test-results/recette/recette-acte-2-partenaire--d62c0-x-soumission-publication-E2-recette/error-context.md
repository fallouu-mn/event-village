# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recette.spec.ts >> acte 2 [partenaire] [admin] : inscription avec pièces, validation, E1 et ses canaux, soumission, publication, E2
- Location: e2e/recette.spec.ts:322:5

# Error details

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for getByRole('dialog', { name: /^dossier du partenaire/i }).getByRole('button', { name: /^valider$/i })

```

# Page snapshot

```yaml
- generic [active] [ref=f1e1]:
  - generic [ref=f1e2]:
    - complementary [ref=f1e3]:
      - link "Event Village, accueil" [ref=f1e5] [cursor=pointer]:
        - /url: /
        - generic [ref=f1e11]:
          - generic [ref=f1e12]: EVENT
          - generic [ref=f1e13]: VILLAGE
      - navigation "Navigation principale" [ref=f1e14]:
        - generic [ref=f1e15]: Administration
        - link "Tableau de bord" [ref=f1e20] [cursor=pointer]:
          - /url: /admin/dashboard
        - generic [ref=f1e27]:
          - paragraph [ref=f1e28]: Gestion
          - generic [ref=f1e29]:
            - link "Événements" [ref=f1e30] [cursor=pointer]:
              - /url: /admin/events
            - link "Utilisateurs" [ref=f1e34] [cursor=pointer]:
              - /url: /admin/users
            - link "Catalogues et services" [ref=f1e41] [cursor=pointer]:
              - /url: /admin/services
        - generic [ref=f1e47]:
          - paragraph [ref=f1e48]: Finances
          - generic [ref=f1e49]:
            - link "Finance" [ref=f1e50] [cursor=pointer]:
              - /url: /admin/finance
            - link "Tarification" [ref=f1e54] [cursor=pointer]:
              - /url: /admin/pricing
        - generic [ref=f1e57]:
          - paragraph [ref=f1e58]: Engagement
          - generic [ref=f1e59]:
            - link "Parrainage" [ref=f1e60] [cursor=pointer]:
              - /url: /admin/referral
            - link "Communications" [ref=f1e65] [cursor=pointer]:
              - /url: /admin/communications
        - generic [ref=f1e70]:
          - paragraph [ref=f1e71]: Système
          - generic [ref=f1e72]:
            - link "Journal d’audit" [ref=f1e73] [cursor=pointer]:
              - /url: /admin/audit
            - link "Notifications" [ref=f1e78] [cursor=pointer]:
              - /url: /admin/notifications
            - link "Scanner" [ref=f1e85] [cursor=pointer]:
              - /url: /scan
        - link "Retour au site" [ref=f1e94] [cursor=pointer]:
          - /url: /
      - generic [ref=f1e99]:
        - link "Elhadji SuperAdmin Super administrateur" [ref=f1e100] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f1e101]: ES
          - generic [ref=f1e102]:
            - generic [ref=f1e103]: Elhadji SuperAdmin
            - generic [ref=f1e104]: Super administrateur
        - generic [ref=f1e105]:
          - button "Se déconnecter" [ref=f1e106] [cursor=pointer]
          - button "Basculer le thème" [ref=f1e111] [cursor=pointer]
    - generic [ref=f1e115]:
      - banner [ref=f1e116]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f1e118] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 34 non lues" [ref=f1e125] [cursor=pointer]:
          - generic [ref=f1e129]: "34"
      - main [ref=f1e130]:
        - generic [ref=f1e132]:
          - generic [ref=f1e134]:
            - generic [ref=f1e135]:
              - heading "Tableau de bord" [level=1] [ref=f1e136]
              - paragraph [ref=f1e137]: Dossiers à traiter et vue d’ensemble de la plateforme.
            - generic [ref=f1e138]:
              - status [ref=f1e139]: En direct
              - button "Actualiser" [ref=f1e141] [cursor=pointer]
          - region [ref=f1e149]:
            - heading "À traiter" [level=2] [ref=f1e150]
            - generic [ref=f1e151]:
              - generic [ref=f1e152]:
                - generic [ref=f1e153]:
                  - paragraph [ref=f1e155]: Événements à valider
                  - paragraph [ref=f1e161]: "4"
                  - paragraph [ref=f1e162]: Soumis par les organisateurs, en attente de votre examen.
                - link "Ouvrir la file de validation" [ref=f1e163] [cursor=pointer]:
                  - /url: /admin/events
              - generic [ref=f1e168]:
                - generic [ref=f1e169]:
                  - paragraph [ref=f1e171]: Partenaires à valider
                  - paragraph [ref=f1e177]: "1"
                  - paragraph [ref=f1e178]: Inscriptions avec leurs pièces justificatives.
                - link "Voir les candidatures" [ref=f1e179] [cursor=pointer]:
                  - /url: "#partenaires"
          - region [ref=f1e184]:
            - heading "Indicateurs" [level=2] [ref=f1e185]
            - generic [ref=f1e186]:
              - generic [ref=f1e187]:
                - paragraph [ref=f1e189]: Volume des transactions
                - paragraph [ref=f1e194]: 1 967 250 F CFA
                - paragraph [ref=f1e195]: Paiements en ligne encaissés
              - generic [ref=f1e196]:
                - paragraph [ref=f1e198]: Revenu net de la plateforme
                - paragraph [ref=f1e202]: 56 126 F CFA
                - paragraph [ref=f1e203]: Commissions et frais Event Village
              - generic [ref=f1e204]:
                - paragraph [ref=f1e206]: Partenaires validés
                - paragraph [ref=f1e212]: "6"
                - paragraph [ref=f1e213]: sur 7 inscrits
              - generic [ref=f1e214]:
                - paragraph [ref=f1e216]: Utilisateurs inscrits
                - paragraph [ref=f1e223]: "42"
                - paragraph [ref=f1e224]: 0 ambassadeur(s) actif(s)
          - region [ref=f1e225]:
            - generic [ref=f1e226]:
              - heading "Candidatures des partenaires" [level=2] [ref=f1e227]
              - paragraph [ref=f1e228]: Validez ou refusez les organisateurs, restaurants et gestionnaires de salles après examen de leur dossier.
            - tablist "Statut des candidatures" [ref=f1e230]:
              - tab "En attente , 1" [selected] [ref=f1e231] [cursor=pointer]:
                - generic [ref=f1e232]: En attente
                - generic [ref=f1e233]:
                  - generic [ref=f1e234]: ","
                  - text: "1"
              - tab "Validés , 6" [ref=f1e235] [cursor=pointer]:
                - generic [ref=f1e236]: Validés
                - generic [ref=f1e237]:
                  - generic [ref=f1e238]: ","
                  - text: "6"
              - tab "Refusés , 0" [ref=f1e239] [cursor=pointer]:
                - generic [ref=f1e240]: Refusés
                - generic [ref=f1e241]:
                  - generic [ref=f1e242]: ","
                  - text: "0"
              - tab "Tous , 7" [ref=f1e243] [cursor=pointer]:
                - generic [ref=f1e244]: Tous
                - generic [ref=f1e245]:
                  - generic [ref=f1e246]: ","
                  - text: "7"
            - tabpanel "En attente , 1" [ref=f1e247]:
              - table [ref=f1e250]:
                - caption [ref=f1e251]: Candidatures des partenaires
                - rowgroup [ref=f1e252]:
                  - row [ref=f1e253]:
                    - columnheader "Partenaire" [ref=f1e254]
                    - columnheader "Responsable" [ref=f1e255]
                    - columnheader "Statut" [ref=f1e256]
                    - columnheader "Inscrit le" [ref=f1e257]
                    - columnheader "Actions" [ref=f1e258]
                - rowgroup [ref=f1e259]:
                  - row [ref=f1e260]:
                    - cell "Recette Productions 23.28.06 Organisateur" [ref=f1e261]:
                      - generic [ref=f1e262]:
                        - generic [ref=f1e263]: Recette Productions 23.28.06
                        - generic [ref=f1e264]: Organisateur
                    - cell "Mame Recette +221777686477 Dakar" [ref=f1e267]:
                      - generic [ref=f1e268]:
                        - generic [ref=f1e269]: Mame Recette
                        - generic [ref=f1e270]: "+221777686477"
                        - generic [ref=f1e271]: Dakar
                    - cell "En attente" [ref=f1e272]
                    - cell [ref=f1e275]:
                      - time [ref=f1e276]: ven. 6 nov. 2026 à 23:28
                    - cell [ref=f1e277]:
                      - generic [ref=f1e278]:
                        - button "Dossier" [ref=f1e279] [cursor=pointer]
                        - button "Valider" [ref=f1e285] [cursor=pointer]
                        - button "Refuser" [ref=f1e291] [cursor=pointer]
          - region [ref=f1e298]:
            - heading "Raccourcis" [level=2] [ref=f1e299]
            - generic [ref=f1e300]:
              - link "Parrainage et ambassadeurs" [ref=f1e301] [cursor=pointer]:
                - /url: /admin/referral
              - link "Journal d’audit" [ref=f1e307] [cursor=pointer]:
                - /url: /admin/audit
              - link "Catalogues et services" [ref=f1e312] [cursor=pointer]:
                - /url: /admin/services
  - alert [ref=f1e319]
  - dialog [ref=f1e322]:
    - generic [ref=f1e323]:
      - generic [ref=f1e330]:
        - heading "Dossier du partenaire" [level=2] [ref=f1e331]
        - paragraph [ref=f1e332]: Recette Productions 23.28.06
      - button "Fermer" [ref=f1e333] [cursor=pointer]
    - generic [ref=f1e339]:
      - generic [ref=f1e340]:
        - generic [ref=f1e341]: En attente
        - generic [ref=f1e343]: Organisateur
      - region [ref=f1e345]:
        - heading "Structure" [level=3] [ref=f1e346]
        - generic [ref=f1e347]:
          - generic [ref=f1e348]:
            - term [ref=f1e349]: Raison sociale
            - definition [ref=f1e350]: Recette Productions 23.28.06
          - generic [ref=f1e351]:
            - term [ref=f1e352]: Nom commercial
            - definition [ref=f1e353]: Recette Productions 23.28.06
          - generic [ref=f1e354]:
            - term [ref=f1e355]: Ville
            - definition [ref=f1e356]: Dakar
          - generic [ref=f1e360]:
            - term [ref=f1e361]: Adresse
            - definition [ref=f1e362]: 12, route de la Corniche, Ngor
      - region [ref=f1e363]:
        - heading "Responsable du compte" [level=3] [ref=f1e364]
        - generic [ref=f1e365]:
          - generic [ref=f1e366]:
            - term [ref=f1e367]: Nom
            - definition [ref=f1e368]: Mame Recette
          - generic [ref=f1e369]:
            - term [ref=f1e370]: Téléphone
            - definition [ref=f1e371]:
              - link "+221777686477" [ref=f1e372] [cursor=pointer]:
                - /url: tel:+221777686477
          - generic [ref=f1e375]:
            - term [ref=f1e376]: Email
            - definition [ref=f1e377]:
              - link "p1.7686477@recette.eventvillage.local" [ref=f1e378] [cursor=pointer]:
                - /url: mailto:p1.7686477@recette.eventvillage.local
      - region [ref=f1e382]:
        - heading "Présentation de l’activité" [level=3] [ref=f1e383]
        - paragraph [ref=f1e384]: Organisateur de la recette de la billetterie. Données fictives.
      - region [ref=f1e385]:
        - heading "Pièces justificatives" [level=3] [ref=f1e386]
        - generic [ref=f1e387]:
          - generic [ref=f1e388]:
            - generic [ref=f1e394]:
              - paragraph [ref=f1e395]: Pièce d’identité
              - paragraph [ref=f1e396]: Document téléversé
            - button "Ouvrir la pièce d’identité dans un nouvel onglet" [ref=f1e397] [cursor=pointer]:
              - generic [ref=f1e398]: Ouvrir
          - generic [ref=f1e404]:
            - generic [ref=f1e410]:
              - paragraph [ref=f1e411]: NINEA ou RCCM
              - paragraph [ref=f1e412]: Document téléversé
            - button "Ouvrir le NINEA ou le RCCM dans un nouvel onglet" [ref=f1e413] [cursor=pointer]:
              - generic [ref=f1e414]: Ouvrir
    - generic [ref=f1e420]:
      - button "Fermer" [ref=f1e421] [cursor=pointer]
      - button "Refuser" [ref=f1e423] [cursor=pointer]
      - button "Valider la candidature" [ref=f1e430] [cursor=pointer]
```

# Test source

```ts
  261 | }
  262 | 
  263 | test.beforeAll(() => {
  264 |     e2eConfig();
  265 | });
  266 | 
  267 | test.afterAll(async () => {
  268 |     const problems: string[] = [];
  269 |     const superadminId = await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email);
  270 |     for (const [key, value] of Array.from(previousSettings.entries())) {
  271 |         await restoreSetting(key, value, superadminId).catch((err: unknown) => problems.push(err instanceof Error ? err.message : String(err)));
  272 |     }
  273 |     const balance = await fakeServices('/__test/samirpay/balance', { solde: FAKE_BALANCE })
  274 |         .catch((err: unknown) => ({ status: 0, json: { error: err instanceof Error ? err.message : String(err) } }));
  275 |     if (balance.status !== 200) problems.push(`solde du faux SamirPay non rétabli : ${JSON.stringify(balance)}`);
  276 |     for (const { who, guard } of opened) {
  277 |         const seen = [...guard.blockingIssues(), ...guard.nonBlockingIssues()];
  278 |         if (seen.length > 0) console.log(`[e2e][recette] ${who} — observations du navigateur (non bloquantes) :\n${seen.join('\n')}`);
  279 |     }
  280 |     for (const c of Array.from(new Set(opened.map((o) => o.context)))) await c.close();
  281 |     if (problems.length > 0) throw new Error(`[e2e][recette] remise en état incomplète :\n${problems.join('\n')}`);
  282 | });
  283 | 
  284 | test('acte 1 [admin] : délai de garde coupé à l’écran, motif exigé, historique ; un ADMIN est refusé', async ({ browser }, testInfo) => {
  285 |     for (const key of [HOLD_KEY, SCAN_WINDOW_KEY]) previousSettings.set(key, await settingValue(key));
  286 |     const page = await asRole(browser, testInfo, 'fumee-superadmin');
  287 |     const hold = 'Délai de garde des ventes';
  288 |     const holdReason = `Recette ${STAMP} : fonds disponibles dès le paiement`;
  289 | 
  290 |     await test.step('motif exigé, puis réglage enregistré et historisé', async () => {
  291 |         await page.goto('/admin/finance-settings');
  292 |         const row = settingRow(page, hold);
  293 |         await row.getByRole('button', { name: `Modifier ${hold}` }).click();
  294 |         await row.getByLabel(/^nouvelle valeur/i).selectOption('false');
  295 |         await row.getByRole('button', { name: /^enregistrer$/i }).click();
  296 |         await expect(row.getByText(/indiquez le motif/i), 'sans motif, rien n’est envoyé').toBeVisible();
  297 |         await row.getByRole('button', { name: /^annuler$/i }).click();
  298 | 
  299 |         const edited = await editSetting(page, hold, (l) => l.getByLabel(/^nouvelle valeur/i).selectOption('false'), holdReason);
  300 |         await saveSetting(page, hold, edited, 'Désactivé');
  301 |         await expect(page.getByRole('listitem').filter({ hasText: holdReason }), 'motif dans l’historique des modifications').toBeVisible();
  302 |         expect(await settingValue(HOLD_KEY), `${HOLD_KEY} en base`).toBe(false);
  303 |     });
  304 | 
  305 |     await test.step('fenêtre de scan portée à 24 h (billet et contrôle de la veille)', async () => {
  306 |         const label = 'Ouverture du contrôle avant le début';
  307 |         const row = await editSetting(page, label, (l) => l.getByLabel(/^nouvelle valeur/i).fill('24'), `Recette ${STAMP} : contrôle ouvert la veille`);
  308 |         await saveSetting(page, label, row, '24 h');
  309 |         expect(await settingValue(SCAN_WINDOW_KEY), `${SCAN_WINDOW_KEY} en base`).toBe(24);
  310 |     });
  311 | 
  312 |     await test.step('un ADMIN lit les réglages, sa modification est refusée', async () => {
  313 |         const admin = await asRole(browser, testInfo, 'admin');
  314 |         await admin.goto('/admin/finance-settings');
  315 |         const row = await editSetting(admin, hold, (l) => l.getByLabel(/^nouvelle valeur/i).selectOption('true'), 'Tentative d’un ADMIN sans le droit');
  316 |         await expectRoute(admin, 'PUT', '/api/admin/finance-settings', () => row.getByRole('button', { name: /^enregistrer$/i }).click(), 403, 'modification par un ADMIN');
  317 |         await expect(row.getByText('Réglage non enregistré'), 'refus affiché').toBeVisible();
  318 |         expect(await settingValue(HOLD_KEY), `${HOLD_KEY} inchangé après le refus`).toBe(false);
  319 |     });
  320 | });
  321 | 
  322 | test('acte 2 [partenaire] [admin] : inscription avec pièces, validation, E1 et ses canaux, soumission, publication, E2', async ({ browser }, testInfo) => {
  323 |     const partner = await asNew(browser, testInfo, 'P1');
  324 |     const admin = await asRole(browser, testInfo, 'fumee-superadmin');
  325 | 
  326 |     await test.step('inscription du partenaire : formulaire, 2 pièces, code SMS', async () => {
  327 |         await partner.goto('/partner/register');
  328 |         await partner.locator('#partenaire-raison-sociale').fill(r.p1.company);
  329 |         await partner.locator('#partenaire-description').fill('Organisateur de la recette de la billetterie. Données fictives.');
  330 |         await partner.locator('#partenaire-adresse').fill('12, route de la Corniche, Ngor');
  331 |         await partner.locator('#partenaire-ville').fill('Dakar');
  332 |         await partner.locator('#partenaire-prenom').fill(r.p1.firstName);
  333 |         await partner.locator('#partenaire-nom').fill('Recette');
  334 |         await partner.locator('#partenaire-telephone').fill(r.p1.local);
  335 |         await partner.locator('#partenaire-email').fill(r.p1.email);
  336 |         await partner.locator('#partenaire-mot-de-passe').fill(TEST_PASSWORD);
  337 |         await partner.locator('#partenaire-confirmation').fill(TEST_PASSWORD);
  338 |         await partner.locator('#partenaire-piece-identite').setInputFiles(pdfDocument('piece-identite.pdf'));
  339 |         await partner.locator('#partenaire-document-entreprise').setInputFiles(pdfDocument('rccm.pdf'));
  340 |         const seen = await smsSeen(r.p1.phone);
  341 |         await expectRoute(partner, 'POST', '/api/partner/register', () => partner.getByRole('button', { name: /^envoyer mon dossier$/i }).click(), 200, 'dépôt du dossier');
  342 |         await expect(partner.getByRole('heading', { name: /^vérifiez votre numéro$/i })).toBeVisible();
  343 |         await fillOtp(partner, await smsCode(r.p1.phone, seen, 'inscription du partenaire'));
  344 |         await partner.getByRole('button', { name: /^vérifier le code$/i }).click();
  345 |         await expect(partner.getByRole('heading', { name: /^dossier reçu$/i })).toBeVisible();
  346 |     });
  347 | 
  348 |     await test.step('validation par le SUPERADMIN, après consultation d’une pièce', async () => {
  349 |         await admin.goto('/admin/dashboard');
  350 |         await openTab(admin, /^en attente/i);
  351 |         const row = admin.locator('tr').filter({ hasText: r.p1.company });
  352 |         await row.getByRole('button', { name: /^dossier$/i }).click();
  353 |         const details = admin.getByRole('dialog', { name: /^dossier du partenaire/i });
  354 |         await expect(details).toBeVisible();
  355 |         const signed = await expectRoute(admin, 'GET', '/api/partner/documents/signed-url',
  356 |             () => details.getByRole('button', { name: /^ouvrir la pièce d’identité/i }).click(), 200, 'lien de consultation de la pièce d’identité');
  357 |         expect(typeof signed.signedUrl, 'URL signée de la pièce').toBe('string');
  358 |         const file = await fetch(String(signed.signedUrl));
  359 |         expect(file.status, 'pièce lue par son URL signée').toBe(200);
  360 |         expect((await file.text()).startsWith('%PDF-'), 'pièce d’identité : le fichier déposé').toBe(true);
> 361 |         await details.getByRole('button', { name: /^valider$/i }).click();
      |                                                                   ^ TimeoutError: locator.click: Timeout 15000ms exceeded.
  362 |         await expectRoute(admin, 'PATCH', /^\/api\/admin\/partners\/[^/]+\/status$/,
  363 |             () => admin.getByRole('button', { name: /^valider la candidature$/i }).click(), 200, 'validation de la candidature');
  364 |         await expect(row, 'candidature sortie de la file').toHaveCount(0);
  365 |     });
  366 | 
  367 |     await test.step('P1 se connecte, crée E1 : affiche, programme, infos pratiques, 4 catégories et leurs canaux', async () => {
  368 |         await signIn(partner, r.p1.email, /^\/partner(\/|$)/);
  369 |         r.p1.userId = await userIdByEmail(r.p1.email);
  370 | 
  371 |         const start = new Date(Date.now() + 20 * 3600_000);
  372 |         start.setUTCSeconds(0, 0);
  373 |         start.setUTCMinutes(Math.ceil(start.getUTCMinutes() / 5) * 5);
  374 |         const s = dakarParts(start);
  375 |         const e = dakarParts(new Date(start.getTime() + 4 * 3600_000));
  376 |         await partner.goto('/partner/events/new');
  377 |         await partner.getByLabel(/^titre/i).fill(r.e1.title);
  378 |         await partner.getByRole('radio', { name: /concerts/i }).or(partner.getByRole('button', { name: /^concerts/i })).first().click();
  379 |         await partner.getByLabel(/^description/i).fill('Soirée de la recette : vente en ligne et au guichet, scan, annulation et finance. Données fictives.');
  380 |         await partner.getByLabel(/date de début/i).fill(s.date);
  381 |         await partner.getByLabel(/heure de début/i).fill(s.time);
  382 |         await partner.getByLabel(/date de fin/i).fill(e.date);
  383 |         await partner.getByLabel(/heure de fin/i).fill(e.time);
  384 |         await partner.getByLabel(/^lieu/i).fill('Corniche de Ngor');
  385 |         await partner.getByLabel(/^ville/i).fill('Dakar');
  386 |         await partner.getByLabel(/capacité/i).fill('100');
  387 |         const upload = partner.waitForResponse((res) => res.url().includes('/api/partner/upload') && res.request().method() === 'POST');
  388 |         await partner.getByLabel(/affiche/i).setInputFiles({ name: 'affiche-recette.png', mimeType: 'image/png', buffer: await posterPng(partner, 'Nuit de Ngor', `${s.date} · ${s.time}`) });
  389 |         expect((await upload).ok(), 'téléversement de l’affiche').toBe(true);
  390 | 
  391 |         await partner.getByRole('button', { name: /^suivant/i }).click();
  392 |         await expect(partner.getByRole('heading', { level: 2, name: /^programme$/i })).toBeVisible();
  393 |         await partner.getByRole('button', { name: /^ajouter une ligne$/i }).click();
  394 |         await partner.getByLabel(/^heure/i).fill(PROGRAM.time);
  395 |         await partner.getByLabel(/^intitulé/i).fill(PROGRAM.title);
  396 |         await partner.getByLabel(/^artiste ou intervenant/i).fill(PROGRAM.participant);
  397 | 
  398 |         await partner.getByRole('button', { name: /^suivant/i }).click();
  399 |         await expect(partner.getByRole('heading', { level: 2, name: /^accès et informations pratiques$/i })).toBeVisible();
  400 |         await partner.getByLabel(/^adresse précise/i).fill(PRACTICAL.address);
  401 |         await partner.getByLabel(/^stationnement/i).fill(PRACTICAL.parking);
  402 |         await partner.getByLabel(/^indications d.accès/i).fill(PRACTICAL.access);
  403 |         await partner.getByLabel(/^règles à respecter/i).fill(PRACTICAL.rules);
  404 | 
  405 |         await partner.getByRole('button', { name: /^suivant/i }).click();
  406 |         await expect(partner.getByRole('heading', { level: 2, name: /^billetterie$/i })).toBeVisible();
  407 |         for (let i = 0; i < CATEGORIES.length; i++) await addCategory(partner, i, CATEGORIES[i]);
  408 |         await partner.getByRole('button', { name: /^enregistrer le brouillon$/i }).click();
  409 |         await partner.waitForURL(/\/partner\/events(\?|$)/);
  410 |         await expect(partner.getByText(r.e1.title, { exact: true })).toBeVisible();
  411 | 
  412 |         const { data: ev, error } = await serviceClient().from('events').select('id').eq('title', r.e1.title).single();
  413 |         if (error || !ev) throw new Error(`[e2e] événement E1 : ${error?.message ?? 'introuvable'}`);
  414 |         r.e1.id = String(ev.id);
  415 |         const { data: cats, error: catErr } = await serviceClient().from('ticket_categories').select('id, name, sale_online, sale_counter, is_visible').eq('event_id', r.e1.id);
  416 |         if (catErr) throw new Error(`[e2e] catégories de E1 : ${catErr.message}`);
  417 |         for (const c of cats ?? []) r.e1.categories[String(c.name)] = String(c.id);
  418 |         expect((cats ?? []).map((c) => `${String(c.name)} ${String(c.sale_online)} ${String(c.sale_counter)} ${String(c.is_visible)}`).sort(), 'canaux enregistrés, is_visible en miroir')
  419 |             .toEqual(CATEGORIES.map((c) => `${c.name} ${c.online} ${c.counter} ${c.online}`).sort());
  420 |     });
  421 | 
  422 |     await test.step('soumission par P1, validation par le SUPERADMIN, publication par P1', async () => {
  423 |         await actionWithConfirm(partner, cardOf(partner, r.e1.title, /^soumettre/i), /^soumettre/i);
  424 |         await expect(partner.locator('li, article, tr, section, div').filter({ has: partner.getByText(r.e1.title, { exact: true }) }).last()).toContainText(/en attente de validation/i);
  425 | 
  426 |         await admin.goto('/admin/events?status=EN_ATTENTE');
  427 |         await admin.getByRole('link', { name: new RegExp(escapeRe(r.e1.title)) }).click();
  428 |         await admin.waitForURL(/\/admin\/events\/[0-9a-f-]{36}/);
  429 |         await actionWithConfirm(admin, admin.locator('main'), /^valider/i);
  430 |         await expect(admin.getByText(/^validé$/i).first()).toBeVisible();
  431 | 
  432 |         await partner.goto('/partner/events');
  433 |         await actionWithConfirm(partner, cardOf(partner, r.e1.title, /^publier/i), /^publier/i);
  434 |         await expect(partner.locator('li, article, tr, section, div').filter({ has: partner.getByText(r.e1.title, { exact: true }) }).last()).toContainText(/publié/i);
  435 |     });
  436 | 
  437 |     await test.step('E2 de P1 à J+2 (RPC du lot 5), Standard 3 000 F : l’annulation de l’acte 7 ne touche pas E1', async () => {
  438 |         const day = dakarDayFrom(new Date(), 2);
  439 |         r.e2.id = await createPublishedEvent({
  440 |             partnerUserId: r.p1.userId,
  441 |             superadminId: await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email),
  442 |             title: r.e2.title,
  443 |             description: 'Concert de la recette destiné à être annulé : remboursement automatique. Données fictives.',
  444 |             startDate: day, startTime: '20:00:00', endDate: day, endTime: '23:00:00',
  445 |             location: 'Corniche de Ngor', city: 'Dakar', capacity: 100,
  446 |             imageUrl: await eventImageUrl(r.e1.id),
  447 |             category: { name: 'Standard', price: 3000, total: 50 },
  448 |         });
  449 |     });
  450 | });
  451 | 
  452 | test('acte 3 [partenaire] : invitation de K1, permission espèces, point d’entrée, PIN régisseur', async () => {
  453 |     const partner = known('P1');
  454 |     await partner.goto(`/partner/events/${r.e1.id}`);
  455 |     await openTab(partner, /^équipe/i);
  456 | 
  457 |     await test.step('invitation de K1 avec la permission espèces, SMS d’activation', async () => {
  458 |         await partner.getByLabel(/^prénom/i).fill(r.k1.firstName);
  459 |         await partner.getByLabel(/^nom/i).first().fill('Controle');
  460 |         await partner.getByLabel(/^téléphone du contrôleur/i).fill(r.k1.local);
  461 |         await partner.getByRole('checkbox', { name: /encaissement en espèces/i }).check();
```