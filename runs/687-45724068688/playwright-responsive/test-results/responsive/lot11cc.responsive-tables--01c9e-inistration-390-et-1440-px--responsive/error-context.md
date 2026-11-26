# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lot11cc.responsive.spec.ts >> tables d’un événement · clair : organisatrice, porte, scanner, administration (390 et 1440 px)
- Location: e2e/lot11cc.responsive.spec.ts:207:9

# Error details

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /^Billets$/ })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - banner [ref=e4]:
      - generic [ref=e5]:
        - button "Ouvrir le menu" [ref=e6] [cursor=pointer]
        - link "Event Village, accueil" [ref=e10] [cursor=pointer]:
          - /url: /
      - generic [ref=e13]:
        - button "Notifications, 18 non lues" [ref=e15] [cursor=pointer]:
          - generic [ref=e19]: "18"
        - button "Basculer le thème" [ref=e21] [cursor=pointer]
        - link "Mon profil (Khady Sarr)" [ref=e25] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=e26]: KS
    - main [ref=e28]:
      - generic [ref=e30]:
        - generic [ref=e31]:
          - link "Retour à mes événements" [ref=e33] [cursor=pointer]:
            - /url: /partner/events
          - generic [ref=e39]:
            - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=e41]': Publié
            - heading "Modifier l’événement" [level=1] [ref=e44]
            - paragraph [ref=e45]: Nuit des tables 43021d
        - status [ref=e46]:
          - generic [ref=e51]:
            - paragraph [ref=e52]: "Votre événement est validé : ce que vos modifications changent"
            - list [ref=e54]:
              - listitem [ref=e55]: "Description, programme, informations pratiques et affiche : modifiables à tout moment, personne n’est prévenu."
              - listitem [ref=e56]: "Dates, heures, lieu, ville et adresse : les détenteurs de billets, invités compris, sont prévenus dans l’application et par SMS. Avant d’enregistrer, vous voyez combien recevront un SMS et à quelle heure."
              - listitem [ref=e57]: "Titre : les détenteurs de billets sont prévenus dans l’application."
              - listitem [ref=e58]: Déplacer le repère de plus de 200 m prévient les détenteurs de billets par SMS.
              - listitem [ref=e59]: "Un seul SMS par heure : les changements faits dans l’heure partent ensemble. À moins d’une heure du début, l’avis part tout de suite."
              - listitem [ref=e60]: "Type d’événement : verrouillé dès qu’un billet est vendu, réservé ou offert. Jauge : elle ne peut alors plus être retirée ni descendre sous les billets vendus et en cours de paiement, et jamais sous les places mises en vente, billets et tables compris."
        - navigation "Étapes du formulaire" [ref=e61]:
          - paragraph [ref=e62]: Étape 1 sur 5 — Informations générales
          - list [ref=e63]:
            - listitem [ref=e64]:
              - 'button "Étape 1 : Informations générales" [ref=e65] [cursor=pointer]':
                - generic [aria-hidden] [ref=e66]: "1"
            - listitem [ref=e68]:
              - 'button "Étape 2 : Programme" [ref=e69] [cursor=pointer]':
                - generic [aria-hidden] [ref=e70]: "2"
            - listitem [ref=e72]:
              - 'button "Étape 3 : Accès et informations pratiques" [ref=e73] [cursor=pointer]':
                - generic [aria-hidden] [ref=e74]: "3"
            - listitem [ref=e76]:
              - 'button "Étape 4 : Billetterie" [ref=e77] [cursor=pointer]':
                - generic [aria-hidden] [ref=e78]: "4"
            - listitem [ref=e80]:
              - 'button "Étape 5 : Contrôle à l’entrée (facultatif)" [ref=e81] [cursor=pointer]':
                - generic [aria-hidden] [ref=e82]: "5"
            - listitem [ref=e84]:
              - button "Vérifier avant d’envoyer" [ref=e85] [cursor=pointer]
        - generic [ref=e91]:
          - heading "Informations générales" [level=2] [ref=e92]
          - generic [ref=e93]:
            - generic [ref=e94]:
              - generic [ref=e96]:
                - text: Titre de l’événement*
                - generic [ref=e97]: (obligatoire)
              - textbox "Titre de l’événement (obligatoire)" [ref=e98]:
                - /placeholder: "Par exemple : Nuit du Mbalax"
                - text: Nuit des tables 43021d
              - paragraph [ref=e99]: Les détenteurs de billets seront prévenus de ce changement.
            - generic [ref=e100]:
              - generic [ref=e101]:
                - text: Type d’événement*
                - generic [ref=e102]: (obligatoire)
              - radiogroup "Type d’événement (obligatoire)" [ref=e103]:
                - radio "Concerts & Musique" [checked] [disabled] [ref=e104]
                - radio "Festivals" [disabled] [ref=e108]
                - radio "Gastronomie & Tables" [disabled] [ref=e110]
                - radio "Salles & Réceptions" [disabled] [ref=e112]
              - paragraph [ref=e114]: "Verrouillé : des billets ont déjà été vendus ou réservés."
            - generic [ref=e118]:
              - generic [ref=e119]:
                - generic [ref=e120]: Description
                - generic [ref=e121]: 64 / 5000
              - textbox "Description" [ref=e122]:
                - /placeholder: "Présentez l’événement : artistes, ambiance, public attendu…"
                - text: Captures du lot 11c-c (tables d’un événement). Données fictives.
            - generic [ref=e123]:
              - generic [ref=e124]: Affiche de l’événement
              - button "Affiche de l’événement" [ref=e125]
              - generic [ref=e126]:
                - 'img "Aperçu : Affiche de l’événement" [ref=e127]'
                - generic [ref=e128]:
                  - generic [ref=e129]: Aperçu sur les cartes du site
                  - generic [ref=e130]:
                    - generic [ref=e131] [cursor=pointer]: Remplacer l’image
                    - button "Supprimer l’image sélectionnée" [ref=e137] [cursor=pointer]
              - paragraph [ref=e142]: "Format conseillé : paysage, 1 600 × 1 000 pixels (proportion des cartes du site), recadré au centre. JPEG, PNG ou WebP, 5 Mo au plus. Obligatoire pour soumettre l’événement à la validation."
            - group "Dates et horaires (heure de Dakar)" [ref=e143]:
              - generic [ref=e145]:
                - generic [ref=e146]:
                  - generic [ref=e148]:
                    - text: Date de début*
                    - generic [ref=e149]: (obligatoire)
                  - textbox "Date de début (obligatoire)" [ref=e150]: 2026-11-26
                  - paragraph [ref=e151]: Les détenteurs de billets seront prévenus de ce changement.
                - generic [ref=e152]:
                  - generic [ref=e154]:
                    - text: Heure de début*
                    - generic [ref=e155]: (obligatoire)
                  - textbox "Heure de début (obligatoire)" [ref=e156]: 00:52
                  - paragraph [ref=e157]: Les détenteurs de billets seront prévenus de ce changement.
                - generic [ref=e158]:
                  - generic [ref=e159]: Date de fin
                  - textbox "Date de fin" [ref=e161]: 2026-11-26
                  - paragraph [ref=e162]: Facultative. Pour une soirée qui passe minuit, indiquez la date du lendemain. Les détenteurs de billets seront prévenus de ce changement.
                - generic [ref=e163]:
                  - generic [ref=e164]: Heure de fin
                  - textbox "Heure de fin" [ref=e166]: 04:52
                  - paragraph [ref=e167]: Facultative ; avec une heure de fin, la date de fin est demandée. Les détenteurs de billets seront prévenus de ce changement.
            - generic [ref=e168]:
              - generic [ref=e169]:
                - generic [ref=e171]:
                  - text: Lieu*
                  - generic [ref=e172]: (obligatoire)
                - textbox "Lieu (obligatoire)" [ref=e173]:
                  - /placeholder: "Par exemple : Grand Théâtre National"
                  - text: Terrasse de la Corniche
                - paragraph [ref=e174]: Les détenteurs de billets seront prévenus de ce changement.
              - generic [ref=e175]:
                - generic [ref=e177]:
                  - text: Ville*
                  - generic [ref=e178]: (obligatoire)
                - combobox "Ville (obligatoire)" [ref=e180] [cursor=pointer]:
                  - option "Cap Skirring"
                  - option "Dakar" [selected]
                  - option "Diamniadio"
                  - option "Diourbel"
                  - option "Fatick"
                  - option "Guédiawaye"
                  - option "Joal-Fadiouth"
                  - option "Kaffrine"
                  - option "Kaolack"
                  - option "Kédougou"
                  - option "Kolda"
                  - option "Louga"
                  - option "Matam"
                  - option "Mbacké"
                  - option "Mbour"
                  - option "Pikine"
                  - option "Richard-Toll"
                  - option "Rufisque"
                  - option "Saint-Louis"
                  - option "Saly"
                  - option "Sédhiou"
                  - option "Tambacounda"
                  - option "Thiès"
                  - option "Tivaouane"
                  - option "Touba"
                  - option "Ziguinchor"
                  - option "Autre ville"
                - paragraph [ref=e181]: Les détenteurs de billets seront prévenus de ce changement.
            - generic [ref=e182]:
              - generic [ref=e183]: Capacité totale (jauge)
              - spinbutton "Capacité totale (jauge)" [ref=e189]: "200"
              - paragraph [ref=e190]: "Des billets sont vendus ou réservés : la jauge ne peut plus être retirée ni descendre sous 152 places."
          - generic [ref=e191]:
            - button "Précédent" [disabled] [ref=e192]
            - generic [ref=e197]:
              - button "Suivant" [ref=e198] [cursor=pointer]
              - button "Enregistrer les modifications" [ref=e203] [cursor=pointer]
  - alert [ref=e210]
