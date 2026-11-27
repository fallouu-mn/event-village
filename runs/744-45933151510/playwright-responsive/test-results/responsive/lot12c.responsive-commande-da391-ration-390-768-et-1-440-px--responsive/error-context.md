# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lot12c.responsive.spec.ts >> commandes · clair : catalogue, réglages, zones, commandes, code, livreurs, administration (390, 768 et 1 440 px)
- Location: e2e/lot12c.responsive.spec.ts:204:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('dialog', { name: 'Mode comptoir' })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('dialog', { name: 'Mode comptoir' }) with timeout 10000ms
  - waiting for getByRole('dialog', { name: 'Mode comptoir' })

```

```yaml
- banner:
  - button "Ouvrir le menu"
  - link "Event Village, accueil":
    - /url: /
  - button "Notifications, 28 non lues": "28"
  - button "Basculer le thème"
  - link "Mon profil (Ousmane Faye)":
    - /url: /profile
- main:
  - heading "Commandes" [level=1]
  - paragraph: "Gardez cette page ouverte : chaque nouvelle commande sonne et s’affiche ici, mise à jour toutes les 5 secondes."
  - button "Couper le son des nouvelles commandes"
  - button "Mode comptoir"
  - link "Livreurs":
    - /url: /partner/orders/livreurs
  - status: Mis à jour à 03:22 · son activé
  - region "Ma journée":
    - heading "Ma journée" [level=2]
    - paragraph: Commandes reçues aujourd’hui
    - paragraph: "8"
    - paragraph: 6 en cours
    - paragraph: À accepter
    - paragraph: "2"
    - paragraph: Répondez avant la fin du délai
    - paragraph: Recette du jour
    - paragraph: 5 000 F CFA
    - paragraph: 2 remises · en ligne 0 F CFA · sur place 5 000 F CFA
    - paragraph: Bientôt épuisés
    - list:
      - listitem: Thiakry 3 unités
    - paragraph: Plats du jour en vente
    - list:
      - listitem:
        - text: Thiéboudienne du jour 50 restantes
        - button "Plus de Thiéboudienne du jour"
  - tablist "Commandes en cours ou terminées":
    - tab "En cours , 6" [selected]
    - tab "Terminées"
  - tabpanel "En cours , 6":
    - tablist "Étapes des commandes":
      - tab "Reçues , 3" [selected]
      - tab "En préparation , 1"
      - tab "Prêtes , 1"
      - tab "En route , 1"
    - tabpanel "Reçues , 3":
      - article "Commande 5F1EC4":
        - heading "Commande 5F1EC4" [level=3]
        - paragraph: Retrait sur place
        - text: Reçue 15 minutes
        - paragraph:
          - status: Délai pour accepter
        - list:
          - listitem: 2 × Yassa poulet
          - listitem: 2 × Bissap maison
        - paragraph: 9 000 F CFA
        - paragraph: "À encaisser : 9 000 F CFA"
        - button "Accepter"
        - link "Ouvrir la commande CMD-261127-5F1EC4":
          - /url: /partner/orders/19ef8cc3-9c7b-442e-8fc5-f2ff28ac8b55
          - text: Voir ou refuser
      - article "Commande 82B2D7":
        - heading "Commande 82B2D7" [level=3]
        - paragraph: Sur place · Terrasse 4
        - text: Reçue
        - paragraph: Pour 06:30
        - text: 15 minutes
        - paragraph:
          - status: Délai pour accepter
        - list:
          - listitem: 1 × Thiakry
          - listitem: 3 × Yassa poulet
        - paragraph: 12 000 F CFA
        - paragraph: "À encaisser : 12 000 F CFA"
        - button "Accepter"
        - link "Ouvrir la commande CMD-261127-82B2D7":
          - /url: /partner/orders/e5d1d5f5-ac43-464c-9012-5c5d34cbcc2c
          - text: Voir ou refuser
      - article "Commande C61516":
        - heading "Commande C61516" [level=3]
        - paragraph: Sur place · Table 7
        - text: Acceptée
        - list:
          - listitem: 1 × Bissap maison
          - listitem: 1 × Yassa poulet
        - paragraph: 4 500 F CFA
        - paragraph: "À encaisser : 4 500 F CFA"
        - button "Commencer la préparation"
        - link "Ouvrir la commande CMD-261127-C61516":
          - /url: /partner/orders/81f23f38-f740-401f-be90-0b0469a44c0c
          - text: Ouvrir
