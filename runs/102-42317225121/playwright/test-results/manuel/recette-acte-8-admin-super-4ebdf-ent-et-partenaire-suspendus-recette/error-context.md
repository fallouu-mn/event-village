# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recette.spec.ts >> acte 8 [admin] : supervision et relance d’une notification, remboursement bloqué relancé (A3), événement et partenaire suspendus
- Location: e2e/recette.spec.ts:841:5

# Error details

```
Test timeout of 360000ms exceeded.
```

```
Error: response.text: Target page, context or browser has been closed
```

# Page snapshot

```yaml
- generic [active] [ref=f5e1]:
  - generic [ref=f5e2]:
    - complementary [ref=f5e3]:
      - link "Event Village, accueil" [ref=f5e5] [cursor=pointer]:
        - /url: /
        - generic [ref=f5e11]:
          - generic [ref=f5e12]: EVENT
          - generic [ref=f5e13]: VILLAGE
      - navigation "Navigation principale" [ref=f5e14]:
        - generic [ref=f5e15]: Administration
        - link "Tableau de bord" [ref=f5e20] [cursor=pointer]:
          - /url: /admin/dashboard
        - generic [ref=f5e27]:
          - paragraph [ref=f5e28]: Gestion
          - generic [ref=f5e29]:
            - link "Événements" [ref=f5e30] [cursor=pointer]:
              - /url: /admin/events
            - link "Utilisateurs" [ref=f5e34] [cursor=pointer]:
              - /url: /admin/users
            - link "Catalogues et services" [ref=f5e41] [cursor=pointer]:
              - /url: /admin/services
        - generic [ref=f5e47]:
          - paragraph [ref=f5e48]: Finances
          - generic [ref=f5e49]:
            - link "Finance" [ref=f5e50] [cursor=pointer]:
              - /url: /admin/finance
            - link "Tarification" [ref=f5e54] [cursor=pointer]:
              - /url: /admin/pricing
        - generic [ref=f5e57]:
          - paragraph [ref=f5e58]: Engagement
          - generic [ref=f5e59]:
            - link "Parrainage" [ref=f5e60] [cursor=pointer]:
              - /url: /admin/referral
            - link "Communications" [ref=f5e65] [cursor=pointer]:
              - /url: /admin/communications
        - generic [ref=f5e70]:
          - paragraph [ref=f5e71]: Système
          - generic [ref=f5e72]:
            - link "Journal d’audit" [ref=f5e73] [cursor=pointer]:
              - /url: /admin/audit
            - link "Notifications" [ref=f5e78] [cursor=pointer]:
              - /url: /admin/notifications
            - link "Scanner" [ref=f5e85] [cursor=pointer]:
              - /url: /scan
        - link "Retour au site" [ref=f5e94] [cursor=pointer]:
          - /url: /
      - generic [ref=f5e99]:
        - link "Elhadji SuperAdmin Super administrateur" [ref=f5e100] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f5e101]: ES
          - generic [ref=f5e102]:
            - generic [ref=f5e103]: Elhadji SuperAdmin
            - generic [ref=f5e104]: Super administrateur
        - generic [ref=f5e105]:
          - button "Se déconnecter" [ref=f5e106] [cursor=pointer]
          - button "Basculer le thème" [ref=f5e111] [cursor=pointer]
    - generic [ref=f5e115]:
      - banner [ref=f5e116]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f5e118] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 35 non lues" [ref=f5e125] [cursor=pointer]:
          - generic [ref=f5e129]: "35"
      - main [ref=f5e130]:
        - generic [ref=f5e132]:
          - generic [ref=f5e133]:
            - generic [ref=f5e134]:
              - link [ref=f5e135] [cursor=pointer]:
                - /url: /admin/dashboard
              - generic [ref=f5e138]:
                - text: Console Superadmin HQ
                - heading "Gestion des Utilisateurs & Permissions RBAC" [level=1] [ref=f5e139]
            - generic [ref=f5e140]:
              - button "Actualiser" [ref=f5e141] [cursor=pointer]
              - button "Créer un Compte / Admin" [ref=f5e148] [cursor=pointer]
          - generic [ref=f5e153]:
            - generic [ref=f5e154]:
              - textbox "Rechercher par nom, email, téléphone..." [ref=f5e159]: p1.0981941@recette.eventvillage.local
              - generic [ref=f5e160]:
                - button "Tous" [ref=f5e161] [cursor=pointer]
                - button "SUPERADMIN" [ref=f5e162] [cursor=pointer]
                - button "ADMIN" [ref=f5e163] [cursor=pointer]
                - button "PARTENAIRE" [ref=f5e164] [cursor=pointer]
                - button "CONTROLEUR" [ref=f5e165] [cursor=pointer]
                - button "CLIENT" [ref=f5e166] [cursor=pointer]
            - generic [ref=f5e168]:
              - generic [ref=f5e169]:
                - generic [ref=f5e170]:
                  - heading "Mame Recette" [level=4] [ref=f5e171]
                  - generic [ref=f5e172]: PARTENAIRE
                  - generic [ref=f5e173]: SUSPENDU
                - generic [ref=f5e174]:
                  - generic [ref=f5e175]: "+221770981941"
                  - generic [ref=f5e179]: p1.0981941@recette.eventvillage.local
              - generic [ref=f5e184]:
                - button "Réactiver" [ref=f5e185] [cursor=pointer]
                - button "Supprimer" [ref=f5e187] [cursor=pointer]
  - alert [ref=f5e192]
```