```

# Test source

```ts
  120 |     const service = serviceClient();
  121 |     const start = new Date(Date.now() + 60 * 60_000);
  122 |     const end = new Date(start.getTime() + 4 * 3600_000);
  123 |     const s = dakar(start);
  124 |     const e = dakar(end);
  125 |     const title = `Nuit des tables ${STAMP}`;
  126 |     const eventId = await createPublishedEvent({
  127 |         partnerUserId: owner.userId, superadminId: superadmin, title,
  128 |         description: 'Captures du lot 11c-c (tables d’un événement). Données fictives.',
  129 |         startDate: s.date, startTime: s.time, endDate: e.date, endTime: e.time,
  130 |         location: 'Terrasse de la Corniche', city: 'Dakar', capacity: 200,
  131 |         imageUrl: await partnerPosterOf(owner.userId),
  132 |         categories: [{ name: 'Entrée', price: 5_000, total: 80 }],
  133 |     });
  134 |     const vip = await rpcOk('event_table_type_save', {
  135 |         event_id: eventId, actor_id: owner.userId, count: 4,
  136 |         type: { name: 'Carré VIP', seats: 6, price: 150_000, included_text: 'Une bouteille et un plateau de fruits', onsite_note: '50 000 F de consommations sur place', payment_mode: 'FULL' },
  137 |     });
  138 |     const ronde = await rpcOk('event_table_type_save', {
  139 |         event_id: eventId, actor_id: owner.userId, count: 6,
  140 |         type: { name: 'Table ronde', seats: 8, price: 120_000, included_text: 'Softs à volonté', payment_mode: 'FULL' },
  141 |     });
  142 |     const vipId = String((vip.type as Record<string, unknown>).id);
  143 |     const rondeId = String((ronde.type as Record<string, unknown>).id);
  144 |     const { data: rows, error } = await service.from('event_tables').select('id, number, category_id').eq('event_id', eventId).order('number');
  145 |     if (error || !rows) throw new Error(`[l11cc] tables de l'événement : ${error?.message}`);
  146 |     // Carré VIP en 2 × 2 en haut à gauche, tables rondes en deux rangées en bas
  147 |     const vipPos = [[17.5, 22.5], [32.5, 22.5], [17.5, 37.5], [32.5, 37.5]];
  148 |     const rondePos = [[52.5, 62.5], [67.5, 62.5], [82.5, 62.5], [52.5, 80], [67.5, 80], [82.5, 80]];
  149 |     let iv = 0;
  150 |     let ir = 0;
  151 |     const tables = rows.map((t) => {
  152 |         const p = t.category_id === vipId ? vipPos[iv++] : rondePos[ir++];
  153 |         return { id: t.id, type_id: t.category_id, number: t.number, zone_id: null, x: p[0], y: p[1], shape: t.category_id === vipId ? 'CARREE' : 'RONDE', rotation: 0 };
  154 |     });
  155 |     await rpcOk('event_tables_save', { event_id: eventId, actor_id: owner.userId, plan_enabled: true, tables, zones: [] });
  156 | 
  157 |     const vipTables = rows.filter((t) => t.category_id === vipId);
  158 |     const rondeTables = rows.filter((t) => t.category_id === rondeId);
  159 |     const awa = await createClientAccount(`l11cc-a-${STAMP}`);
  160 |     const fatou = await createClientAccount(`l11cc-b-${STAMP}`);
  161 |     const moussa = await createClientAccount(`l11cc-c-${STAMP}`);
  162 |     const guest = await createClientAccount(`l11cc-g-${STAMP}`);
  163 |     const bookingA = await buyTable(eventId, awa, vipId, String(vipTables[2].id), true);
  164 |     await buyTable(eventId, fatou, rondeId, String(rondeTables[0].id), true);
  165 |     await buyTable(eventId, moussa, rondeId, String(rondeTables[1].id), false);
  166 | 
  167 |     const { data: seats, error: sErr } = await service.from('tickets').select('id, ticket_number').eq('event_table_booking_id', bookingA!).order('ticket_number');
  168 |     if (sErr || !seats || seats.length !== 6) throw new Error(`[l11cc] places de la table : ${sErr?.message ?? seats?.length}`);
  169 |     const transfer = await rpcOk('ticket_transfer_initiate', { ticket_id: seats[0].id, actor_id: awa.userId, recipient: guest.phone, expires_at: new Date(Date.now() + 48 * 3600_000).toISOString() });
  170 |     await rpcOk('ticket_transfer_accept', { transfer_id: transfer.transfer_id, actor_id: guest.userId });
  171 | 
  172 |     const controller = await createControllerAccount(`l11cc-${STAMP}`);
  173 |     const { error: aErr } = await service.from('event_controllers').upsert(
  174 |         { event_id: eventId, user_id: controller.userId, can_accept_cash: false, created_by: owner.userId, entry_point: 'Entrée principale' },
  175 |         { onConflict: 'event_id,user_id' });
  176 |     if (aErr) throw new Error(`[l11cc] affectation du contrôleur : ${aErr.message}`);
  177 |     // La place envoyée (seats[0]) est réémise au nom de l’invitée : les entrées portent sur deux places restées au titulaire
  178 |     for (const seat of seats.slice(1, 3)) {
  179 |         const number = String(seat.ticket_number);
  180 |         const { data, error: scanErr } = await service.rpc('ticket_scan', { p: {
  181 |             scanner_id: controller.userId, event_id: eventId, method: 'MANUAL', ticket_number: number, identity_verified: true,
  182 |             payload_hash: createHash('sha256').update(number.toUpperCase()).digest('hex'), client_key: `l11cc-${randomUUID()}`,
  183 |         } });
  184 |         if (scanErr || (data as { result?: string } | null)?.result !== 'valid') throw new Error(`[l11cc] entrée de la place ${number} : ${scanErr?.message ?? JSON.stringify(data)}`);
  185 |     }
  186 |     return { eventId, title, controller, seatNumber: String(seats[3].ticket_number) };
  187 | }
  188 | 
  189 | let seeded: Seeded | null = null;
  190 | let superadmin = '';
  191 | let previous: boolean | null = null;
  192 | 
  193 | test.beforeAll(async () => {
  194 |     test.setTimeout(240_000);
  195 |     superadmin = await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email);
  196 |     const { data } = await serviceClient().from('platform_settings').select('value').eq('key', 'features.event_tables_enabled').maybeSingle();
  197 |     previous = (data?.value as { value?: boolean } | null)?.value === true;
  198 |     await setTablesService(true, superadmin);
  199 |     seeded = await seed(superadmin);
  200 | });
  201 | 
  202 | test.afterAll(async () => {
  203 |     if (superadmin) await setTablesService(previous === true, superadmin);
  204 | });
  205 | 
  206 | for (const theme of THEMES) {
  207 |     test(`tables d’un événement · ${theme.key} : organisatrice, porte, scanner, administration (390 et 1440 px)`, async ({ browser }, testInfo) => {
  208 |         test.setTimeout(600_000);
  209 |         const data = seeded!;
  210 |         const owner = readDemoIds().accounts.organisateur3;
  211 | 
  212 |         // ── Organisatrice : éditeur, plan, jauge, vue client, type figé, pilotage, porte ───────────────────────────
  213 |         const org = await themedContext(browser, testInfo, theme.scheme);
  214 |         await login(org, owner.email);
  215 |         const page = await org.newPage();
  216 |         for (const w of WIDTHS) {
  217 |             await page.setViewportSize({ width: w.width, height: w.height });
  218 |             await page.goto(`/partner/events/${data.eventId}/edit`, { waitUntil: 'load' });
  219 |             await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
> 220 |             await page.getByRole('button', { name: /^Billets$/ }).click();
      |                                                                   ^ TimeoutError: locator.click: Timeout 15000ms exceeded.
  221 |             await page.getByRole('tab', { name: 'Tables' }).click();
  222 |             const editor = page.locator('[data-tables-editeur]');
  223 |             await expect(editor).toBeVisible({ timeout: 30_000 });
  224 |             // 80 billets + 4 tables de 6 + 6 tables de 8 = 152 places sur 200 (réponse du serveur)
  225 |             await expect(editor.getByText('152 places sur 200 : 80 en billets, 72 en tables')).toBeVisible();
  226 |             await expect(editor.getByText('Prix et places figés : une table est vendue ou en cours de paiement.').first()).toBeVisible();
  227 |             await settle(page);
  228 |             await checkLayout(page, w.width, w.phone, 'éditeur des tables');
  229 |             await shot(page, 'editeur', w.width, theme.key);
  230 |             await editor.locator('[data-jauge-places]').screenshot({ path: path.join(SHOTS, `l11cc-jauge__${w.width}__${theme.key}.jpg`), type: 'jpeg', quality: 85 });
  231 |             // Plan en édition : une table choisie (panneau de réglage)
  232 |             const table1 = page.getByRole('button', { name: /^Table 1, 6 places/ });
  233 |             if (await table1.count() > 0) await table1.first().click();
  234 |             await settle(page);
  235 |             await shot(page, 'plan-edition', w.width, theme.key);
  236 |             await page.getByRole('button', { name: w.phone ? 'Téléphone' : 'Ordinateur' }).click();
  237 |             await expect(page.locator(`[data-vue-client="${w.phone ? 'telephone' : 'ordinateur'}"]`)).toBeVisible();
  238 |             await settle(page);
  239 |             await shot(page, 'vue-client', w.width, theme.key);
  240 |             // Type figé : prix et places verrouillés, avec la raison
  241 |             await editor.locator('[data-type-table="Carré VIP"]').getByRole('button', { name: 'Modifier' }).click();
  242 |             const dialog = page.getByRole('dialog', { name: 'Modifier le type de table' });
  243 |             await expect(dialog).toBeVisible();
  244 |             await expect(dialog.getByLabel('Prix de la table (F CFA)')).toBeDisabled();
  245 |             await expect(dialog.getByText(/^Soit 25\s000 F.* par personne\.$/)).toBeVisible();
  246 |             await settle(page);
  247 |             await shot(page, 'type-fige', w.width, theme.key, false);
  248 |             await page.keyboard.press('Escape');
  249 | 
  250 |             await page.goto(`/partner/events/${data.eventId}?tab=tables`, { waitUntil: 'load' });
  251 |             const pil = page.locator('[data-tables-pilotage]');
  252 |             await expect(pil).toBeVisible({ timeout: 30_000 });
  253 |             await expect(pil.getByText('Awa S.').first()).toBeVisible();
  254 |             await settle(page);
  255 |             await checkLayout(page, w.width, w.phone, 'pilotage des tables');
  256 |             await shot(page, 'pilotage', w.width, theme.key);
  257 | 
  258 |             await page.goto(`/partner/events/${data.eventId}/porte`, { waitUntil: 'load' });
  259 |             const door = page.locator('[data-porte]');
  260 |             await expect(door).toBeVisible({ timeout: 30_000 });
  261 |             await expect(door.getByText('2/6').first()).toBeVisible();
  262 |             await settle(page);
  263 |             await checkLayout(page, w.width, w.phone, 'liste de la porte');
  264 |             await shot(page, 'porte', w.width, theme.key);
  265 |             await door.locator('[data-porte-table] button').first().click();
  266 |             await expect(door.getByText('Awa S.').first()).toBeVisible();
  267 |             await settle(page);
  268 |             await shot(page, 'porte-table-ouverte', w.width, theme.key);
  269 |             await page.getByRole('button', { name: 'Plein écran' }).click();
  270 |             await expect(door).toHaveAttribute('data-porte-contraste', 'fort');
  271 |             await settle(page);
  272 |             await shot(page, 'porte-plein-ecran', w.width, theme.key, false);
  273 |             await page.getByRole('button', { name: 'Quitter le plein écran' }).click();
  274 |             await page.emulateMedia({ media: 'print' });
  275 |             await settle(page);
  276 |             await shot(page, 'porte-impression', w.width, theme.key);
  277 |             await page.emulateMedia({ media: 'screen' });
  278 |         }
  279 |         await org.close();
  280 | 
  281 |         // ── Contrôleur : porte, badge du scanner (réponse du scan imposée, caméra simulée) ───────────────────────────
  282 |         const ctl = await themedContext(browser, testInfo, theme.scheme);
  283 |         await login(ctl, data.controller.email);
  284 |         await ctl.addInitScript(installFakeCamera, { mode: 'barcode-detector' as const });
  285 |         const cpage = await ctl.newPage();
  286 |         for (const w of WIDTHS) {
  287 |             await cpage.setViewportSize({ width: w.width, height: w.height });
  288 |             await cpage.goto(`/controller/porte/${data.eventId}`, { waitUntil: 'load' });
  289 |             await expect(cpage.locator('[data-porte]')).toBeVisible({ timeout: 30_000 });
  290 |             await settle(cpage);
  291 |             await checkLayout(cpage, w.width, w.phone, 'liste de la porte du contrôleur');
  292 |             await shot(cpage, 'porte-controleur', w.width, theme.key);
  293 | 
  294 |             await cpage.route(/\/api\/controller\/scan$/, async (route) => {
  295 |                 if (route.request().method() !== 'POST') return route.continue();
  296 |                 await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
  297 |                     result: 'valid', replayed: false, message: 'Entrée validée',
  298 |                     ticket: { ticket_number: data.seatNumber, category: 'Carré VIP', holder: 'Awa Sarr', is_manual_entry: false },
  299 |                     table: { label: 'Table 3 · Carré VIP', table_number: 3, entered: 3, seats: 6 },
  300 |                 }) });
  301 |             });
  302 |             await cpage.goto('/controller/scanner', { waitUntil: 'load' });
  303 |             await expect(cpage.getByRole('heading', { name: /^commencer le contr[ôo]le$/i })).toBeVisible({ timeout: 30_000 });
  304 |             await cpage.getByRole('button', { name: /^commencer le contr[ôo]le$/i }).click();
  305 |             await cpage.waitForFunction(() => Array.from(document.querySelectorAll('video')).some((v) => v.readyState >= 2), null, { timeout: 30_000 });
  306 |             await expect(cpage.getByRole('link', { name: 'Liste des tables' })).toHaveAttribute('href', `/controller/porte/${data.eventId}`);
  307 |             await cpage.evaluate((p) => {
  308 |                 const cam = (window as unknown as { __evFakeCamera?: { setPayload: (x: string) => void } }).__evFakeCamera;
  309 |                 if (!cam) throw new Error('caméra simulée absente');
  310 |                 cam.setPayload(p);
  311 |             }, `EVT1:00000000-0000-4000-8000-000000000971:482913`);
  312 |             const overlay = cpage.locator('[data-scan-state="result"][data-scan-result="valid"]');
  313 |             await expect(overlay).toBeVisible({ timeout: 20_000 });
  314 |             await expect(overlay.locator('[data-scan-table]')).toContainText('Table 3 · Carré VIP');
  315 |             await expect(overlay.locator('[data-scan-table]')).toContainText('3/6 entrés');
  316 |             await cpage.waitForTimeout(250);
  317 |             await shot(cpage, 'scanner-badge', w.width, theme.key, false);
  318 |             await cpage.unroute(/\/api\/controller\/scan$/);
  319 |         }
  320 |         await ctl.close();
```