- navigation "Navigation rapide":
  - link "Accueil":
    - /url: /partner/dashboard
  - link "Billetterie":
    - /url: /partner/events
  - link "Scanner":
    - /url: /partner/scan
  - link "Finances":
    - /url: /partner/finance
  - link "Profil":
    - /url: /partner/profile
- alert
```

# Test source

```ts
  145 |         const r = await rpcOk('order_product_save', { actor_id: owner.userId, product_id: null, fields: { venue_id: venueId, ...fields } });
  146 |         return String((r.product as Record<string, unknown>).id);
  147 |     };
  148 |     const thieb = await save({ name: 'Thiéboudienne du jour', description: 'Riz au poisson, légumes du marché, sauce tomate.', price: 4_500, category_id: cat('Plats'), is_daily_special: true });
  149 |     const yassa = await save({ name: 'Yassa poulet', description: 'Poulet mariné au citron et aux oignons, riz blanc.', price: 3_500, category_id: cat('Plats') });
  150 |     const bissap = await save({ name: 'Bissap maison', description: 'Fleurs d’hibiscus, menthe fraîche.', price: 1_000, category_id: cat('Boissons') });
  151 |     const thiakry = await save({ name: 'Thiakry', description: 'Couscous de mil au lait caillé.', price: 1_500, category_id: cat('Desserts'), is_stock_managed: true, stock_quantity: 4 });
  152 |     await save({ name: 'Whisky 12 ans', price: 15_000, category_id: cat('Boissons'), is_regulated: true, regulated_kind: 'ALCOOL' });
  153 |     const biere = await save({ name: 'Bière Gazelle 65 cl', description: 'Bière blonde locale, servie fraîche.', price: 1_500, category_id: cat('Boissons') });
  154 |     // Contre-vérification du lot 12c (point 8) : un produit vendu puis archivé, pour « Remettre en vente »
  155 |     const pastels = await save({ name: 'Pastels au thon', description: 'Six chaussons frits, sauce tomate pimentée.', price: 2_000, category_id: cat('Plats') });
  156 |     await rpcOk('product_option_set', { actor_id: owner.userId, product_id: yassa, name: 'Frites', price: 500 });
  157 |     await rpcOk('product_option_set', { actor_id: owner.userId, product_id: yassa, name: 'Sauce piment', price: 0 });
  158 |     await rpcOk('order_daily_portions_set', { actor_id: owner.userId, product_id: thieb, portions: 50 });
  159 | 
  160 |     // Livreurs : un actif, une invitation en attente
  161 |     const courier = await createClientAccount(`l12c-livreur-${STAMP}`);
  162 |     const pending = await createClientAccount(`l12c-invite-${STAMP}`);
  163 |     const inv = await rpcOk('order_courier_invite', { actor_id: owner.userId, phone: courier.phone });
  164 |     await rpcOk('order_courier_respond', { actor_id: courier.userId, invitation_id: inv.invitation_id, accept: true });
  165 |     await rpcOk('order_courier_invite', { actor_id: owner.userId, phone: pending.phone });
  166 | 
  167 |     // Commandes payables à la remise (au plus 3 non payées par client : trois clientes)
  168 |     const clients: ControllerAccount[] = [];
  169 |     for (const k of ['a', 'b', 'c', 'd']) clients.push(await createClientAccount(`l12c-${k}-${STAMP}`));
  170 |     const place = async (client: ControllerAccount, body: Record<string, unknown>): Promise<{ id: string; number: string }> => {
  171 |         const r = await rpcOk('order_create', { client_id: client.userId, venue_id: venueId, payment: 'DIFFERE', ...body });
  172 |         return { id: String(r.order_id), number: String(r.order_number) };
  173 |     };
  174 |     const act = async (orderId: string, ...actions: Array<Record<string, unknown>>): Promise<void> => {
  175 |         for (const a of actions) await rpcOk('order_partner_action', { order_id: orderId, actor_id: owner.userId, ...a });
  176 |     };
  177 |     const line = (productId: string, quantity: number, extra: Record<string, unknown> = {}) => ({ product_id: productId, quantity, option_ids: [], ...extra });
  178 |     const recue = await place(clients[0], { mode: 'RETRAIT', items: [line(yassa, 2, { notes: 'Sans oignons' }), line(bissap, 2)], phone: clients[0].local });
  179 |     await place(clients[0], { mode: 'SUR_PLACE', onsite_label: 'Terrasse 4', scheduled_for: laterSlot(3), items: [line(yassa, 3), line(thiakry, 1)] });
  180 |     const acceptee = await place(clients[1], { mode: 'SUR_PLACE', onsite_label: 'Table 7', items: [line(yassa, 1), line(bissap, 1)] });
  181 |     await act(acceptee.id, { action: 'ACCEPTER', minutes: 25 });
  182 |     const prep = await place(clients[1], { mode: 'RETRAIT', items: [line(bissap, 4)], phone: clients[1].local });
  183 |     await act(prep.id, { action: 'ACCEPTER' }, { action: 'PREPARER' });
  184 |     const prete = await place(clients[1], { mode: 'RETRAIT', items: [line(yassa, 2)], phone: clients[1].local });
  185 |     await act(prete.id, { action: 'ACCEPTER' }, { action: 'PRETE' });
  186 |     const route = await place(clients[2], { mode: 'LIVRAISON', zone_id: zoneId, address: 'Villa 12, route des Almadies, près de la pharmacie', phone: clients[2].local, items: [line(yassa, 2), line(bissap, 2)] });
  187 |     await act(route.id, { action: 'ACCEPTER' }, { action: 'PRETE' }, { action: 'EN_ROUTE', minutes: 20 });
  188 |     const remise = await place(clients[2], { mode: 'SUR_PLACE', onsite_label: 'Comptoir', items: [line(bissap, 3)] });
  189 |     await act(remise.id, { action: 'ACCEPTER' }, { action: 'PRETE' }, { action: 'REMETTRE', balance_received: true });
  190 |     const vendu = await place(clients[3], { mode: 'SUR_PLACE', onsite_label: 'Table 2', items: [line(pastels, 1)] });
  191 |     await act(vendu.id, { action: 'ACCEPTER' }, { action: 'PRETE' }, { action: 'REMETTRE', balance_received: true });
  192 |     const removed = await rpcOk('order_product_remove', { actor_id: owner.userId, product_id: pastels });
  193 |     if (removed.outcome !== 'ARCHIVED') throw new Error(`[l12c] produit vendu non archivé : ${JSON.stringify(removed)}`);
  194 | 
  195 |     return { venueId, venueName, products: { yassa, biere }, orders: { recue, prete } };
  196 | }
  197 | 
  198 | let seeded: Seeded | null = null;
  199 | let superadmin = '';
  200 | 
  201 | test.beforeEach(async ({ servicesLock }) => { await servicesLock.enter('services'); });
  202 | 
  203 | for (const theme of THEMES) {
  204 |     test(`commandes · ${theme.key} : catalogue, réglages, zones, commandes, code, livreurs, administration (390, 768 et 1 440 px)`, async ({ browser }, testInfo) => {
  205 |         test.setTimeout(900_000);
  206 |         superadmin ||= await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email);
  207 |         const { data: flag } = await serviceClient().from('platform_settings').select('value').eq('key', 'features.orders_enabled').maybeSingle();
  208 |         const previous = (flag?.value as { value?: boolean } | null)?.value === true;
  209 |         await setOrdersService(true, superadmin);
  210 |         try {
  211 |             seeded ??= await seed(superadmin);
  212 |             const data = seeded;
  213 |             const owner = readDemoIds().accounts.organisateur2;
  214 | 
  215 |             const org = await themedContext(browser, testInfo, theme.scheme, partnerSession ?? undefined);
  216 |             if (!partnerSession) {
  217 |                 await login(org, owner.email);
  218 |                 // Session seulement : le thème est posé par chaque contexte (cookie et stockage), jamais repris d'un autre
  219 |                 const state = await org.storageState();
  220 |                 partnerSession = {
  221 |                     cookies: state.cookies.filter((c) => c.name !== 'ev-theme'),
  222 |                     origins: state.origins.map((o) => ({ ...o, localStorage: o.localStorage.filter((l) => l.name !== 'ev-theme') })),
  223 |                 };
  224 |             }
  225 |             const page = await org.newPage();
  226 |             for (const w of WIDTHS) {
  227 |                 await page.setViewportSize({ width: w.width, height: w.height });
  228 | 
  229 |                 // Commandes : colonnes (tablette, ordinateur) ou onglets (téléphone)
  230 |                 await page.goto('/partner/orders', { waitUntil: 'load' });
  231 |                 await title(page, 'Commandes');
  232 |                 await expect(page.locator(`[aria-label="Ouvrir la commande ${data.orders.recue.number}"] >> visible=true`).first(), 'commande reçue au tableau').toBeVisible({ timeout: 30_000 });
  233 |                 await settle(page);
  234 |                 await checkLayout(page, w.width, w.phone, 'commandes');
  235 |                 // Contre-vérification du lot 12c (point 9) : numéro de commande sur une seule ligne, à toutes les largeurs
  236 |                 const wrapped = await page.locator('article h3 >> visible=true').evaluateAll((els) => els
  237 |                     .filter((el) => el.getBoundingClientRect().height > parseFloat(getComputedStyle(el).lineHeight) * 1.5)
  238 |                     .map((el) => el.textContent ?? ''));
  239 |                 expect(wrapped, `numéros de commande sur deux lignes (${w.width} px)`).toEqual([]);
  240 |                 await shot(page, 'commandes', w.width, theme.key);
  241 | 
  242 |                 // Contre-vérification du lot 12c (point 10) : mode comptoir, plein écran sans menu, sortie en un geste
  243 |                 await page.getByRole('button', { name: 'Mode comptoir' }).click();
  244 |                 const counter = page.getByRole('dialog', { name: 'Mode comptoir' });
> 245 |                 await expect(counter).toBeVisible({ timeout: 10_000 });
      |                                       ^ Error: expect(locator).toBeVisible() failed
  246 |                 await expect(counter.getByRole('button', { name: 'Quitter le mode comptoir' })).toBeVisible();
  247 |                 await expect(counter.locator(`[aria-label="Ouvrir la commande ${data.orders.recue.number}"] >> visible=true`).first()).toBeVisible({ timeout: 30_000 });
  248 |                 await settle(page);
  249 |                 await checkLayout(page, w.width, w.phone, 'mode comptoir');
  250 |                 await shot(page, 'comptoir', w.width, theme.key, false);
  251 |                 await counter.getByRole('button', { name: 'Quitter le mode comptoir' }).click();
  252 |                 await expect(counter).toBeHidden({ timeout: 10_000 });
  253 | 
  254 |                 // Fiche d'une commande reçue : compte à rebours et « Accepter »
  255 |                 await page.goto(`/partner/orders/${data.orders.recue.id}`, { waitUntil: 'load' });
  256 |                 await title(page, /^Commande /);
  257 |                 await expect(page.getByRole('button', { name: /^Accepter/ }).first()).toBeVisible({ timeout: 30_000 });
  258 |                 await settle(page);
  259 |                 await checkLayout(page, w.width, w.phone, 'fiche d’une commande reçue');
  260 |                 await shot(page, 'commande-recue', w.width, theme.key);
  261 | 
  262 |                 // Saisie du code de remise : retrait prêt, reste à payer
  263 |                 await page.goto(`/partner/orders/${data.orders.prete.id}`, { waitUntil: 'load' });
  264 |                 await title(page, /^Commande /);
  265 |                 const codeGroup = page.getByRole('group', { name: 'Code de remise à 4 chiffres' });
  266 |                 await expect(codeGroup).toBeVisible({ timeout: 30_000 });
  267 |                 await codeGroup.scrollIntoViewIfNeeded();
  268 |                 await settle(page);
  269 |                 await checkLayout(page, w.width, w.phone, 'saisie du code de remise');
  270 |                 await shot(page, 'saisie-code', w.width, theme.key);
  271 | 
  272 |                 await page.goto('/partner/orders/livreurs', { waitUntil: 'load' });
  273 |                 await title(page, 'Livreurs');
  274 |                 await settle(page);
  275 |                 await checkLayout(page, w.width, w.phone, 'livreurs');
  276 |                 await shot(page, 'livreurs', w.width, theme.key);
  277 | 
  278 |                 // Catalogue, produit, produit en vérification, nouveau produit
  279 |                 await page.goto(`/partner/products?etablissement=${data.venueId}`, { waitUntil: 'load' });
  280 |                 await title(page, 'Ma carte');
  281 |                 await expect(page.getByText('Yassa poulet', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
  282 |                 await expect(page.getByRole('heading', { name: /^Produits archivés/ })).toBeVisible();
  283 |                 await expect(page.getByRole('button', { name: 'Remettre en vente' }).first()).toBeVisible();
  284 |                 await settle(page);
  285 |                 await checkLayout(page, w.width, w.phone, 'catalogue');
  286 |                 await shot(page, 'catalogue', w.width, theme.key);
  287 | 
  288 |                 await page.goto(`/partner/products/${data.products.yassa}`, { waitUntil: 'load' });
  289 |                 await title(page, 'Yassa poulet');
  290 |                 await settle(page);
  291 |                 await checkLayout(page, w.width, w.phone, 'fiche d’un produit');
  292 |                 await shot(page, 'produit', w.width, theme.key);
  293 | 
  294 |                 await page.goto(`/partner/products/${data.products.biere}`, { waitUntil: 'load' });
  295 |                 await title(page, 'Bière Gazelle 65 cl');
  296 |                 await expect(page.getByText('En vérification par Event Village').first()).toBeVisible({ timeout: 30_000 });
  297 |                 await settle(page);
  298 |                 await checkLayout(page, w.width, w.phone, 'produit en vérification');
  299 |                 await shot(page, 'produit-verification', w.width, theme.key);
  300 | 
  301 |                 await page.goto(`/partner/products/new?etablissement=${data.venueId}`, { waitUntil: 'load' });
  302 |                 await title(page, 'Nouveau produit');
  303 |                 await settle(page);
  304 |                 await checkLayout(page, w.width, w.phone, 'nouveau produit');
  305 |                 await shot(page, 'nouveau-produit', w.width, theme.key);
  306 | 
  307 |                 // Réglages de vente et zones de livraison
  308 |                 await page.goto(`/partner/products/vente?etablissement=${data.venueId}`, { waitUntil: 'load' });
  309 |                 await title(page, 'Réglages de vente');
  310 |                 const zones = page.getByRole('heading', { name: /^zones de livraison/i }).first();
  311 |                 await expect(zones).toBeVisible({ timeout: 30_000 });
  312 |                 await expect(page.getByText('Almadies', { exact: true }).first()).toBeVisible();
  313 |                 await settle(page);
  314 |                 await checkLayout(page, w.width, w.phone, 'réglages de vente');
  315 |                 await shot(page, 'reglages', w.width, theme.key);
  316 |                 await zones.scrollIntoViewIfNeeded();
  317 |                 await settle(page);
  318 |                 await shot(page, 'zones', w.width, theme.key, false);
  319 | 
  320 |                 // Tableau de bord : carte des commandes lue par les routes serveur
  321 |                 await page.goto('/partner/dashboard', { waitUntil: 'load' });
  322 |                 await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
  323 |                 await settle(page);
  324 |                 await checkLayout(page, w.width, w.phone, 'tableau de bord');
  325 |                 await shot(page, 'tableau-de-bord', w.width, theme.key);
  326 |             }
  327 |             await org.close();
  328 | 
  329 |             // Administration : produits à vérifier (la bière de la carte, mot trouvé surligné)
  330 |             const adm = await themedContext(browser, testInfo, theme.scheme, requireStorageState('fumee-superadmin'));
  331 |             const apage = await adm.newPage();
  332 |             for (const w of WIDTHS) {
  333 |                 await apage.setViewportSize({ width: w.width, height: w.height });
  334 |                 await apage.goto(`/admin/products?produit=${data.products.biere}`, { waitUntil: 'load' });
  335 |                 await title(apage, 'Produits à vérifier');
  336 |                 await expect(apage.locator(`#produit-${data.products.biere}`)).toBeVisible({ timeout: 30_000 });
  337 |                 await settle(apage);
  338 |                 await checkLayout(apage, w.width, w.phone, 'produits à vérifier');
  339 |                 await shot(apage, 'admin-produits', w.width, theme.key);
  340 | 
  341 |                 // Contre-vérification du lot 12c (T3) : « Mettre à vérifier » un produit qu'aucun mot ne repère
  342 |                 await apage.getByRole('tab', { name: 'Mettre à vérifier' }).click();
  343 |                 await apage.getByRole('searchbox', { name: 'Nom du produit' }).fill('Yassa poulet');
  344 |                 await apage.getByRole('button', { name: 'Chercher' }).click();
  345 |                 await expect(apage.getByRole('list', { name: 'Produits trouvés' }).getByText('Yassa poulet', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
```