# Test source

```ts
  51  | const FAKE_BALANCE = 50_000_000;
  52  | const NOTICE_E2 = 'Concert de recette annulé : les billets payés en ligne sont remboursés automatiquement.';
  53  | const PROGRAM = { time: '20:30', title: 'Grand cercle de recette', participant: 'Ensemble des Almadies' };
  54  | const PRACTICAL = {
  55  |     address: '12, route de la Corniche, Ngor', parking: 'Parking surveillé devant le site.',
  56  |     access: 'Entrée principale par la plage de Ngor.', rules: 'Billet présenté sur téléphone, sans objet en verre.',
  57  | };
  58  | 
  59  | interface CategorySpec { name: string; price: number; total: number; online: boolean; counter: boolean; result: string }
  60  | const CATEGORIES: readonly CategorySpec[] = [
  61  |     { name: 'Standard', price: 6000, total: 50, online: true, counter: true, result: 'En ligne et au guichet' },
  62  |     { name: 'Sur place', price: 5000, total: 20, online: false, counter: true, result: 'Sur place uniquement' },
  63  |     { name: 'Invitations', price: 0, total: 10, online: false, counter: false, result: 'Invitations seulement' },
  64  |     { name: 'Découverte', price: 0, total: 20, online: true, counter: false, result: 'En ligne uniquement' },
  65  | ];
  66  | 
  67  | /** Numéros dérivés de l'horloge, un préfixe par compte : `^\+221[7][05678]\d{7}$` (lib/validations/auth.ts). */
  68  | const TAIL = String(Date.now() % 10_000_000).padStart(7, '0');
  69  | const STAMP = new Date().toISOString().slice(11, 19).replace(/:/g, '.');
  70  | const local = (prefix: string): string => `${prefix}${TAIL}`;
  71  | 
  72  | /** Objet Recette du contrat : état partagé par les actes, en mémoire du fichier. */
  73  | interface Recette {
  74  |     c1: { local: string; phone: string; firstName: string; userId: string };
  75  |     p1: { local: string; phone: string; email: string; company: string; firstName: string; userId: string };
  76  |     k1: { local: string; phone: string; firstName: string };
  77  |     bisPhone: string;
  78  |     e1: { id: string; title: string; categories: Record<string, string> };
  79  |     e2: { id: string; title: string };
  80  |     pin: string;
  81  |     /** Billets : Std1 scanné hors ligne, Std2 transféré puis saisi à la main, free scanné en ligne, e2 remboursé par l'annulation. */
  82  |     tickets: { std1: string; std2: string; free: string; e2: string; refundShown: string; refundBlocked: string };
  83  |     numbers: Record<string, string>;
  84  |     /** Lot hors ligne de Std2 relevé AVANT son transfert : ancien code présenté à l'acte 5. */
  85  |     oldLot: StoredLot | null;
  86  | }
  87  | 
  88  | const r: Recette = {
  89  |     c1: { local: local('78'), phone: `+221${local('78')}`, firstName: 'Awa', userId: '' },
  90  |     p1: {
  91  |         local: local('77'), phone: `+221${local('77')}`, email: `p1.${TAIL}@recette.eventvillage.local`, company: `Recette Productions ${STAMP}`, firstName: 'Mame', userId: '',
  92  |     },
  93  |     k1: { local: local('76'), phone: `+221${local('76')}`, firstName: 'Modou' },
  94  |     bisPhone: FIXTURE_USERS.CLIENT_BIS.phone.replace(/^\+221/, ''),
  95  |     e1: { id: '', title: `Recette — Nuit de Ngor ${STAMP}`, categories: {} },
  96  |     e2: { id: '', title: `Recette — Concert annulé ${STAMP}` },
  97  |     pin: '',
  98  |     tickets: { std1: '', std2: '', free: '', e2: '', refundShown: '', refundBlocked: '' },
  99  |     numbers: {},
  100 |     oldLot: null,
  101 | };
  102 | 
  103 | /** Réglages lus avant l'acte 1, remis dans afterAll même après un échec. */
  104 | const previousSettings = new Map<string, unknown>();
  105 | 
  106 | interface Opened { who: string; context: BrowserContext; page: Page; guard: PageGuard }
  107 | 
  108 | /** Contextes gardés d'un acte à l'autre (un seul worker, mode serial), fermés et diagnostiqués dans afterAll. */
  109 | const opened: Opened[] = [];
  110 | const byWho = new Map<string, Opened>();
  111 | 
  112 | function adopt(who: string, context: BrowserContext, page: Page): Page {
  113 |     const o = { who, context, page, guard: new PageGuard(page) };
  114 |     opened.push(o);
  115 |     byWho.set(who, o);
  116 |     return page;
  117 | }
  118 | 
  119 | function known(who: string): Page {
  120 |     const o = byWho.get(who);
  121 |     if (!o) throw new Error(`[e2e][recette] page de « ${who} » absente : un acte précédent n'a pas abouti`);
  122 |     return o.page;
  123 | }
  124 | 
  125 | async function asRole(browser: Browser, testInfo: TestInfo, role: RoleKey): Promise<Page> {
  126 |     const existing = byWho.get(role);
  127 |     if (existing) return existing.page;
  128 |     const context = await openRoleContext(browser, testInfo, role, 'clair');
  129 |     return adopt(role, context, await context.newPage());
  130 | }
  131 | 
  132 | async function asNew(browser: Browser, testInfo: TestInfo, who: string, opts: { probe?: boolean } = {}): Promise<Page> {
  133 |     const context = await openAnonymousContext(browser, testInfo, opts.probe ? 'sombre' : 'clair');
  134 |     if (opts.probe) await context.addInitScript(installScanProbe);
  135 |     return adopt(who, context, await context.newPage());
  136 | }
  137 | 
  138 | function pathOf(url: string): string {
  139 |     return new URL(url).pathname;
  140 | }
  141 | 
  142 | /** Réponse d'une route, attendue autour d'une action : statut exigé, corps cité dans le message d'échec. */
  143 | async function expectRoute(page: Page, method: string, path: RegExp | string, action: () => Promise<unknown>, status: number, what: string): Promise<Record<string, unknown>> {
  144 |     const waited = page.waitForResponse((res) => {
  145 |         if (res.request().method() !== method) return false;
  146 |         const p = pathOf(res.url());
  147 |         return typeof path === 'string' ? p === path : path.test(p);
  148 |     });
  149 |     await action();
  150 |     const res = await waited;
> 151 |     const text = await res.text();
      |                            ^ Error: response.text: Target page, context or browser has been closed
  152 |     expect(res.status(), `${what} : ${text.slice(0, 300)}`).toBe(status);
  153 |     if (!/json/i.test(res.headers()['content-type'] ?? '')) return {};
  154 |     try {
  155 |         return JSON.parse(text) as Record<string, unknown>;
  156 |     } catch (err) {
  157 |         throw new Error(`${what} : réponse JSON illisible (${err instanceof Error ? err.message : String(err)}) : ${text.slice(0, 300)}`);
  158 |     }
  159 | }
  160 | 
  161 | /** Ligne d'un réglage sur /admin/finance-settings : valeur modifiée à l'écran, motif obligatoire. */
  162 | function settingRow(page: Page, label: string): Locator {
  163 |     return page.getByRole('listitem').filter({ has: page.getByText(label, { exact: true }) });
  164 | }
  165 | 
  166 | async function editSetting(page: Page, label: string, apply: (row: Locator) => Promise<unknown>, reason: string): Promise<Locator> {
  167 |     const row = settingRow(page, label);
  168 |     await row.getByRole('button', { name: `Modifier ${label}` }).click();
  169 |     await apply(row);
  170 |     await row.getByRole('textbox', { name: /^motif/i }).fill(reason);
  171 |     return row;
  172 | }
  173 | 
  174 | async function saveSetting(page: Page, label: string, row: Locator, value: string): Promise<void> {
  175 |     await expectRoute(page, 'PUT', '/api/admin/finance-settings', () => row.getByRole('button', { name: /^enregistrer$/i }).click(), 200, `réglage « ${label} »`);
  176 |     await expect(settingRow(page, label).getByText(value, { exact: true }), `réglage « ${label} » affiché`).toBeVisible();
  177 | }
  178 | 
  179 | /** Connexion par le formulaire (e2e/auth.setup.ts), mot de passe de test. */
  180 | async function signIn(page: Page, identifier: string, arrival: RegExp): Promise<void> {
  181 |     await page.goto('/login');
  182 |     await page.getByLabel(/e-?mail ou t[ée]l[ée]phone/i).first().fill(identifier);
  183 |     await page.getByLabel(/^mot de passe/i).first().fill(TEST_PASSWORD);
  184 |     await page.getByRole('button', { name: /^se connecter$/i }).click();
  185 |     await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
  186 |     await expect.poll(() => pathOf(page.url()), { message: `page d'arrivée de ${identifier}`, timeout: 15_000 }).toMatch(arrival);
  187 | }
  188 | 
  189 | /** Pièce d'inscription : seule la signature du contenu est lue par la route de dépôt. */
  190 | function pdfDocument(name: string): { name: string; mimeType: string; buffer: Buffer } {
  191 |     return { name, mimeType: 'application/pdf', buffer: Buffer.from(`%PDF-1.4\n% ${name}, pièce fictive de la recette\n%%EOF\n`, 'latin1') };
  192 | }
  193 | 
  194 | async function posterPng(page: Page, title: string, dateLabel: string): Promise<Buffer> {
  195 |     const poster = await page.context().newPage();
  196 |     await poster.setViewportSize(POSTER_SIZE);
  197 |     await poster.setContent(posterHtml({ title, kicker: 'Recette', dateLabel, venue: 'Corniche de Ngor', city: 'Dakar', organizer: r.p1.company, palette: 'ocean', motif: 'vagues' }));
  198 |     const png = await poster.screenshot({ type: 'png' });
  199 |     await poster.close();
  200 |     return png;
  201 | }
  202 | 
  203 | async function addCategory(page: Page, index: number, c: CategorySpec): Promise<void> {
  204 |     await page.getByRole('button', { name: /^ajouter une catégorie$/i }).click();
  205 |     const section = page.locator('section[aria-labelledby$="-titre"]').nth(index);
  206 |     await section.getByLabel(/^nom de la catégorie/i).fill(c.name);
  207 |     await section.getByLabel(/^prix/i).fill(String(c.price));
  208 |     await section.getByLabel(/^quantité mise en vente/i).fill(String(c.total));
  209 |     await section.getByRole('checkbox', { name: /^vendue en ligne/i }).setChecked(c.online);
  210 |     await section.getByRole('checkbox', { name: /^vendue au guichet/i }).setChecked(c.counter);
  211 |     await expect(section.getByText(c.result, { exact: true }), `résumé des canaux de « ${c.name} »`).toBeVisible();
  212 | }
  213 | 
  214 | /** Billets d'un compte sur un événement, du plus ancien au plus récent. */
  215 | async function ticketsOf(eventId: string, userId: string, categoryId: string): Promise<string[]> {
  216 |     const { data, error } = await serviceClient().from('tickets').select('id').eq('event_id', eventId).eq('user_id', userId).eq('category_id', categoryId).order('ticket_number');
  217 |     if (error) throw new Error(`[e2e] billets de ${userId} : ${error.message}`);
  218 |     return (data ?? []).map((t) => String(t.id));
  219 | }
  220 | 
  221 | async function ticketStatus(id: string): Promise<string> {
  222 |     const { data, error } = await serviceClient().from('tickets').select('status').eq('id', id).single();
  223 |     if (error || !data) throw new Error(`[e2e] billet ${id} : ${error?.message ?? 'introuvable'}`);
  224 |     return String(data.status);
  225 | }
  226 | 
  227 | /** Plein écran du résultat refermé : le scanner reçoit de nouveau les gestes. */
  228 | async function resultClosed(page: Page): Promise<void> {
  229 |     await expect(page.locator('[data-scan-state="result"]'), 'plein écran du résultat refermé').toHaveCount(0, { timeout: 20_000 });
  230 | }
  231 | 
  232 | async function expectScan(page: Page, payload: string, what: string, expected: string): Promise<void> {
  233 |     const { record } = await presentPayload(page, payload, what);
  234 |     await expect(page.locator(`[data-scan-result="${expected}"]`).first(), `${what} : « ${expected} » attendu (sonde : « ${record.result ?? '—'} »)`).toBeVisible();
  235 |     await resultClosed(page);
  236 | }
  237 | 
  238 | async function videoPlaying(page: Page, what: string): Promise<void> {
  239 |     await page.waitForFunction(() => Array.from(document.querySelectorAll('video')).some((v) => v.readyState >= 2), null, { timeout: 30_000 })
  240 |         .catch((err: unknown) => {
  241 |             throw new Error(`${what} : aucun flux vidéo en lecture (${err instanceof Error ? err.message.split('\n')[0] : String(err)})`);
  242 |         });
  243 | }
  244 | 
  245 | /** Remboursement unitaire à l'écran (A4) : recherche, motif, confirmation ; le POST ne part que de la seconde étape. */
  246 | async function refundOnScreen(page: Page, ticketNumber: string, reason: string, expectedNotice: RegExp): Promise<void> {
  247 |     await page.goto(`/partner/events/${r.e1.id}`);
  248 |     await openTab(page, /^ventes/i);
  249 |     await page.getByLabel(/^numéro du billet/i).fill(ticketNumber);
  250 |     await expectRoute(page, 'GET', /\/tickets\/lookup$/, () => page.getByRole('button', { name: /^rechercher le billet$/i }).click(), 200, `recherche du billet ${ticketNumber}`);
  251 |     await page.getByRole('button', { name: /^rembourser ce billet$/i }).click();
```