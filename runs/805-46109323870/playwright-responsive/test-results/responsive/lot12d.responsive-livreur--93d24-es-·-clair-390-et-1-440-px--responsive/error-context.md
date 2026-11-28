# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lot12d.responsive.spec.ts >> livreur, administration, fermeture, pause, signalement, allergènes · clair (390 et 1 440 px)
- Location: e2e/lot12d.responsive.spec.ts:233:9

# Error details

```
Error: allergènes et piment (1440 px) : défauts bloquants
1440 px : textes qui se chevauchent : span.min-w-8.text-center « 1 » sur p.text-sm.leading-snug « Par exemple : sans piment, bien cuit. » (11×6 px) ; span « Ajouter » sur p.text-sm.leading-snug « Par exemple : sans piment, bien cuit. » (11×4 px)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "1440 px : textes qui se chevauchent : span.min-w-8.text-center « 1 » sur p.text-sm.leading-snug « Par exemple : sans piment, bien cuit. » (11×6 px) ; span « Ajouter » sur p.text-sm.leading-snug « Par exemple : sans piment, bien cuit. » (11×4 px)",
+ ]
```

# Page snapshot

```yaml
- generic [ref=f5e1]:
  - generic [ref=f5e3]:
    - banner [ref=f5e4]:
      - generic [ref=f5e5]:
        - link "Event Village, accueil" [ref=f5e7] [cursor=pointer]:
          - /url: /
          - generic [ref=f5e8]: Event Village
        - navigation "Rubriques" [ref=f5e13]:
          - link "Accueil" [ref=f5e14] [cursor=pointer]:
            - /url: /
          - link "Explorer" [ref=f5e15] [cursor=pointer]:
            - /url: /explore
          - link "Mes billets" [ref=f5e16] [cursor=pointer]:
            - /url: /tickets
          - link "Commandes" [ref=f5e17] [cursor=pointer]:
            - /url: /orders
          - link "Portefeuille" [ref=f5e18] [cursor=pointer]:
            - /url: /wallet
      - link "Rechercher un événement…" [ref=f5e20] [cursor=pointer]:
        - /url: /explore
      - generic [ref=f5e25]:
        - button "Notifications" [ref=f5e27] [cursor=pointer]
        - button "Awa Client" [ref=f5e32] [cursor=pointer]:
          - generic [aria-hidden] [ref=f5e33]: AC
    - main [ref=f5e37]:
      - generic [ref=f5e39]:
        - generic [ref=f5e40]:
          - generic [ref=f5e45]:
            - generic [ref=f5e46]:
              - generic [ref=f5e47]: Restaurant
              - generic [ref=f5e49]: Ouvert maintenant
            - heading "Le Baobab 2905f3" [level=1] [ref=f5e51]
            - list [ref=f5e52]:
              - listitem [ref=f5e53]:
                - generic [ref=f5e57]: Rue 10, Médina, Dakar
              - listitem [ref=f5e58]:
                - generic [ref=f5e62]: Aujourd’hui 0 h – 24 h
              - listitem [ref=f5e63]:
                - generic [ref=f5e67]: Prêt en 20 min environ
            - list "Modes de remise" [ref=f5e68]:
              - listitem [ref=f5e69]: Livraison
              - listitem [ref=f5e70]: À emporter
          - status [ref=f5e71]:
            - generic [ref=f5e76]:
              - paragraph [ref=f5e77]: Ce restaurant reprend les commandes à 5 h 58
              - paragraph [ref=f5e79]: "Il fait une courte pause pour servir les commandes en cours. Vous pouvez préparer votre panier : vous commanderez dès la reprise."
          - group "Filtres de la carte" [ref=f5e80]:
            - button "Sans piment" [ref=f5e81] [cursor=pointer]
          - region [ref=f5e84]:
            - heading "La carte" [level=2] [ref=f5e85]
            - generic [ref=f5e86]:
              - article [ref=f5e87]:
                - button "Voir Bissap maison" [ref=f5e88] [cursor=pointer]:
                  - img "Bissap maison (sans photo)" [ref=f5e90]
                  - generic [ref=f5e94]:
                    - generic [ref=f5e95]: Bissap maison
                    - generic [ref=f5e96]: Fleurs d’hibiscus, menthe fraîche.
                    - generic [ref=f5e97]: 1 000 F CFA
              - article [ref=f5e101]:
                - button "Voir Pastels au thon" [ref=f5e102] [cursor=pointer]:
                  - img "Pastels au thon (sans photo)" [ref=f5e104]
                  - generic [ref=f5e108]:
                    - generic [ref=f5e109]: Pastels au thon
                    - generic [ref=f5e110]: Chaussons frits, sauce très pimentée.
                    - generic [ref=f5e111]: 2 000 F CFA
              - article [ref=f5e115]:
                - button "Voir Thiéboudienne" [ref=f5e116] [cursor=pointer]:
                  - img "Thiéboudienne (sans photo)" [ref=f5e118]
                  - generic [ref=f5e122]:
                    - generic [ref=f5e123]: Thiéboudienne
                    - generic [ref=f5e124]: Riz au poisson, légumes du marché.
                    - generic [ref=f5e125]: 4 500 F CFA
              - article [ref=f5e129]:
                - button "Voir Yassa poulet" [ref=f5e130] [cursor=pointer]:
                  - img "Yassa poulet (sans photo)" [ref=f5e132]
                  - generic [ref=f5e136]:
                    - generic [ref=f5e137]: Yassa poulet
                    - generic [ref=f5e138]: Poulet mariné au citron et aux oignons, riz blanc.
                    - generic [ref=f5e139]: 3 500 F CFA
        - complementary "Votre panier" [ref=f5e143]:
          - generic [ref=f5e144]:
            - heading "Votre panier" [level=2] [ref=f5e145]
            - generic [ref=f5e147]:
              - paragraph [ref=f5e154]: Votre panier est vide
              - paragraph [ref=f5e155]: "Touchez un plat pour l’ajouter : le total exact s’affiche ici."
              - button "Voir la carte" [ref=f5e156] [cursor=pointer]
  - alert [ref=f5e158]
  - dialog [ref=f5e161]:
    - generic [ref=f5e162]:
      - heading "Yassa poulet" [level=2] [ref=f5e165]
      - button "Fermer" [ref=f5e166] [cursor=pointer]
    - generic [ref=f5e172]:
      - img "Yassa poulet (sans photo)" [ref=f5e173]
      - generic [ref=f5e177]:
        - paragraph [ref=f5e178]: 3 500 F CFA
        - paragraph [ref=f5e179]: Poulet mariné au citron et aux oignons, riz blanc.
      - generic [ref=f5e180]:
        - paragraph [ref=f5e181]:
          - generic [ref=f5e187]: Pimenté (2/3)
        - generic [ref=f5e188]:
          - paragraph [ref=f5e189]: Allergènes
          - list "Allergènes du plat" [ref=f5e190]:
            - listitem [ref=f5e191]: Gluten
            - listitem [ref=f5e192]: Moutarde
      - generic [ref=f5e193]:
        - generic [ref=f5e194]:
          - generic [ref=f5e195]: Une précision pour la cuisine ?
          - generic [ref=f5e196]: 0 / 200
        - textbox "Une précision pour la cuisine ?" [active] [ref=f5e197]
        - paragraph [ref=f5e198]: "Par exemple : sans piment, bien cuit."
    - generic [ref=f5e200]:
      - group "Quantité" [ref=f5e201]:
        - button "Une portion de moins" [disabled] [ref=f5e202]
        - generic [ref=f5e205]: "1"
        - button "Une portion de plus" [ref=f5e206] [cursor=pointer]
      - button "Ajouter 1 Yassa poulet au panier" [ref=f5e209] [cursor=pointer]:
        - generic [ref=f5e210]: Ajouter·3 500 F CFA
```

