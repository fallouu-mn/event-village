# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: terrain.spec.ts >> 1. téléphone en avance de 5 min : codes téléchargés, hors ligne, QR accepté par le contrôleur
- Location: e2e/terrain.spec.ts:102:9

# Error details

```
Error: indicateur hors ligne de la carte TCK-20261104-669C17099D (contrat 5.2) : « available » attendu après le téléchargement automatique

expect(locator).toHaveAttribute(expected) failed

Locator: locator('li, article').filter({ hasText: 'TCK-20261104-669C17099D' }).last().locator('[data-ev-offline-state]')
Expected: "available"
Timeout: 45000ms
Error: element(s) not found

Call log:
  - indicateur hors ligne de la carte TCK-20261104-669C17099D (contrat 5.2) : « available » attendu après le téléchargement automatique locator('li, article').filter({ hasText: 'TCK-20261104-669C17099D' }).last().locator('[data-ev-offline-state]') with timeout 45000ms
  - waiting for locator('li, article').filter({ hasText: 'TCK-20261104-669C17099D' }).last().locator('[data-ev-offline-state]')

```

```yaml
- banner:
  - button "Ouvrir le menu"
  - link "Event Village, accueil":
    - /url: /
  - button "Notifications, 6 non lues": "6"
  - button "Basculer le thème"
  - link "Mon profil (Awa Client)":
    - /url: /profile
- main:
  - status: En direct
  - heading "Mes billets" [level=1]
  - paragraph: "Présentez le QR code de votre billet à l’entrée. Il se renouvelle tout seul : gardez la page ouverte."
  - button "Comment marche le transfert ?"
  - link "Réserver un billet":
    - /url: /explore
  - tablist "Filtrer mes billets":
    - tab "À venir" [selected]
    - tab "Tous mes billets"
    - tab "Historique"
    - tab "Reçus"
  - tabpanel "À venir":
    - list:
      - listitem:
        - article "Billet pour Terrain — écart +5 min 06.55.28":
          - text: Valable
          - heading "Terrain — écart +5 min 06.55.28" [level=2]
          - paragraph: Orga A (test)
          - term: Date
          - definition: 05 NOV 2026
          - term: Heure d’accès
          - definition: 02:55
          - term: Lieu
          - definition: Esplanade des Parcelles Assainies
          - term: Emplacement
          - definition: Entrée libre
          - img "QR d’entrée dynamique"
          - paragraph: "Numéro du billet : TCK-20261104-669C17099D"
          - text: Code renouvelé toutes les 20 s Nouveau code dans 7 secondes
          - paragraph: Une capture d’écran n’est pas acceptée au contrôle.
          - paragraph: "Sans téléphone : numéro du billet et pièce d’identité au contrôle."
          - paragraph: Billet authentique, émis par Event Village
          - paragraph: Présentez ce code au contrôle, billet ouvert dans l’application.
          - button "Transférer"
          - button "Partager le lien de l’événement sur WhatsApp": WhatsApp
          - button "Partager ou copier le lien de l’événement": Lien
          - button "Télécharger le billet en PDF": PDF
          - button "Aide au transfert"
      - listitem:
        - article "Billet pour TEST Concert A (publié, à venir)":
          - text: Valable
          - heading "TEST Concert A (publié, à venir)" [level=2]
          - paragraph: Orga A (test)
          - term: Date
          - definition: 04 DÉC 2026
          - term: Heure d’accès
          - definition: 20:00
          - term: Lieu
          - definition: Salle de test, Dakar
          - term: Emplacement
          - definition: Standard
          - img "QR d’entrée dynamique"
          - paragraph: "Numéro du billet : TCK-FIXTURE-CLIENT-A-1"
          - text: Code renouvelé toutes les 20 s Nouveau code dans 7 secondes
          - paragraph: Une capture d’écran n’est pas acceptée au contrôle.
          - paragraph: "Sans téléphone : numéro du billet et pièce d’identité au contrôle."
          - paragraph: Billet authentique, émis par Event Village
          - paragraph: Présentez ce code au contrôle, billet ouvert dans l’application.
          - button "Transférer"
          - button "Partager le lien de l’événement sur WhatsApp": WhatsApp
          - button "Partager ou copier le lien de l’événement": Lien
          - button "Télécharger le billet en PDF": PDF
          - button "Aide au transfert"
- navigation "Navigation rapide":
  - link "Accueil":
    - /url: /
  - link "Explorer":
    - /url: /explore
  - link "Billets":
    - /url: /tickets
  - link "Achats":
    - /url: /orders
  - link "Solde":
    - /url: /wallet
- alert
```

# Test source

