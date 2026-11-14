# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: terrain.spec.ts >> 1. téléphone en retard de 5 min : codes téléchargés, hors ligne, QR accepté par le contrôleur
- Location: e2e/terrain.spec.ts:119:9

# Error details

```
Error: indicateur hors ligne de la carte TCK-20261114-D9E91CC19A (contrat 5.2) : « available » attendu après le téléchargement automatique

expect(locator).toHaveAttribute(expected) failed

Locator:  locator('li, article').filter({ hasText: 'TCK-20261114-D9E91CC19A' }).last().locator('[data-ev-offline-state]')
Expected: "available"
Received: "missing"
Timeout:  45000ms

Call log:
  - indicateur hors ligne de la carte TCK-20261114-D9E91CC19A (contrat 5.2) : « available » attendu après le téléchargement automatique locator('li, article').filter({ hasText: 'TCK-20261114-D9E91CC19A' }).last().locator('[data-ev-offline-state]') with timeout 45000ms
  - waiting for locator('li, article').filter({ hasText: 'TCK-20261114-D9E91CC19A' }).last().locator('[data-ev-offline-state]')
    93 × locator resolved to <p role="status" aria-atomic="true" data-ev-offline-state="missing" class="flex items-start gap-2 rounded-xl border px-3 py-2 text-sm font-medium leading-snug bg-warning-bg text-warning-fg border-warning-border">…</p>
       - unexpected value "missing"

```

```yaml
- status: Ouvrez ce billet avec du réseau avant d’arriver
```

# Test source