# Test source

```ts
  1   | /**
  2   |  * Lot 12d — commandes : espace du livreur (livraisons du jour, livraison prête, saisie du code et reste en espèces, client
  3   |  * absent, invitation), administration des commandes (liste « À décider », fiche, décision après une absence), partenaire
  4   |  * (commandes prévues pendant une fermeture, pause des commandes) et client (signaler un problème, signalement envoyé,
  5   |  * bandeau de pause, allergènes et piment), de bout en bout sur le serveur construit (job « responsive » de la CI : nom en
  6   |  * « …responsive.spec.ts »).
  7   |  *
  8   |  * Données propres au spec (la graine de démonstration n'est pas touchée) : un établissement neuf de la partenaire de
  9   |  * démonstration « organisateur » (session déjà préparée), validé, ouvert 24 h sur 24, qui prend des commandes (livraison, retrait, paiement à la
  10  |  * remise : aucun paiement réel) ; des plats avec allergènes et piment ; un livreur actif (fumee-client), invité aussi par
  11  |  * « organisateur2 » (invitation en attente), qui passe aussi deux commandes à retirer comme client ; des livraisons à chaque étape (prête, en route, client absent en attente,
  12  |  * client absent à décider : horloge avancée par une écriture LOCALE de la base, SUPABASE_DB_URL de .env.e2e, hôte local
  13  |  * vérifié) ; deux commandes en préparation du même compte, client cette fois (dont une signalée) ; une commande prévue demain dans une
  14  |  * fermeture exceptionnelle posée ensuite ; une pause de 60 minutes.
  15  |  *
  16  |  * Interrupteurs : features.orders_enabled par le compteur partagé e2e/support/orders-service.ts (lots 12b et 12c) ;
  17  |  * features.tables_enabled (page des fermetures, sous la garde des tables) par e2e/support/tables-service.ts ; sous le verrou
  18  |  * des services (groupe « services »).
  19  |  *
  20  |  * AUCUNE connexion dans le spec : le quota de 30 connexions par adresse et par heure du job (PASSWORD_LOGIN_PER_IP_HOUR) est
  21  |  * atteint par la préparation des sessions et les autres specs (runs 789 et 793 : 429). Sessions préparées reprises : le client
  22  |  * du seed de test (fumee-client, lu par aucun autre spec du job responsive) est le livreur, et le client de ses deux
  23  |  * commandes à retirer ; organisateur (partenaire) ; fumee-superadmin (administration).
  24  |  * Pour chaque thème (clair, sombre) et chaque largeur (390 et 1 440 px) : contrôle responsive (0 défaut bloquant) et
  25  |  * capture. Captures : .e2e-captures/captures-responsive/l12d-<écran>__<largeur>__<thème>.jpg (publiées sur ci-results).
  26  |  */
  27  | import fs from 'node:fs';
  28  | import path from 'node:path';
  29  | import { randomUUID } from 'node:crypto';
  30  | import { Client } from 'pg';
  31  | import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test';
  32  | import { test, expect, projectContextOptions, type ThemeKey } from './support/fixtures';
  33  | import { E2E_OUTPUT_DIR, readDemoIds } from './support/demo-ids';
  34  | import { createClientAccount, rpcOk, serviceClient, userIdByEmail, type ControllerAccount } from './support/service';
  35  | import { runResponsiveChecks } from './support/responsive-checks';
  36  | import { requireStorageState } from './support/accounts';
  37  | import { openOrdersService, releaseOrdersService } from './support/orders-service';
  38  | import { openTablesService, releaseTablesService } from './support/tables-service';
  39  | import { e2eConfig } from './support/env';
  40  | import { FIXTURE_USERS } from '../tests/helpers/fixture-data';
  41  | 
  42  | test.describe.configure({ mode: 'serial' });
  43  | 
  44  | const SHOTS = path.join(E2E_OUTPUT_DIR, 'captures-responsive');
  45  | const THEMES: ReadonlyArray<{ key: ThemeKey; scheme: 'light' | 'dark' }> = [{ key: 'clair', scheme: 'light' }, { key: 'sombre', scheme: 'dark' }];
  46  | const WIDTHS = [
  47  |     { width: 390, height: 844, phone: true },
  48  |     { width: 1440, height: 900, phone: false },
  49  | ] as const;
  50  | const STAMP = randomUUID().slice(0, 6);
  51  | const ALWAYS_OPEN = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, opens_at: '00:00', closes_at: '24:00' }));
  52  | const WHO = 'lot12d';
  53  | 
  54  | interface Ref { id: string; number: string }
  55  | interface Seeded {
  56  |     venueId: string;
  57  |     closureId: string;
  58  |     invitationId: string;
  59  |     courier: ControllerAccount;
  60  |     orders: { prete: Ref; route: Ref; absent: Ref; equipe: Ref; prep: Ref; signale: Ref; fermeture: Ref };
  61  | }
  62  | 
  63  | async function settle(page: Page): Promise<void> {
  64  |     await page.evaluate(() => document.fonts.ready.then(() => true));
  65  |     // Écrans relus toutes les 10 à 15 s : jamais « réseau au repos » ; attente bornée
  66  |     await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);
  67  |     await page.evaluate(() => new Promise<void>((r) => { requestAnimationFrame(() => requestAnimationFrame(() => r())); }));
  68  |     await page.waitForTimeout(400); // fin des transitions (≤ 300 ms)
  69  | }
  70  | 
  71  | async function shot(page: Page, name: string, width: number, theme: ThemeKey, full = true): Promise<void> {
  72  |     fs.mkdirSync(SHOTS, { recursive: true });
  73  |     await page.screenshot({ path: path.join(SHOTS, `l12d-${name}__${width}__${theme}.jpg`), type: 'jpeg', quality: 80, caret: 'hide', scale: 'css', fullPage: full });
  74  | }
  75  | 
  76  | async function checkLayout(page: Page, width: number, phone: boolean, label: string): Promise<void> {
  77  |     const r = await runResponsiveChecks(page, { width, phone });
> 78  |     expect(r.blocking, `${label} (${width} px) : défauts bloquants\n${r.blocking.join('\n')}`).toEqual([]);
      |                                                                                                ^ Error: allergènes et piment (1440 px) : défauts bloquants
  79  | }
  80  | 
  81  | async function themedContext(browser: Browser, testInfo: TestInfo, scheme: 'light' | 'dark', storageState?: string): Promise<BrowserContext> {
  82  |     const context = await browser.newContext({ ...projectContextOptions(testInfo), colorScheme: scheme, ...(storageState ? { storageState } : {}) });
  83  |     await context.addInitScript((value: string) => {
  84  |         try { window.localStorage.setItem('ev-theme', value); } catch { /* document opaque */ }
  85  |         document.cookie = `ev-theme=${value}; path=/`;
  86  |     }, scheme);
  87  |     return context;
  88  | }
  89  | 
  90  | async function title(page: Page, name: string | RegExp): Promise<void> {
  91  |     const heading = typeof name === 'string' ? page.getByRole('heading', { level: 1, name, exact: true }) : page.getByRole('heading', { level: 1, name });
  92  |     await expect(heading.first()).toBeVisible({ timeout: 30_000 });
  93  | }
  94  | 
  95  | /** Écriture LOCALE de la base (horloge des tests) : hôte local vérifié, drapeau des fonctions de commande posé. */
  96  | async function localSql(text: string, params: unknown[]): Promise<void> {
  97  |     e2eConfig();
  98  |     const url = process.env.SUPABASE_DB_URL;
  99  |     if (!url) throw new Error('[l12d] SUPABASE_DB_URL absent de .env.e2e : horloge de l’absence impossible à avancer');
  100 |     const host = new URL(url).hostname;
  101 |     if (!['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error(`[l12d] SUPABASE_DB_URL non locale (${host})`);
  102 |     const c = new Client({ connectionString: url, application_name: 'ev-e2e-l12d' });
  103 |     await c.connect();
  104 |     try {
  105 |         await c.query('BEGIN');
  106 |         await c.query(`SELECT set_config('event_village.order_flow', 'on', true)`);
  107 |         await c.query(text, params);
  108 |         await c.query('COMMIT');
  109 |     } finally {
  110 |         await c.end();
  111 |     }
  112 | }
  113 | 
  114 | /** Compte du seed de test (session préparée) : identifiant, numéro, prénom et nom. */
  115 | async function fixtureAccount(email: string): Promise<ControllerAccount> {
  116 |     const userId = await userIdByEmail(email);
  117 |     const { data, error } = await serviceClient().from('users').select('phone, first_name, last_name').eq('id', userId).single();
  118 |     if (error || !data?.phone) throw new Error(`[l12d] compte ${email} : ${error?.message ?? 'sans numéro'}`);
  119 |     const phone = String(data.phone);
  120 |     return { userId, email, phone, local: phone.replace(/^\+221/, ''), firstName: String(data.first_name ?? ''), lastName: String(data.last_name ?? '') };
  121 | }
  122 | 
  123 | function tomorrow(): string {
  124 |     return new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  125 | }
  126 | 
  127 | async function seed(superadmin: string): Promise<Seeded> {
  128 |     const demo = readDemoIds().accounts;
  129 |     const owner = demo.organisateur;
  130 |     const service = serviceClient();
  131 |     const { data: fiche, error: fErr } = await service.from('partners').select('id, status').eq('user_id', owner.userId).order('created_at').limit(1).maybeSingle();
  132 |     if (fErr || !fiche || fiche.status !== 'VALIDE') throw new Error(`[l12d] fiche de organisateur : ${fErr?.message ?? String(fiche?.status)}`);
  133 | 
  134 |     const { data: venue, error: vErr } = await service.from('venues').insert({
  135 |         partner_id: fiche.id, kind: 'RESTAURANT', name: `Le Baobab ${STAMP}`, address: 'Rue 10, Médina', city: 'Dakar',
  136 |         latitude: 14.68, longitude: -17.45, confirmation_mode: 'AUTO',
  137 |     }).select('id').single();
  138 |     if (vErr || !venue) throw new Error(`[l12d] établissement : ${vErr?.message}`);
  139 |     const venueId = String(venue.id);
  140 |     await rpcOk('venue_hours_set', { actor_id: owner.userId, venue_id: venueId, hours: ALWAYS_OPEN });
  141 |     await rpcOk('venue_validation_decide', { actor_id: superadmin, venue_id: venueId, decision: 'VALIDER', reason: null });
  142 |     await rpcOk('order_venue_settings_set', {
  143 |         actor_id: owner.userId, venue_id: venueId, orders_open: true, modes: ['LIVRAISON', 'RETRAIT'],
  144 |         deposit_allowed: false, deposit_percent: null, pay_on_handover: true, prep_minutes: 20,
  145 |     });
  146 |     const zone = await rpcOk('order_delivery_zone_set', { actor_id: owner.userId, venue_id: venueId, name: 'Médina – Fass', fee: 1_000, min_order: 0 });
  147 |     const zoneId = String((zone.zone as Record<string, unknown>).id);
  148 |     const save = async (fields: Record<string, unknown>, allergens: string[], spice: number): Promise<string> => {
  149 |         const r = await rpcOk('order_product_save', { actor_id: owner.userId, product_id: null, fields: { venue_id: venueId, ...fields } });
  150 |         const id = String((r.product as Record<string, unknown>).id);
  151 |         await rpcOk('order_product_details_set', { actor_id: owner.userId, product_id: id, allergens, spice_level: spice });
  152 |         return id;
  153 |     };
  154 |     const yassa = await save({ name: 'Yassa poulet', description: 'Poulet mariné au citron et aux oignons, riz blanc.', price: 3_500 }, ['MOUTARDE', 'GLUTEN'], 2);
  155 |     const thieb = await save({ name: 'Thiéboudienne', description: 'Riz au poisson, légumes du marché.', price: 4_500 }, ['POISSON', 'CELERI'], 1);
  156 |     await save({ name: 'Bissap maison', description: 'Fleurs d’hibiscus, menthe fraîche.', price: 1_000 }, [], 0);
  157 |     await save({ name: 'Pastels au thon', description: 'Chaussons frits, sauce très pimentée.', price: 2_000 }, ['POISSON', 'GLUTEN', 'OEUFS'], 3);
  158 | 
  159 |     // Livreur actif ; invitation en attente d'une autre partenaire (organisateur2)
  160 |     const courier = await fixtureAccount(FIXTURE_USERS.CLIENT.email);
  161 |     const inv = await rpcOk('order_courier_invite', { actor_id: owner.userId, phone: courier.phone });
  162 |     await rpcOk('order_courier_respond', { actor_id: courier.userId, invitation_id: inv.invitation_id, accept: true });
  163 |     const other = await rpcOk('order_courier_invite', { actor_id: demo.organisateur2.userId, phone: courier.phone });
  164 | 
  165 |     // Commandes payables à la remise (au plus 3 en cours par compte) ; le livreur est aussi le client de deux retraits
  166 |     const client = courier;
  167 |     const buyers: ControllerAccount[] = [];
  168 |     for (const k of ['a', 'b']) buyers.push(await createClientAccount(`l12d-${k}-${STAMP}`));
  169 |     const line = (productId: string, quantity: number) => ({ product_id: productId, quantity, option_ids: [] });
  170 |     const place = async (who: ControllerAccount, body: Record<string, unknown>): Promise<Ref> => {
  171 |         const r = await rpcOk('order_create', { client_id: who.userId, venue_id: venueId, payment: 'DIFFERE', ...body });
  172 |         return { id: String(r.order_id), number: String(r.order_number) };
  173 |     };
  174 |     const act = async (orderId: string, ...actions: Array<Record<string, unknown>>): Promise<void> => {
  175 |         for (const a of actions) await rpcOk('order_partner_action', { order_id: orderId, actor_id: owner.userId, ...a });
  176 |     };
  177 |     const deliver = (who: ControllerAccount) => ({ mode: 'LIVRAISON', zone_id: zoneId, address: 'Villa 7, rue 10 Médina, face à la mosquée', phone: who.local });
  178 |     const leave = async (o: Ref): Promise<void> => {
```