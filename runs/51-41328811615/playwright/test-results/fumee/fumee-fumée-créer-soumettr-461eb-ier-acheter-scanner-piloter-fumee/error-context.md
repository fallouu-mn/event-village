# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fumee.spec.ts >> fumée : créer, soumettre, valider, publier, acheter, scanner, piloter
- Location: e2e/fumee.spec.ts:79:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/^validé$/i).first()
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText(/^validé$/i).first() with timeout 15000ms
  - waiting for getByText(/^validé$/i).first()

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
    - link "Journal d’audit":
      - /url: /admin/audit
      - img
      - text: Journal d’audit
    - link "Scanner":
      - /url: /scan
      - img
      - text: Scanner
    - link "Retour au site":
      - /url: /
      - img
      - text: Retour au site
  - link "Elhadji SuperAdmin Super administrateur":
    - /url: /profile
  - button "Se déconnecter"
  - button "Basculer le thème":
    - img
- banner:
  - link "Rechercher un événement, un concert, un restaurant…":
    - /url: /explore
  - button "Notifications":
    - img
    - text: "3"
- main:
  - link "Retour aux événements":
    - /url: /admin/events
  - text: En attente de validation Concerts & Musique
  - heading "Fumée — Concert des Parcelles 17.13.17" [level=1]
  - paragraph: TEST Organisateur A · dim. 1 nov. 2026 à 19:15
  - button "Refuser"
  - button "Valider"
  - region "Dates et lieu":
    - heading "Dates et lieu" [level=2]
    - term: Début
    - definition: dim. 1 nov. 2026 à 19:15
    - term: Fin
    - definition: dim. 1 nov. 2026 à 23:15
    - term: Lieu
    - definition: Esplanade des Parcelles Assainies, Dakar
    - term: Jauge déclarée
    - definition: 100 personnes
  - region "Description":
    - heading "Description" [level=2]
    - paragraph: "Concert de fumée : parcours complet de la création au contrôle d’entrée. Données fictives."
  - region "Programme":
    - heading "Programme" [level=2]
    - paragraph: Aucun programme renseigné.
  - region "Catégories et prix":
    - heading "Catégories et prix" [level=2]
    - table "Catégories de billets, masquées et inactives comprises":
      - caption: Catégories de billets, masquées et inactives comprises
      - rowgroup:
        - row "Catégorie Prix Quota Période de vente Par commande Visibilité":
          - columnheader "Catégorie"
          - columnheader "Prix"
          - columnheader "Quota"
          - columnheader "Période de vente"
          - columnheader "Par commande"
          - columnheader "Visibilité"
      - rowgroup:
        - row "Entrée générale 5 000 F CFA 50 Dès la publication · jusqu’à l’événement 10 au plus Visible Active":
          - cell "Entrée générale"
          - cell "5 000 F CFA"
          - cell "50"
          - cell "Dès la publication · jusqu’à l’événement"
          - cell "10 au plus"
          - cell "Visible Active"
  - region "Affiche":
    - heading "Affiche" [level=2]
    - img "Affiche de « Fumée — Concert des Parcelles 17.13.17 »"
  - region "Organisateur":
    - heading "Organisateur" [level=2]
    - term: Structure
    - definition: TEST Organisateur A Orga A (test) Compte validé
    - term: Responsable
    - definition: Aïssatou OrgaA
    - term: Téléphone
    - definition:
      - link "+221700000003":
        - /url: tel:+221700000003
    - term: Email
    - definition:
      - link "partner-a@test.eventvillage.local":
        - /url: mailto:partner-a@test.eventvillage.local
    - term: Ville
    - definition: Dakar
  - region "Historique des statuts":
    - heading "Historique des statuts" [level=2]
    - list:
      - listitem:
        - paragraph: Brouillon → En attente de validation
        - paragraph: Aïssatou OrgaA (Organisateur) · Changement de statut
        - paragraph:
          - time: dim. 1 nov. 2026 à 17:13
      - listitem:
        - paragraph: "Création : Brouillon"
        - paragraph: Aïssatou OrgaA (Organisateur) · Création
        - paragraph:
          - time: dim. 1 nov. 2026 à 17:13
- alert:
  - img
  - text: SUCCÈS
  - paragraph: "Événement validé : l’organisateur peut maintenant le publier."
  - button "Fermer":
    - img