```ts
  6   |  * test, début à ≈ 20 h de l'heure réelle, billets gratuits émis par free_tickets_claim, contrôleur A affecté) et
  7   |  * pose `access.scan_window_before_hours = 24` (D6), remis dans un finally. Aucune route n'accepte d'heure.
  8   |  * Comptes : fumee-client (porteur des billets présentés hors ligne), fumee-client-bis (porteur des billets
  9   |  * scannés en série, lus par sa route live-code tant qu'ils sont valables ; un billet déjà composté, que cette
  10  |  * route refuse par un 409, est relu avec un code calculé par terrain-setup.ts `payload`), fumee-controleur (scanner).
  11  |  * Le QR présenté au scanner est tenu devant la caméra simulée jusqu'à l'envoi de la lecture (sonde, support/terrain.ts).
  12  |  *
  13  |  * Contextes : service worker autorisé seulement pour le client (`serviceWorkers: 'allow'`, D7) ; horloge
  14  |  * installée seulement dans le contexte du client du test 1 (jamais chez le contrôleur ni pendant une mesure :
  15  |  * marques factices sinon). Le réseau 3G est posé par CDP après le chargement et retiré avant tout setOffline.
  16  |  *
  17  |  * Les tests s'exécutent dans l'ordre du fichier (projet terrain, fullyParallel: false, --workers=1), sans mode
  18  |  * « serial » : un test rouge n'empêche pas les suivants, ni la mesure du scan (écrite avant ses assertions).
  19  |  * Les erreurs du navigateur sont imprimées et jointes au rapport, sans bloquer (aucun contrôle de ce type
  20  |  * n'est demandé par le contrat pour ce projet).
  21  |  *
  22  |  * Vague F (fix(7.7)) : marques et sélecteurs des écrans committés. Scanner (E3, fix(7.2e)) : écran « Commencer le
  23  |  * contrôle » seul (openScanner, support/terrain.ts : bouton radio de l'événement, plus de repli du lot 6),
  24  |  * `data-scan-state` = pending | slow (calque d'envoi), result (plein écran), offline (bandeau) ;
  25  |  * `data-scan-result` porté par le seul plein écran ; marques ev-scan:read, ev-scan:pending, ev-scan:result.
  26  |  * Billet hors ligne (E2, fix(7.1e)) : `data-ev-offline-state` de OfflineStatusBadge sur la carte (available,
  27  |  * missing, not_yet, offline_missing, expired), `data-ev-qr-payload` et `data-ev-qr-counter` de la page hors ligne.
  28  |  * Les assertions et les seuils sont inchangés.
  29  |  *
  30  |  * Lot 8 (contrat 15.4, T26) : tests 8 à 12, un par sujet, pour qu'un rouge attendu n'empêche pas de lire les tests 1 à 7 :
  31  |  *  8. barre d'achat fixe (8.2 s) ; 9. plein écran du scanner après défilement forcé (8.2 s) ; 10. taille réelle du lot
  32  |  *  hors ligne, [HORS-LIGNE-TRANSFERE] (8.2 x) ; 11. scan repris sans ligne en base (8.2 e) ; 12. écart de caisse sans stub
  33  |  *  (8.2 f). Vague F (T26) : expectResumed est dans support/parcours.ts, partagé avec la recette, sans changement.
  34  |  */
  35  | import type { Browser, BrowserContext, Locator, Page, Route, TestInfo } from '@playwright/test';
  36  | import { test, expect, openRoleContext } from './support/fixtures';
  37  | import type { RoleKey } from './support/accounts';
  38  | import { CDP_NO_THROTTLING, cdpNetworkConditions, NET_3G } from './support/devices';
  39  | import { PageGuard } from './support/network';
  40  | import { expectResumed } from './support/parcours';
  41  | import { serviceClient } from './support/service';
  42  | import {
  43  |     codeOf, computedPayload, describeProbe, expectBuyBarAnchored, fmtMs, forgedPayload, installScanProbe, livePayload, median, openScanner, percentile,
  44  |     prepareTerrainEvent, presentPayload, presentPayloadNoResult, probeTracks, probeVibrations, restoreTerrainSetting, scanMarks,
  45  |     ticketScans, appendPerfFile, writePerfFile, type ProbeRecord, type TerrainEvent,
  46  | } from './support/terrain';
  47  | 
  48  | const OFFLINE_PATH = '/billet/hors-ligne';
  49  | const OFFLINE_CACHE = 'ev-hors-ligne-lot7-1';
  50  | /** Contrat 5.3 : ressources publiques que le service worker peut mettre en cache. */
  51  | const PUBLIC_ASSETS = [
  52  |     '/manifest.json', '/favicon.ico', '/branding/event-village-mark.svg', '/icon-192x192.png', '/icon-512x512.png',
  53  |     '/icons/icon-maskable-512.png', '/icons/apple-touch-icon.png',
  54  | ];
  55  | /** D50 : motifs de vibration. */
  56  | const VIBRATION_ACCEPTE = [60];
  57  | const VIBRATION_REFUS = [120, 60, 120, 60, 120];
  58  | const REFUS = new Set(['invalid', 'qr_expired', 'cancelled', 'refunded', 'wrong_event', 'dynamic_qr_required', 'manual_entry_refused', 'payment_required', 'already_used']);
  59  | 
  60  | interface Opened { role: string; context: BrowserContext; page: Page; guard: PageGuard }
  61  | 
  62  | /** Contextes ouverts par un test, fermés et diagnostiqués dans son finally. */
  63  | class Session {
  64  |     readonly opened: Opened[] = [];
  65  | 
  66  |     constructor(private readonly browser: Browser, private readonly testInfo: TestInfo) {}
  67  | 
  68  |     async open(role: RoleKey, opts: { serviceWorkers?: 'allow'; clockOffsetMs?: number; probe?: boolean } = {}): Promise<Opened> {
  69  |         const context = await openRoleContext(this.browser, this.testInfo, role, role === 'fumee-controleur' ? 'sombre' : 'clair',
  70  |             opts.serviceWorkers ? { serviceWorkers: opts.serviceWorkers } : {});
  71  |         if (opts.probe) await context.addInitScript(installScanProbe);
  72  |         if (opts.clockOffsetMs !== undefined) await context.clock.install({ time: Date.now() + opts.clockOffsetMs });
  73  |         const page = await context.newPage();
  74  |         const o = { role, context, page, guard: new PageGuard(page) };
  75  |         this.opened.push(o);
  76  |         return o;
  77  |     }
  78  | 
  79  |     /** Page du porteur sur une ressource statique (aucun script de l'application) : origine des appels fetch. */
  80  |     async holder(role: RoleKey): Promise<Page> {
  81  |         const o = await this.open(role);
  82  |         await o.page.goto('/manifest.json');
  83  |         return o.page;
  84  |     }
  85  | 
  86  |     async close(): Promise<void> {
  87  |         const issues = this.opened.flatMap(({ role, guard }) => [...guard.blockingIssues(), ...guard.nonBlockingIssues()].map((i) => `${role} : ${i}`));
  88  |         if (issues.length > 0) {
  89  |             console.log(`[e2e][terrain] ${this.testInfo.title} — observations du navigateur (non bloquantes) :\n${issues.join('\n')}`);
  90  |             await this.testInfo.attach('navigateur.txt', { body: issues.join('\n'), contentType: 'text/plain' });
  91  |         }
  92  |         for (const o of this.opened) await o.context.close();
  93  |     }
  94  | }
  95  | 
  96  | /** Carte du billet dans Mes billets (repérée par son numéro). */
  97  | function ticketCard(page: Page, ticketNumber: string): Locator {
  98  |     return page.locator('li, article').filter({ hasText: ticketNumber }).last();
  99  | }
  100 | 
  101 | async function expectOfflineAvailable(page: Page, ticketNumber: string): Promise<void> {
  102 |     const card = ticketCard(page, ticketNumber);
  103 |     await expect(card, `carte du billet ${ticketNumber} dans Mes billets`).toBeVisible({ timeout: 45_000 });
  104 |     await expect(card.locator('[data-ev-offline-state]'),
  105 |         `indicateur hors ligne de la carte ${ticketNumber} (contrat 5.2) : « available » attendu après le téléchargement automatique`)
> 106 |         .toHaveAttribute('data-ev-offline-state', 'available', { timeout: 45_000 });
      |          ^ Error: indicateur hors ligne de la carte TCK-20261114-D9E91CC19A (contrat 5.2) : « available » attendu après le téléchargement automatique
  107 | }
  108 | 
  109 | /** Scanne un payload et exige `[data-scan-result=<attendu>]` affiché. */
  110 | async function scanAndExpect(ctl: Page, payload: string, what: string, expected: string): Promise<ProbeRecord> {
  111 |     const { record } = await presentPayload(ctl, payload, what);
  112 |     await expect(ctl.locator(`[data-scan-result="${expected}"]`).first(), `${what} : résultat « ${expected} » attendu (sonde : « ${record.result ?? '—'} »)`).toBeVisible();
  113 |     return record;
  114 | }
  115 | 
  116 | // ── 1. Écart d'horloge ±5 min ─────────────────────────────────────────────
  117 | 
  118 | for (const [label, offsetMin] of [['en avance de 5 min', 5], ['en retard de 5 min', -5]] as const) {
  119 |     test(`1. téléphone ${label} : codes téléchargés, hors ligne, QR accepté par le contrôleur`, async ({ browser }, testInfo) => {
  120 |         test.setTimeout(5 * 60_000);
  121 |         const s = new Session(browser, testInfo);
  122 |         let ev: TerrainEvent | null = null;
  123 |         try {
  124 |             ev = prepareTerrainEvent(`écart ${offsetMin > 0 ? '+' : ''}${offsetMin} min`, 'client', 1);
  125 |             const ticket = ev.tickets[0];
  126 |             const client = await s.open('fumee-client', { serviceWorkers: 'allow', clockOffsetMs: offsetMin * 60_000 });
  127 |             await client.page.goto('/tickets');
  128 |             await expectOfflineAvailable(client.page, ticket.number);
  129 | 
  130 |             await client.context.setOffline(true);
  131 |             client.guard.freeze(); // passage hors ligne volontaire : la collecte d'erreurs s'arrête
  132 |             const res = await client.page.goto(`${OFFLINE_PATH}?id=${ticket.id}`);
  133 |             expect(res?.fromServiceWorker(), `${OFFLINE_PATH} hors ligne : réponse servie par le service worker`).toBe(true);
  134 |             const qr = client.page.locator('[data-ev-qr-payload]');
  135 |             await expect(qr, 'QR du billet affiché hors ligne (data-ev-qr-payload)').toBeVisible({ timeout: 20_000 });
  136 |             const payload = String(await qr.getAttribute('data-ev-qr-payload'));
  137 |             expect(payload, 'payload du QR hors ligne : <préfixe>:<billet>:<6 chiffres>').toMatch(new RegExp(`:${ticket.id}:\\d{6}$`));
  138 | 
  139 |             const ctl = await s.open('fumee-controleur', { probe: true });
  140 |             await openScanner(ctl.page, ev.title);
  141 |             await scanAndExpect(ctl.page, payload, `code affiché par un téléphone ${label}`, 'valid');
  142 |             const db = ticketScans(ticket.id);
  143 |             expect(db.ticket.status, `billet ${ticket.number} composté`).toBe('UTILISE');
  144 |             expect(db.scans.filter((r) => r.accepted).length, `une seule entrée acceptée : ${JSON.stringify(db.scans)}`).toBe(1);
  145 |         } finally {
  146 |             await s.close();
  147 |             restoreTerrainSetting(ev);
  148 |         }
  149 |     });
  150 | }
  151 | 
  152 | // ── 2. Cache du service worker sans /api/ ──────────────────────────────────
  153 | 
  154 | test('2. cache du service worker : coquille hors ligne et ressources statiques seulement, anciens caches supprimés', async ({ browser }, testInfo) => {
  155 |     test.setTimeout(4 * 60_000);
  156 |     const s = new Session(browser, testInfo);
  157 |     let ev: TerrainEvent | null = null;
  158 |     try {
  159 |         ev = prepareTerrainEvent('cache sans api', 'client', 1);
  160 |         const ticket = ev.tickets[0];
  161 |         const client = await s.open('fumee-client', { serviceWorkers: 'allow' });
  162 |         const servedApi: string[] = [];
  163 |         client.page.on('response', (r) => {
  164 |             if (r.fromServiceWorker() && new URL(r.url()).pathname.startsWith('/api/')) servedApi.push(`${r.status()} ${r.url()}`);
  165 |         });
  166 | 
  167 |         // Anciens caches créés avant tout enregistrement (page statique : aucun script de l'application)
  168 |         await client.page.goto('/manifest.json');
  169 |         const before = await client.page.evaluate(async () => {
  170 |             const registrations = (await navigator.serviceWorker.getRegistrations()).length;
  171 |             for (const name of ['event-village-v1', 'ev-hors-ligne-ancien']) {
  172 |                 const cache = await caches.open(name);
  173 |                 await cache.put('/__e2e-ancien', new Response('ancien cache du projet terrain'));
  174 |             }
  175 |             return { registrations, keys: (await caches.keys()).sort() };
  176 |         });
  177 |         expect(before, 'anciens caches posés avant l’enregistrement du service worker').toEqual({ registrations: 0, keys: ['ev-hors-ligne-ancien', 'event-village-v1'] });
  178 | 
  179 |         await client.page.goto('/tickets');
  180 |         await client.page.waitForFunction(async () => {
  181 |             const reg = await navigator.serviceWorker.getRegistration('/');
  182 |             return reg?.active?.state === 'activated';
  183 |         }, null, { timeout: 30_000 });
  184 |         await expect.poll(() => client.page.evaluate(async () => (await caches.keys()).sort()), {
  185 |             message: `caches après l’activation : seul ${OFFLINE_CACHE} attendu (event-village-v1 et ev-hors-ligne-ancien supprimés)`, timeout: 30_000,
  186 |         }).toEqual([OFFLINE_CACHE]);
  187 |         await expectOfflineAvailable(client.page, ticket.number);
  188 | 
  189 |         const urls = await client.page.evaluate(async (name) => (await (await caches.open(name)).keys()).map((r) => r.url), OFFLINE_CACHE);
  190 |         const paths = urls.map((u) => new URL(u));
  191 |         const outside = paths.filter((u) => !(u.pathname === OFFLINE_PATH || u.pathname.startsWith('/_next/static/') || PUBLIC_ASSETS.includes(u.pathname)));
  192 |         const forbidden = paths.filter((u) => u.pathname.startsWith('/api/') || u.searchParams.has('_rsc'));
  193 |         console.log(`[e2e][terrain] cache ${OFFLINE_CACHE} : ${urls.length} entrée(s)\n${urls.join('\n')}`);
  194 |         expect(forbidden.map(String), 'aucune réponse /api/ ni charge _rsc en cache').toEqual([]);
  195 |         expect(outside.map(String), `cache limité à ${OFFLINE_PATH}, /_next/static/ et aux ressources publiques du contrat 5.3`).toEqual([]);
  196 |         expect(paths.some((u) => u.pathname === OFFLINE_PATH), `coquille ${OFFLINE_PATH} en cache`).toBe(true);
  197 |         expect(paths.some((u) => u.pathname.startsWith('/_next/static/')), 'ressources /_next/static/ de la coquille en cache').toBe(true);
  198 |         expect(servedApi, 'aucune réponse /api/ servie par le service worker').toEqual([]);
  199 | 
  200 |         await client.context.setOffline(true);
  201 |         client.guard.freeze();
  202 |         const outcome = await client.page.evaluate(async (id) => {
  203 |             try {
  204 |                 const r = await fetch(`/api/tickets/${id}/offline-codes`, { cache: 'no-store' });
  205 |                 return `servi (HTTP ${r.status})`;
  206 |             } catch (err) {
```