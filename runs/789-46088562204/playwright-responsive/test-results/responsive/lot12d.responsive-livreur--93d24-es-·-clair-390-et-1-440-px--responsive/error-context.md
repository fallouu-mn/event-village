# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lot12d.responsive.spec.ts >> livreur, administration, fermeture, pause, signalement, allergènes · clair (390 et 1 440 px)
- Location: e2e/lot12d.responsive.spec.ts:240:9

# Error details

```
Error: livraisons du jour (390 px) : défauts bloquants
390 px : 4 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 12 px « En route » (div.min-w-0.flex-1 > div.flex.flex-wrap > span.rounded-full.border) ; 12 px « Client absent » (div.min-w-0.flex-1 > div.flex.flex-wrap > span.rounded-full.border) ; 12 px « Décision de l’équipe » (div.min-w-0.flex-1 > div.flex.flex-wrap > span.rounded-full.border) ; 12 px « Prête à partir » (div.min-w-0.flex-1 > div.flex.flex-wrap > span.rounded-full.border)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "390 px : 4 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 12 px « En route » (div.min-w-0.flex-1 > div.flex.flex-wrap > span.rounded-full.border) ; 12 px « Client absent » (div.min-w-0.flex-1 > div.flex.flex-wrap > span.rounded-full.border) ; 12 px « Décision de l’équipe » (div.min-w-0.flex-1 > div.flex.flex-wrap > span.rounded-full.border) ; 12 px « Prête à partir » (div.min-w-0.flex-1 > div.flex.flex-wrap > span.rounded-full.border)",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - banner [ref=e4]:
        - generic [ref=e5]:
          - button "Ouvrir le menu" [ref=e6] [cursor=pointer]
          - link "Event Village, accueil" [ref=e10] [cursor=pointer]:
            - /url: /
        - generic [ref=e13]:
          - button "Notifications" [ref=e15] [cursor=pointer]
          - button "Basculer le thème" [ref=e20] [cursor=pointer]
          - link "Mon profil (Awa Sarr)" [ref=e24] [cursor=pointer]:
            - /url: /profile
            - generic [aria-hidden] [ref=e25]: AS
      - main [ref=e27]:
        - generic [ref=e29]:
          - generic [ref=e32]:
            - heading "Mes livraisons" [level=1] [ref=e33]
            - paragraph [ref=e34]: Les livraisons qui vous sont confiées aujourd’hui.
          - region [ref=e35]:
            - heading "Invitations à répondre" [level=2] [ref=e36]
            - list [ref=e37]:
              - listitem [ref=e38]:
                - link "Baobab Scène vous invite à livrer" [ref=e39] [cursor=pointer]:
                  - /url: /courier/invitations/88f15c62-9793-4400-b26b-736915fcb032
          - region [ref=e46]:
            - heading "En route 1" [level=2] [ref=e47]:
              - text: En route
              - generic [ref=e48]: "1"
            - list [ref=e49]:
              - listitem [ref=e50]:
                - link "Livraison CMD-261128-E61470, En route, Le Baobab 872243" [ref=e51] [cursor=pointer]:
                  - /url: /courier/orders/5ab827cd-10f1-45c6-97da-19701592180b
                  - generic [ref=e52]:
                    - generic [ref=e53]:
                      - generic [ref=e54]: CMD-261128-E61470
                      - generic [ref=e55]: En route
                    - paragraph [ref=e56]:
                      - generic [ref=e62]: Le Baobab 872243 · Médina – Fass
                    - paragraph [ref=e63]:
                      - generic [ref=e67]: Villa 7, rue 10 Médina, face à la mosquée
                    - generic [ref=e68]:
                      - generic [ref=e69]: Prévue vers 00 h 56
                      - generic [ref=e73]: "À encaisser : 10 000 F CFA"
          - region [ref=e79]:
            - heading "Client absent 2" [level=2] [ref=e80]:
              - text: Client absent
              - generic [ref=e81]: "2"
            - list [ref=e82]:
              - listitem [ref=e83]:
                - link "Livraison CMD-261128-014775, Client absent, Le Baobab 872243" [ref=e84] [cursor=pointer]:
                  - /url: /courier/orders/5841072d-112b-4f21-968a-93c0bb762adf
                  - generic [ref=e85]:
                    - generic [ref=e86]:
                      - generic [ref=e87]: CMD-261128-014775
                      - generic [ref=e88]: Client absent
                    - paragraph [ref=e89]:
                      - generic [ref=e95]: Le Baobab 872243 · Médina – Fass
                    - paragraph [ref=e96]:
                      - generic [ref=e100]: Villa 7, rue 10 Médina, face à la mosquée
                    - generic [ref=e101]:
                      - generic [ref=e102]: Prévue vers 01 h 01
                      - generic [ref=e106]: "À encaisser : 4 500 F CFA"
              - listitem [ref=e112]:
                - link "Livraison CMD-261128-CC3B9A, Décision de l’équipe, Le Baobab 872243" [ref=e113] [cursor=pointer]:
                  - /url: /courier/orders/12931380-1178-4a16-a0d8-8550325d2a58
                  - generic [ref=e114]:
                    - generic [ref=e115]:
                      - generic [ref=e116]: CMD-261128-CC3B9A
                      - generic [ref=e117]: Décision de l’équipe
                    - paragraph [ref=e118]:
                      - generic [ref=e124]: Le Baobab 872243 · Médina – Fass
                    - paragraph [ref=e125]:
                      - generic [ref=e129]: Villa 7, rue 10 Médina, face à la mosquée
                    - generic [ref=e130]:
                      - generic [ref=e131]: Prévue vers 01 h 01
                      - generic [ref=e135]: "À encaisser : 5 500 F CFA"
          - region [ref=e141]:
            - heading "Prêtes à partir 1" [level=2] [ref=e142]:
              - text: Prêtes à partir
              - generic [ref=e143]: "1"
            - list [ref=e144]:
              - listitem [ref=e145]:
                - link "Livraison CMD-261128-B9BDAF, Prête à partir, Le Baobab 872243" [ref=e146] [cursor=pointer]:
                  - /url: /courier/orders/a9c9d085-11b9-4ed8-8cc5-3894fb667945
                  - generic [ref=e147]:
                    - generic [ref=e148]:
                      - generic [ref=e149]: CMD-261128-B9BDAF
                      - generic [ref=e150]: Prête à partir
                    - paragraph [ref=e151]:
                      - generic [ref=e157]: Le Baobab 872243 · Médina – Fass
                    - paragraph [ref=e158]:
                      - generic [ref=e162]: Villa 7, rue 10 Médina, face à la mosquée
                    - generic [ref=e163]:
                      - generic [ref=e164]: Prévue vers 01 h 02
                      - generic [ref=e168]: "À encaisser : 12 500 F CFA"
    - navigation "Navigation rapide":
      - generic [ref=e174]:
        - link "Accueil" [ref=e176] [cursor=pointer]:
          - /url: /
        - link "Explorer" [ref=e182] [cursor=pointer]:
          - /url: /explore
        - link "Billets" [ref=e188] [cursor=pointer]:
          - /url: /tickets
        - link "Avis" [ref=e193] [cursor=pointer]:
          - /url: /notifications
        - link "Portefeuille" [ref=e199] [cursor=pointer]:
          - /url: /wallet
  - alert [ref=e205]
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
  9   |  * démonstration « organisateur2 », validé, ouvert 24 h sur 24, qui prend des commandes (livraison, retrait, paiement à la
  10  |  * remise : aucun paiement réel) ; des plats avec allergènes et piment ; un livreur actif (compte neuf), invité aussi par
  11  |  * « organisateur » (invitation en attente) ; des livraisons à chaque étape (prête, en route, client absent en attente,
  12  |  * client absent à décider : horloge avancée par une écriture LOCALE de la base, SUPABASE_DB_URL de .env.e2e, hôte local
  13  |  * vérifié) ; deux commandes en préparation de la cliente (dont une signalée) ; une commande prévue demain dans une
  14  |  * fermeture exceptionnelle posée ensuite ; une pause de 60 minutes.
  15  |  *
  16  |  * Interrupteurs : features.orders_enabled par le compteur partagé e2e/support/orders-service.ts (lots 12b et 12c) ;
  17  |  * features.tables_enabled (page des fermetures, sous la garde des tables) par e2e/support/tables-service.ts ; sous le verrou
  18  |  * des services (groupe « services »).
  19  |  *
  20  |  * Une seule connexion par compte et par spec (livreur, cliente, partenaire ; l'administration reprend la session de fumée).
  21  |  * Pour chaque thème (clair, sombre) et chaque largeur (390 et 1 440 px) : contrôle responsive (0 défaut bloquant) et
  22  |  * capture. Captures : .e2e-captures/captures-responsive/l12d-<écran>__<largeur>__<thème>.jpg (publiées sur ci-results).
  23  |  */
  24  | import fs from 'node:fs';
  25  | import path from 'node:path';
  26  | import { randomUUID } from 'node:crypto';
  27  | import { Client } from 'pg';
  28  | import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test';
  29  | import { test, expect, projectContextOptions, type ThemeKey } from './support/fixtures';
  30  | import { E2E_OUTPUT_DIR, readDemoIds } from './support/demo-ids';
  31  | import { createClientAccount, rpcOk, serviceClient, userIdByEmail, type ControllerAccount } from './support/service';
  32  | import { runResponsiveChecks } from './support/responsive-checks';
  33  | import { requireStorageState, TEST_PASSWORD } from './support/accounts';
  34  | import { openOrdersService, releaseOrdersService } from './support/orders-service';
  35  | import { openTablesService, releaseTablesService } from './support/tables-service';
  36  | import { APP_URL, e2eConfig } from './support/env';
  37  | import { FIXTURE_USERS } from '../tests/helpers/fixture-data';
  38  | 
  39  | test.describe.configure({ mode: 'serial' });
  40  | 
  41  | const SHOTS = path.join(E2E_OUTPUT_DIR, 'captures-responsive');
  42  | const THEMES: ReadonlyArray<{ key: ThemeKey; scheme: 'light' | 'dark' }> = [{ key: 'clair', scheme: 'light' }, { key: 'sombre', scheme: 'dark' }];
  43  | const WIDTHS = [
  44  |     { width: 390, height: 844, phone: true },
  45  |     { width: 1440, height: 900, phone: false },
  46  | ] as const;
  47  | const STAMP = randomUUID().slice(0, 6);
  48  | const ALWAYS_OPEN = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, opens_at: '00:00', closes_at: '24:00' }));
  49  | const WHO = 'lot12d';
  50  | 
  51  | interface Ref { id: string; number: string }
  52  | interface Seeded {
  53  |     venueId: string;
  54  |     closureId: string;
  55  |     invitationId: string;
  56  |     courier: ControllerAccount;
  57  |     client: ControllerAccount;
  58  |     orders: { prete: Ref; route: Ref; absent: Ref; equipe: Ref; prep: Ref; signale: Ref; fermeture: Ref };
  59  | }
  60  | 
  61  | type SessionState = Awaited<ReturnType<BrowserContext['storageState']>>;
  62  | const sessions: Record<'courier' | 'client' | 'partner', SessionState | null> = { courier: null, client: null, partner: null };
  63  | 
  64  | async function settle(page: Page): Promise<void> {
  65  |     await page.evaluate(() => document.fonts.ready.then(() => true));
  66  |     // Écrans relus toutes les 10 à 15 s : jamais « réseau au repos » ; attente bornée
  67  |     await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);
  68  |     await page.evaluate(() => new Promise<void>((r) => { requestAnimationFrame(() => requestAnimationFrame(() => r())); }));
  69  |     await page.waitForTimeout(400); // fin des transitions (≤ 300 ms)
  70  | }
  71  | 
  72  | async function shot(page: Page, name: string, width: number, theme: ThemeKey, full = true): Promise<void> {
  73  |     fs.mkdirSync(SHOTS, { recursive: true });
  74  |     await page.screenshot({ path: path.join(SHOTS, `l12d-${name}__${width}__${theme}.jpg`), type: 'jpeg', quality: 80, caret: 'hide', scale: 'css', fullPage: full });
  75  | }
  76  | 
  77  | async function checkLayout(page: Page, width: number, phone: boolean, label: string): Promise<void> {
  78  |     const r = await runResponsiveChecks(page, { width, phone });
> 79  |     expect(r.blocking, `${label} (${width} px) : défauts bloquants\n${r.blocking.join('\n')}`).toEqual([]);
      |                                                                                                ^ Error: livraisons du jour (390 px) : défauts bloquants
  80  | }
  81  | 
  82  | async function themedContext(browser: Browser, testInfo: TestInfo, scheme: 'light' | 'dark', storageState?: string | SessionState): Promise<BrowserContext> {
  83  |     const context = await browser.newContext({ ...projectContextOptions(testInfo), colorScheme: scheme, ...(storageState ? { storageState } : {}) });
  84  |     await context.addInitScript((value: string) => {
  85  |         try { window.localStorage.setItem('ev-theme', value); } catch { /* document opaque */ }
  86  |         document.cookie = `ev-theme=${value}; path=/`;
  87  |     }, scheme);
  88  |     return context;
  89  | }
  90  | 
  91  | /** Contexte connecté : la première fois, une connexion (gardée sans le thème) ; ensuite la session reprise. */
  92  | async function signedContext(browser: Browser, testInfo: TestInfo, scheme: 'light' | 'dark', who: keyof typeof sessions, identifier: string): Promise<BrowserContext> {
  93  |     const context = await themedContext(browser, testInfo, scheme, sessions[who] ?? undefined);
  94  |     if (!sessions[who]) {
  95  |         const res = await context.request.post(`${APP_URL}/api/auth/login`, { data: { identifier, password: TEST_PASSWORD } });
  96  |         expect(res.status(), `connexion de ${identifier} : ${await res.text()}`).toBe(200);
  97  |         const state = await context.storageState();
  98  |         sessions[who] = {
  99  |             cookies: state.cookies.filter((c) => c.name !== 'ev-theme'),
  100 |             origins: state.origins.map((o) => ({ ...o, localStorage: o.localStorage.filter((l) => l.name !== 'ev-theme') })),
  101 |         };
  102 |     }
  103 |     return context;
  104 | }
  105 | 
  106 | async function title(page: Page, name: string | RegExp): Promise<void> {
  107 |     const heading = typeof name === 'string' ? page.getByRole('heading', { level: 1, name, exact: true }) : page.getByRole('heading', { level: 1, name });
  108 |     await expect(heading.first()).toBeVisible({ timeout: 30_000 });
  109 | }
  110 | 
  111 | /** Écriture LOCALE de la base (horloge des tests) : hôte local vérifié, drapeau des fonctions de commande posé. */
  112 | async function localSql(text: string, params: unknown[]): Promise<void> {
  113 |     e2eConfig();
  114 |     const url = process.env.SUPABASE_DB_URL;
  115 |     if (!url) throw new Error('[l12d] SUPABASE_DB_URL absent de .env.e2e : horloge de l’absence impossible à avancer');
  116 |     const host = new URL(url).hostname;
  117 |     if (!['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error(`[l12d] SUPABASE_DB_URL non locale (${host})`);
  118 |     const c = new Client({ connectionString: url, application_name: 'ev-e2e-l12d' });
  119 |     await c.connect();
  120 |     try {
  121 |         await c.query('BEGIN');
  122 |         await c.query(`SELECT set_config('event_village.order_flow', 'on', true)`);
  123 |         await c.query(text, params);
  124 |         await c.query('COMMIT');
  125 |     } finally {
  126 |         await c.end();
  127 |     }
  128 | }
  129 | 
  130 | function tomorrow(): string {
  131 |     return new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  132 | }
  133 | 
  134 | async function seed(superadmin: string): Promise<Seeded> {
  135 |     const demo = readDemoIds().accounts;
  136 |     const owner = demo.organisateur2;
  137 |     const service = serviceClient();
  138 |     const { data: fiche, error: fErr } = await service.from('partners').select('id, status').eq('user_id', owner.userId).order('created_at').limit(1).maybeSingle();
  139 |     if (fErr || !fiche || fiche.status !== 'VALIDE') throw new Error(`[l12d] fiche de organisateur2 : ${fErr?.message ?? String(fiche?.status)}`);
  140 | 
  141 |     const { data: venue, error: vErr } = await service.from('venues').insert({
  142 |         partner_id: fiche.id, kind: 'RESTAURANT', name: `Le Baobab ${STAMP}`, address: 'Rue 10, Médina', city: 'Dakar',
  143 |         latitude: 14.68, longitude: -17.45, confirmation_mode: 'AUTO',
  144 |     }).select('id').single();
  145 |     if (vErr || !venue) throw new Error(`[l12d] établissement : ${vErr?.message}`);
  146 |     const venueId = String(venue.id);
  147 |     await rpcOk('venue_hours_set', { actor_id: owner.userId, venue_id: venueId, hours: ALWAYS_OPEN });
  148 |     await rpcOk('venue_validation_decide', { actor_id: superadmin, venue_id: venueId, decision: 'VALIDER', reason: null });
  149 |     await rpcOk('order_venue_settings_set', {
  150 |         actor_id: owner.userId, venue_id: venueId, orders_open: true, modes: ['LIVRAISON', 'RETRAIT'],
  151 |         deposit_allowed: false, deposit_percent: null, pay_on_handover: true, prep_minutes: 20,
  152 |     });
  153 |     const zone = await rpcOk('order_delivery_zone_set', { actor_id: owner.userId, venue_id: venueId, name: 'Médina – Fass', fee: 1_000, min_order: 0 });
  154 |     const zoneId = String((zone.zone as Record<string, unknown>).id);
  155 |     const save = async (fields: Record<string, unknown>, allergens: string[], spice: number): Promise<string> => {
  156 |         const r = await rpcOk('order_product_save', { actor_id: owner.userId, product_id: null, fields: { venue_id: venueId, ...fields } });
  157 |         const id = String((r.product as Record<string, unknown>).id);
  158 |         await rpcOk('order_product_details_set', { actor_id: owner.userId, product_id: id, allergens, spice_level: spice });
  159 |         return id;
  160 |     };
  161 |     const yassa = await save({ name: 'Yassa poulet', description: 'Poulet mariné au citron et aux oignons, riz blanc.', price: 3_500 }, ['MOUTARDE', 'GLUTEN'], 2);
  162 |     const thieb = await save({ name: 'Thiéboudienne', description: 'Riz au poisson, légumes du marché.', price: 4_500 }, ['POISSON', 'CELERI'], 1);
  163 |     await save({ name: 'Bissap maison', description: 'Fleurs d’hibiscus, menthe fraîche.', price: 1_000 }, [], 0);
  164 |     await save({ name: 'Pastels au thon', description: 'Chaussons frits, sauce très pimentée.', price: 2_000 }, ['POISSON', 'GLUTEN', 'OEUFS'], 3);
  165 | 
  166 |     // Livreur actif ; invitation en attente d'une autre partenaire (organisateur)
  167 |     const courier = await createClientAccount(`l12d-livreur-${STAMP}`);
  168 |     const inv = await rpcOk('order_courier_invite', { actor_id: owner.userId, phone: courier.phone });
  169 |     await rpcOk('order_courier_respond', { actor_id: courier.userId, invitation_id: inv.invitation_id, accept: true });
  170 |     const other = await rpcOk('order_courier_invite', { actor_id: demo.organisateur.userId, phone: courier.phone });
  171 | 
  172 |     // Commandes payables à la remise (au plus 3 en cours par cliente)
  173 |     const client = await createClientAccount(`l12d-cliente-${STAMP}`);
  174 |     const buyers: ControllerAccount[] = [];
  175 |     for (const k of ['a', 'b']) buyers.push(await createClientAccount(`l12d-${k}-${STAMP}`));
  176 |     const line = (productId: string, quantity: number) => ({ product_id: productId, quantity, option_ids: [] });
  177 |     const place = async (who: ControllerAccount, body: Record<string, unknown>): Promise<Ref> => {
  178 |         const r = await rpcOk('order_create', { client_id: who.userId, venue_id: venueId, payment: 'DIFFERE', ...body });
  179 |         return { id: String(r.order_id), number: String(r.order_number) };
```