```ts
  1   | /**
  2   |  * Lot 7 (contrat, section 11.5 ; tâches 7.1 et 7.2) — projet Playwright « terrain » : billet hors ligne avec le
  3   |  * service worker et scanner du contrôleur, sur l'application démarrée (next start) et la base locale seedée.
  4   |  *
  5   |  * Données : chaque test prépare son propre événement par scripts/e2e/terrain-setup.ts (partenaire A du seed de
  6   |  * test, début à ≈ 20 h de l'heure réelle, billets gratuits émis par free_tickets_claim, contrôleur A affecté) et
  7   |  * pose `access.scan_window_before_hours = 24` (D6), remis dans un finally. Aucune route n'accepte d'heure.
  8   |  * Comptes : fumee-client (porteur des billets présentés hors ligne), fumee-client-bis (porteur des billets
  9   |  * scannés en série, lus par sa route live-code), fumee-controleur (scanner).
  10  |  *
  11  |  * Contextes : service worker autorisé seulement pour le client (`serviceWorkers: 'allow'`, D7) ; horloge
  12  |  * installée seulement dans le contexte du client du test 1 (jamais chez le contrôleur ni pendant une mesure :
  13  |  * marques factices sinon). Le réseau 3G est posé par CDP après le chargement et retiré avant tout setOffline.
  14  |  *
  15  |  * Les tests s'exécutent dans l'ordre du fichier (projet terrain, fullyParallel: false, --workers=1), sans mode
  16  |  * « serial » : un test rouge n'empêche pas les suivants, ni la mesure du scan (écrite avant ses assertions).
  17  |  * Les erreurs du navigateur sont imprimées et jointes au rapport, sans bloquer (aucun contrôle de ce type
  18  |  * n'est demandé par le contrat pour ce projet).
  19  |  */
  20  | import type { Browser, BrowserContext, Locator, Page, TestInfo } from '@playwright/test';
  21  | import { test, expect, openRoleContext } from './support/fixtures';
  22  | import type { RoleKey } from './support/accounts';
  23  | import { CDP_NO_THROTTLING, cdpNetworkConditions, NET_3G } from './support/devices';
  24  | import { PageGuard } from './support/network';
  25  | import {
  26  |     fmtMs, forgedPayload, installScanProbe, livePayload, median, openScanner, percentile, prepareTerrainEvent,
  27  |     presentPayload, presentPayloadNoResult, probeTracks, probeVibrations, restoreTerrainSetting, scanMarks, ticketScans,
  28  |     writePerfFile, type ProbeRecord, type TerrainEvent,
  29  | } from './support/terrain';
  30  | 
  31  | const OFFLINE_PATH = '/billet/hors-ligne';
  32  | const OFFLINE_CACHE = 'ev-hors-ligne-lot7-1';
  33  | /** Contrat 5.3 : ressources publiques que le service worker peut mettre en cache. */
  34  | const PUBLIC_ASSETS = [
  35  |     '/manifest.json', '/favicon.ico', '/branding/event-village-mark.svg', '/icon-192x192.png', '/icon-512x512.png',
  36  |     '/icons/icon-maskable-512.png', '/icons/apple-touch-icon.png',
  37  | ];
  38  | /** D50 : motifs de vibration. */
  39  | const VIBRATION_ACCEPTE = [60];
  40  | const VIBRATION_REFUS = [120, 60, 120, 60, 120];
  41  | const REFUS = new Set(['invalid', 'qr_expired', 'cancelled', 'refunded', 'wrong_event', 'dynamic_qr_required', 'manual_entry_refused', 'payment_required', 'already_used']);
  42  | 
  43  | interface Opened { role: string; context: BrowserContext; page: Page; guard: PageGuard }
  44  | 
  45  | /** Contextes ouverts par un test, fermés et diagnostiqués dans son finally. */
  46  | class Session {
  47  |     readonly opened: Opened[] = [];
  48  | 
  49  |     constructor(private readonly browser: Browser, private readonly testInfo: TestInfo) {}
  50  | 
  51  |     async open(role: RoleKey, opts: { serviceWorkers?: 'allow'; clockOffsetMs?: number; probe?: boolean } = {}): Promise<Opened> {
  52  |         const context = await openRoleContext(this.browser, this.testInfo, role, role === 'fumee-controleur' ? 'sombre' : 'clair',
  53  |             opts.serviceWorkers ? { serviceWorkers: opts.serviceWorkers } : {});
  54  |         if (opts.probe) await context.addInitScript(installScanProbe);
  55  |         if (opts.clockOffsetMs !== undefined) await context.clock.install({ time: Date.now() + opts.clockOffsetMs });
  56  |         const page = await context.newPage();
  57  |         const o = { role, context, page, guard: new PageGuard(page) };
  58  |         this.opened.push(o);
  59  |         return o;
  60  |     }
  61  | 
  62  |     /** Page du porteur sur une ressource statique (aucun script de l'application) : origine des appels fetch. */
  63  |     async holder(role: RoleKey): Promise<Page> {
  64  |         const o = await this.open(role);
  65  |         await o.page.goto('/manifest.json');
  66  |         return o.page;
  67  |     }
  68  | 
  69  |     async close(): Promise<void> {
  70  |         const issues = this.opened.flatMap(({ role, guard }) => [...guard.blockingIssues(), ...guard.nonBlockingIssues()].map((i) => `${role} : ${i}`));
  71  |         if (issues.length > 0) {
  72  |             console.log(`[e2e][terrain] ${this.testInfo.title} — observations du navigateur (non bloquantes) :\n${issues.join('\n')}`);
  73  |             await this.testInfo.attach('navigateur.txt', { body: issues.join('\n'), contentType: 'text/plain' });
  74  |         }
  75  |         for (const o of this.opened) await o.context.close();
  76  |     }
  77  | }
  78  | 
  79  | /** Carte du billet dans Mes billets (repérée par son numéro). */
  80  | function ticketCard(page: Page, ticketNumber: string): Locator {
  81  |     return page.locator('li, article').filter({ hasText: ticketNumber }).last();
  82  | }
  83  | 
  84  | async function expectOfflineAvailable(page: Page, ticketNumber: string): Promise<void> {
  85  |     const card = ticketCard(page, ticketNumber);
  86  |     await expect(card, `carte du billet ${ticketNumber} dans Mes billets`).toBeVisible({ timeout: 45_000 });
  87  |     await expect(card.locator('[data-ev-offline-state]'),
  88  |         `indicateur hors ligne de la carte ${ticketNumber} (contrat 5.2) : « available » attendu après le téléchargement automatique`)
> 89  |         .toHaveAttribute('data-ev-offline-state', 'available', { timeout: 45_000 });
      |          ^ Error: indicateur hors ligne de la carte TCK-20261104-669C17099D (contrat 5.2) : « available » attendu après le téléchargement automatique
  90  | }
  91  | 
  92  | /** Scanne un payload et exige `[data-scan-result=<attendu>]` affiché. */
  93  | async function scanAndExpect(ctl: Page, payload: string, what: string, expected: string): Promise<ProbeRecord> {
  94  |     const { record } = await presentPayload(ctl, payload, what);
  95  |     await expect(ctl.locator(`[data-scan-result="${expected}"]`).first(), `${what} : résultat « ${expected} » attendu (sonde : « ${record.result ?? '—'} »)`).toBeVisible();
  96  |     return record;
  97  | }
  98  | 
  99  | // ── 1. Écart d'horloge ±5 min ─────────────────────────────────────────────
  100 | 
  101 | for (const [label, offsetMin] of [['en avance de 5 min', 5], ['en retard de 5 min', -5]] as const) {
  102 |     test(`1. téléphone ${label} : codes téléchargés, hors ligne, QR accepté par le contrôleur`, async ({ browser }, testInfo) => {
  103 |         test.setTimeout(5 * 60_000);
  104 |         const s = new Session(browser, testInfo);
  105 |         let ev: TerrainEvent | null = null;
  106 |         try {
  107 |             ev = prepareTerrainEvent(`écart ${offsetMin > 0 ? '+' : ''}${offsetMin} min`, 'client', 1);
  108 |             const ticket = ev.tickets[0];
  109 |             const client = await s.open('fumee-client', { serviceWorkers: 'allow', clockOffsetMs: offsetMin * 60_000 });
  110 |             await client.page.goto('/tickets');
  111 |             await expectOfflineAvailable(client.page, ticket.number);
  112 | 
  113 |             await client.context.setOffline(true);
  114 |             client.guard.freeze(); // passage hors ligne volontaire : la collecte d'erreurs s'arrête
  115 |             const res = await client.page.goto(`${OFFLINE_PATH}?id=${ticket.id}`);
  116 |             expect(res?.fromServiceWorker(), `${OFFLINE_PATH} hors ligne : réponse servie par le service worker`).toBe(true);
  117 |             const qr = client.page.locator('[data-ev-qr-payload]');
  118 |             await expect(qr, 'QR du billet affiché hors ligne (data-ev-qr-payload)').toBeVisible({ timeout: 20_000 });
  119 |             const payload = String(await qr.getAttribute('data-ev-qr-payload'));
  120 |             expect(payload, 'payload du QR hors ligne : <préfixe>:<billet>:<6 chiffres>').toMatch(new RegExp(`:${ticket.id}:\\d{6}$`));
  121 | 
  122 |             const ctl = await s.open('fumee-controleur', { probe: true });
  123 |             await openScanner(ctl.page, ev.title);
  124 |             await scanAndExpect(ctl.page, payload, `code affiché par un téléphone ${label}`, 'valid');
  125 |             const db = ticketScans(ticket.id);
  126 |             expect(db.ticket.status, `billet ${ticket.number} composté`).toBe('UTILISE');
  127 |             expect(db.scans.filter((r) => r.accepted).length, `une seule entrée acceptée : ${JSON.stringify(db.scans)}`).toBe(1);
  128 |         } finally {
  129 |             await s.close();
  130 |             restoreTerrainSetting(ev);
  131 |         }
  132 |     });
  133 | }
  134 | 
  135 | // ── 2. Cache du service worker sans /api/ ──────────────────────────────────
  136 | 
  137 | test('2. cache du service worker : coquille hors ligne et ressources statiques seulement, anciens caches supprimés', async ({ browser }, testInfo) => {
  138 |     test.setTimeout(4 * 60_000);
  139 |     const s = new Session(browser, testInfo);
  140 |     let ev: TerrainEvent | null = null;
  141 |     try {
  142 |         ev = prepareTerrainEvent('cache sans api', 'client', 1);
  143 |         const ticket = ev.tickets[0];
  144 |         const client = await s.open('fumee-client', { serviceWorkers: 'allow' });
  145 |         const servedApi: string[] = [];
  146 |         client.page.on('response', (r) => {
  147 |             if (r.fromServiceWorker() && new URL(r.url()).pathname.startsWith('/api/')) servedApi.push(`${r.status()} ${r.url()}`);
  148 |         });
  149 | 
  150 |         // Anciens caches créés avant tout enregistrement (page statique : aucun script de l'application)
  151 |         await client.page.goto('/manifest.json');
  152 |         const before = await client.page.evaluate(async () => {
  153 |             const registrations = (await navigator.serviceWorker.getRegistrations()).length;
  154 |             for (const name of ['event-village-v1', 'ev-hors-ligne-ancien']) {
  155 |                 const cache = await caches.open(name);
  156 |                 await cache.put('/__e2e-ancien', new Response('ancien cache du projet terrain'));
  157 |             }
  158 |             return { registrations, keys: (await caches.keys()).sort() };
  159 |         });
  160 |         expect(before, 'anciens caches posés avant l’enregistrement du service worker').toEqual({ registrations: 0, keys: ['ev-hors-ligne-ancien', 'event-village-v1'] });
  161 | 
  162 |         await client.page.goto('/tickets');
  163 |         await client.page.waitForFunction(async () => {
  164 |             const reg = await navigator.serviceWorker.getRegistration('/');
  165 |             return reg?.active?.state === 'activated';
  166 |         }, null, { timeout: 30_000 });
  167 |         await expect.poll(() => client.page.evaluate(async () => (await caches.keys()).sort()), {
  168 |             message: `caches après l’activation : seul ${OFFLINE_CACHE} attendu (event-village-v1 et ev-hors-ligne-ancien supprimés)`, timeout: 30_000,
  169 |         }).toEqual([OFFLINE_CACHE]);
  170 |         await expectOfflineAvailable(client.page, ticket.number);
  171 | 
  172 |         const urls = await client.page.evaluate(async (name) => (await (await caches.open(name)).keys()).map((r) => r.url), OFFLINE_CACHE);
  173 |         const paths = urls.map((u) => new URL(u));
  174 |         const outside = paths.filter((u) => !(u.pathname === OFFLINE_PATH || u.pathname.startsWith('/_next/static/') || PUBLIC_ASSETS.includes(u.pathname)));
  175 |         const forbidden = paths.filter((u) => u.pathname.startsWith('/api/') || u.searchParams.has('_rsc'));
  176 |         console.log(`[e2e][terrain] cache ${OFFLINE_CACHE} : ${urls.length} entrée(s)\n${urls.join('\n')}`);
  177 |         expect(forbidden.map(String), 'aucune réponse /api/ ni charge _rsc en cache').toEqual([]);
  178 |         expect(outside.map(String), `cache limité à ${OFFLINE_PATH}, /_next/static/ et aux ressources publiques du contrat 5.3`).toEqual([]);
  179 |         expect(paths.some((u) => u.pathname === OFFLINE_PATH), `coquille ${OFFLINE_PATH} en cache`).toBe(true);
  180 |         expect(paths.some((u) => u.pathname.startsWith('/_next/static/')), 'ressources /_next/static/ de la coquille en cache').toBe(true);
  181 |         expect(servedApi, 'aucune réponse /api/ servie par le service worker').toEqual([]);
  182 | 
  183 |         await client.context.setOffline(true);
  184 |         client.guard.freeze();
  185 |         const outcome = await client.page.evaluate(async (id) => {
  186 |             try {
  187 |                 const r = await fetch(`/api/tickets/${id}/offline-codes`, { cache: 'no-store' });
  188 |                 return `servi (HTTP ${r.status})`;
  189 |             } catch (err) {
```