- alert
```

# Test source

```ts
  66  |         headers: { 'content-type': 'application/json' },
  67  |         body: JSON.stringify(body),
  68  |     });
  69  |     const text = await res.text();
  70  |     let json: Record<string, unknown>;
  71  |     try {
  72  |         json = text ? JSON.parse(text) as Record<string, unknown> : {};
  73  |     } catch (err) {
  74  |         throw new Error(`faux services ${pathName} : réponse illisible (${err instanceof Error ? err.message : String(err)}) : ${text.slice(0, 200)}`);
  75  |     }
  76  |     return { status: res.status, json };
  77  | }
  78  | 
  79  | test('fumée : créer, soumettre, valider, publier, acheter, scanner, piloter', async ({ browser }, testInfo) => {
  80  |     const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, '.');
  81  |     const title = `Fumée — Concert des Parcelles ${stamp}`;
  82  |     const category = 'Entrée générale';
  83  |     const start = new Date(Date.now() + 2 * 3600_000);
  84  |     start.setUTCSeconds(0, 0);
  85  |     start.setUTCMinutes(Math.ceil(start.getUTCMinutes() / 5) * 5);
  86  |     const end = new Date(start.getTime() + 4 * 3600_000);
  87  |     const s = dakarParts(start);
  88  |     const e = dakarParts(end);
  89  |     let eventId = '';
  90  |     let ticketId = '';
  91  | 
  92  |     const contexts: BrowserContext[] = [];
  93  |     const guards: Array<{ role: string; guard: PageGuard }> = [];
  94  |     async function pageAs(role: 'fumee-organisateur' | 'fumee-superadmin' | 'fumee-client', withCamera = false): Promise<Page> {
  95  |         const context = await openRoleContext(browser, testInfo, role);
  96  |         if (withCamera) await context.addInitScript(installFakeCamera, { mode: fakeScanMode() });
  97  |         contexts.push(context);
  98  |         const page = await context.newPage();
  99  |         guards.push({ role, guard: new PageGuard(page) });
  100 |         return page;
  101 |     }
  102 | 
  103 |     try {
  104 |         const partner = await pageAs('fumee-organisateur', true);
  105 | 
  106 |         await test.step('1. le partenaire crée l’événement (début dans 2 h)', async () => {
  107 |             await partner.goto('/partner/events/new');
  108 |             await partner.getByLabel(/^titre/i).fill(title);
  109 |             await partner.getByRole('radio', { name: /concerts/i }).or(partner.getByRole('button', { name: /^concerts/i })).first().click();
  110 |             await partner.getByLabel(/^description/i).fill('Concert de fumée : parcours complet de la création au contrôle d’entrée. Données fictives.');
  111 |             await partner.getByLabel(/date de début/i).fill(s.date);
  112 |             await partner.getByLabel(/heure de début/i).fill(s.time);
  113 |             await partner.getByLabel(/date de fin/i).fill(e.date);
  114 |             await partner.getByLabel(/heure de fin/i).fill(e.time);
  115 |             await partner.getByLabel(/^lieu/i).fill('Esplanade des Parcelles Assainies');
  116 |             await partner.getByLabel(/^ville/i).fill('Dakar');
  117 |             await partner.getByLabel(/capacité/i).fill('100');
  118 | 
  119 |             const posterPage = await partner.context().newPage();
  120 |             await posterPage.setViewportSize(POSTER_SIZE);
  121 |             await posterPage.setContent(posterHtml({
  122 |                 title: 'Concert des Parcelles', kicker: 'Fumée', dateLabel: `${s.date} · ${s.time}`, venue: 'Esplanade des Parcelles Assainies',
  123 |                 city: 'Dakar', organizer: 'Organisateur de test', palette: 'terre', motif: 'soleil',
  124 |             }));
  125 |             const poster = await posterPage.screenshot({ type: 'png' });
  126 |             await posterPage.close();
  127 |             const upload = partner.waitForResponse((r) => r.url().includes('/api/partner/upload') && r.request().method() === 'POST');
  128 |             await partner.getByLabel(/affiche/i).setInputFiles({ name: 'affiche-fumee.png', mimeType: 'image/png', buffer: poster });
  129 |             expect((await upload).ok(), 'téléversement de l’affiche').toBe(true);
  130 | 
  131 |             for (let i = 0; i < 6 && !(await partner.getByRole('heading', { name: /billetterie/i }).isVisible()); i++) {
  132 |                 await partner.getByRole('button', { name: /^suivant/i }).click();
  133 |             }
  134 |             await expect(partner.getByRole('heading', { name: /billetterie/i })).toBeVisible();
  135 |             await partner.getByRole('button', { name: /ajouter une catégorie/i }).click();
  136 |             await partner.getByLabel(/nom de la catégorie/i).fill(category);
  137 |             await partner.getByLabel(/^prix/i).fill('5000');
  138 |             await partner.getByLabel(/quantité|quota|nombre de places/i).fill('50');
  139 |             await partner.getByRole('button', { name: /^enregistrer/i }).click();
  140 |             await partner.waitForURL(/\/partner\/events(\?|$)/);
  141 |             await expect(partner.getByText(title, { exact: true })).toBeVisible();
  142 |         });
  143 | 
  144 |         await test.step('1 bis. le partenaire soumet l’événement', async () => {
  145 |             const card = cardOf(partner, title, /^soumettre/i);
  146 |             await actionWithConfirm(partner, card, /^soumettre/i);
  147 |             await expect(partner.locator('li, article, tr, section, div').filter({ has: partner.getByText(title, { exact: true }) }).last())
  148 |                 .toContainText(/en attente de validation/i);
  149 |         });
  150 | 
  151 |         await test.step('2. le SUPERADMIN valide l’événement', async () => {
  152 |             const admin = await pageAs('fumee-superadmin');
  153 |             // Diagnostic (run 50 : fiche restée en « En attente » après une validation réussie) : chaque
  154 |             // réponse de la fiche et de la transition est écrite dans e2e.log.
  155 |             admin.on('response', async (res) => {
  156 |                 const url = new URL(res.url());
  157 |                 if (!/^\/api\/admin\/events\/[0-9a-f-]{36}(\/transition)?$/.test(url.pathname)) return;
  158 |                 const body = (await res.json().catch(() => null)) as { actions?: { status?: string }; to?: string; code?: string } | null;
  159 |                 console.log(`[e2e][fiche admin] ${res.request().method()} ${url.pathname} → ${res.status()} statut=${body?.actions?.status ?? body?.to ?? '—'} code=${body?.code ?? '—'}`);
  160 |             });
  161 |             admin.on('console', (msg) => { if (msg.type() === 'error') console.log(`[e2e][fiche admin][console] ${msg.text()}`); });
  162 |             await admin.goto('/admin/events?status=EN_ATTENTE');
  163 |             await admin.getByRole('link', { name: new RegExp(escapeRe(title)) }).click();
  164 |             await admin.waitForURL(/\/admin\/events\/[0-9a-f-]{36}/);
  165 |             await actionWithConfirm(admin, admin.locator('main'), /^valider/i);
> 166 |             await expect(admin.getByText(/^validé$/i).first()).toBeVisible();
      |                                                                ^ Error: expect(locator).toBeVisible() failed
  167 |         });
  168 | 
  169 |         await test.step('3. le partenaire publie l’événement', async () => {
  170 |             await partner.goto('/partner/events');
  171 |             const card = cardOf(partner, title, /^publier/i);
  172 |             await actionWithConfirm(partner, card, /^publier/i);
  173 |             await expect(partner.locator('li, article, tr, section, div').filter({ has: partner.getByText(title, { exact: true }) }).last())
  174 |                 .toContainText(/publié/i);
  175 |         });
  176 | 
  177 |         const client = await pageAs('fumee-client');
  178 |         await test.step('4. le client achète un billet (faux SamirPay, vrai webhook)', async () => {
  179 |             await client.goto('/explore');
  180 |             await client.getByRole('link', { name: new RegExp(escapeRe(title)) }).first().click();
  181 |             await client.waitForURL(/\/events\/[0-9a-f-]{36}/);
  182 |             eventId = new URL(client.url()).pathname.split('/').pop() ?? '';
  183 |             await client.getByRole('button', { name: new RegExp(`ajouter un billet ${escapeRe(category)}`, 'i') }).click();
  184 |             await client.getByRole('button', { name: /^acheter/i }).click();
  185 |             const dialog = client.getByRole('dialog').or(client.getByRole('alertdialog'));
  186 |             await expect(dialog).toBeVisible();
  187 |             await dialog.getByRole('radio', { name: /^wave/i }).check();
  188 |             await dialog.getByLabel(/numéro/i).fill(fumeePayerPhone());
  189 |             await dialog.getByRole('button', { name: /payer|confirmer|continuer/i }).last().click();
  190 |             await client.waitForURL(/\/paiement\/[0-9a-f-]{36}/);
  191 |             const succeeded = client.waitForResponse(async (r) => {
  192 |                 if (!/\/api\/payments\/[^/]+\/status/.test(r.url()) || !r.ok()) return false;
  193 |                 const body = (await r.json()) as { status?: string; ticket_ids?: unknown };
  194 |                 return body.status === 'SUCCESS' && Array.isArray(body.ticket_ids) && body.ticket_ids.length > 0;
  195 |             }, { timeout: 45_000 });
  196 |             const done = await fakeServices('/__test/samirpay/complete', { telephone: fumeePayerPhone() });
  197 |             expect(done.status, `faux SamirPay : ${JSON.stringify(done.json)}`).toBe(200);
  198 |             expect(done.json.webhookStatus, `réponse du webhook réel : ${JSON.stringify(done.json)}`).toBe(200);
  199 |             const status = (await (await succeeded).json()) as { ticket_ids: string[] };
  200 |             ticketId = status.ticket_ids[0];
  201 |             await expect(client.getByText('Paiement confirmé')).toBeVisible({ timeout: 45_000 });
  202 |         });
  203 | 
  204 |         await test.step('5. le partenaire propriétaire scanne le billet (caméra simulée)', async () => {
  205 |             await partner.goto('/partner/scan');
  206 |             const select = partner.getByLabel('Événement contrôlé');
  207 |             const value = await select.locator('option', { hasText: title }).getAttribute('value');
  208 |             expect(value, 'événement publié proposé au scan').toBeTruthy();
  209 |             await select.selectOption(value as string);
  210 |             const cameraMode = partner.getByRole('button', { name: /^caméra$/i });
  211 |             if ((await cameraMode.getAttribute('aria-pressed')) !== 'true') await cameraMode.click();
  212 | 
  213 |             expect(ticketId, 'billet émis, lu dans la réponse de statut du paiement').toMatch(/^[0-9a-f-]{36}$/);
  214 |             const liveCode = client.waitForResponse((r) => r.url().includes(`/api/tickets/${ticketId}/live-code`) && r.ok());
  215 |             await client.goto('/tickets');
  216 |             const payload = String(((await (await liveCode).json()) as { payload?: string }).payload ?? '');
  217 |             const ticketCard = client.locator('li, article, section, div')
  218 |                 .filter({ has: client.getByText(title) })
  219 |                 .filter({ has: client.getByRole('img', { name: /QR d.entrée dynamique/i }) })
  220 |                 .last();
  221 |             const qr = ticketCard.getByRole('img', { name: /QR d.entrée dynamique/i });
  222 |             await expect(qr).toBeVisible();
  223 |             const png = await qr.screenshot();
  224 |             await partner.evaluate(async ({ dataUrl, p }) => {
  225 |                 const cam = (window as unknown as { __evFakeCamera?: { show: (d: string) => Promise<void>; setPayload: (x: string) => void } }).__evFakeCamera;
  226 |                 if (!cam) throw new Error('caméra simulée absente de la page');
  227 |                 cam.setPayload(p);
  228 |                 await cam.show(dataUrl);
  229 |             }, { dataUrl: `data:image/png;base64,${png.toString('base64')}`, p: payload });
  230 |             await expect(partner.getByText('Entrée validée')).toBeVisible({ timeout: 40_000 });
  231 |         });
  232 | 
  233 |         await test.step('6. la page de pilotage montre 1 vendu et 1 entrée', async () => {
  234 |             expect(eventId, 'identifiant de l’événement lu sur la page publique').toMatch(/^[0-9a-f-]{36}$/);
  235 |             await partner.goto(`/partner/events/${eventId}`);
  236 |             const apercu = partner.getByRole('tab', { name: /^aperçu/i });
  237 |             if ((await apercu.getAttribute('aria-selected')) !== 'true') await apercu.click();
  238 |             const panel = partner.getByRole('tabpanel');
  239 |             await expect(kpi(panel, /billets vendus/i)).toContainText(/(^|\D)1(\D|$)/);
  240 |             await expect(kpi(panel, /^entrées/i)).toContainText(/(^|\D)1(\D|$)/);
  241 |         });
  242 |     } finally {
  243 |         const issues = guards.flatMap(({ role, guard }) => guard.blockingIssues().map((i) => `${role} : ${i}`));
  244 |         if (issues.length > 0) {
  245 |             await testInfo.attach('erreurs-navigateur.txt', { body: issues.join('\n'), contentType: 'text/plain' });
  246 |             console.log(`[e2e][fumée] erreurs observées dans le navigateur :\n${issues.join('\n')}`);
  247 |         }
  248 |         for (const c of contexts) await c.close();
  249 |     }
  250 | });
  251 | 
```