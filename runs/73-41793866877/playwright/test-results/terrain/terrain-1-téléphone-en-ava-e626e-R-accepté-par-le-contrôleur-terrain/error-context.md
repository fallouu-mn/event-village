# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: terrain.spec.ts >> 1. téléphone en avance de 5 min : codes téléchargés, hors ligne, QR accepté par le contrôleur
- Location: e2e/terrain.spec.ts:104:9

# Error details

```
Error: indicateur hors ligne de la carte TCK-20261104-1D183C4E13 (contrat 5.2) : « available » attendu après le téléchargement automatique

expect(locator).toHaveAttribute(expected) failed

Locator: locator('li, article').filter({ hasText: 'TCK-20261104-1D183C4E13' }).last().locator('[data-ev-offline-state]')
Expected: "available"
Timeout: 45000ms
Error: element(s) not found

Call log:
  - indicateur hors ligne de la carte TCK-20261104-1D183C4E13 (contrat 5.2) : « available » attendu après le téléchargement automatique locator('li, article').filter({ hasText: 'TCK-20261104-1D183C4E13' }).last().locator('[data-ev-offline-state]') with timeout 45000ms
  - waiting for locator('li, article').filter({ hasText: 'TCK-20261104-1D183C4E13' }).last().locator('[data-ev-offline-state]')

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
        - article "Billet pour Terrain — écart +5 min 08.16.41":
          - text: Valable
          - heading "Terrain — écart +5 min 08.16.41" [level=2]
          - paragraph: Orga A (test)
          - term: Date
          - definition: 05 NOV 2026
          - term: Heure d’accès
          - definition: 04:20
          - term: Lieu
          - definition: Esplanade des Parcelles Assainies
          - term: Emplacement
          - definition: Entrée libre
          - img "QR d’entrée dynamique"
          - paragraph: "Numéro du billet : TCK-20261104-1D183C4E13"
          - text: Code renouvelé toutes les 20 s Nouveau code dans 14 secondes
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
          - text: Code renouvelé toutes les 20 s Nouveau code dans 14 secondes
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
  21  |  */
  22  | import type { Browser, BrowserContext, Locator, Page, TestInfo } from '@playwright/test';
  23  | import { test, expect, openRoleContext } from './support/fixtures';
  24  | import type { RoleKey } from './support/accounts';
  25  | import { CDP_NO_THROTTLING, cdpNetworkConditions, NET_3G } from './support/devices';
  26  | import { PageGuard } from './support/network';
  27  | import {
  28  |     codeOf, computedPayload, describeProbe, fmtMs, forgedPayload, installScanProbe, livePayload, median, openScanner, percentile,
  29  |     prepareTerrainEvent, presentPayload, presentPayloadNoResult, probeTracks, probeVibrations, restoreTerrainSetting, scanMarks,
  30  |     ticketScans, writePerfFile, type ProbeRecord, type TerrainEvent,
  31  | } from './support/terrain';
  32  | 
  33  | const OFFLINE_PATH = '/billet/hors-ligne';
  34  | const OFFLINE_CACHE = 'ev-hors-ligne-lot7-1';
  35  | /** Contrat 5.3 : ressources publiques que le service worker peut mettre en cache. */
  36  | const PUBLIC_ASSETS = [
  37  |     '/manifest.json', '/favicon.ico', '/branding/event-village-mark.svg', '/icon-192x192.png', '/icon-512x512.png',
  38  |     '/icons/icon-maskable-512.png', '/icons/apple-touch-icon.png',
  39  | ];
  40  | /** D50 : motifs de vibration. */
  41  | const VIBRATION_ACCEPTE = [60];
  42  | const VIBRATION_REFUS = [120, 60, 120, 60, 120];
  43  | const REFUS = new Set(['invalid', 'qr_expired', 'cancelled', 'refunded', 'wrong_event', 'dynamic_qr_required', 'manual_entry_refused', 'payment_required', 'already_used']);
  44  | 
  45  | interface Opened { role: string; context: BrowserContext; page: Page; guard: PageGuard }
  46  | 
  47  | /** Contextes ouverts par un test, fermés et diagnostiqués dans son finally. */
  48  | class Session {
  49  |     readonly opened: Opened[] = [];
  50  | 
  51  |     constructor(private readonly browser: Browser, private readonly testInfo: TestInfo) {}
  52  | 
  53  |     async open(role: RoleKey, opts: { serviceWorkers?: 'allow'; clockOffsetMs?: number; probe?: boolean } = {}): Promise<Opened> {
  54  |         const context = await openRoleContext(this.browser, this.testInfo, role, role === 'fumee-controleur' ? 'sombre' : 'clair',
  55  |             opts.serviceWorkers ? { serviceWorkers: opts.serviceWorkers } : {});
  56  |         if (opts.probe) await context.addInitScript(installScanProbe);
  57  |         if (opts.clockOffsetMs !== undefined) await context.clock.install({ time: Date.now() + opts.clockOffsetMs });
  58  |         const page = await context.newPage();
  59  |         const o = { role, context, page, guard: new PageGuard(page) };
  60  |         this.opened.push(o);
  61  |         return o;
  62  |     }
  63  | 
  64  |     /** Page du porteur sur une ressource statique (aucun script de l'application) : origine des appels fetch. */
  65  |     async holder(role: RoleKey): Promise<Page> {
  66  |         const o = await this.open(role);
  67  |         await o.page.goto('/manifest.json');
  68  |         return o.page;
  69  |     }
  70  | 
  71  |     async close(): Promise<void> {
  72  |         const issues = this.opened.flatMap(({ role, guard }) => [...guard.blockingIssues(), ...guard.nonBlockingIssues()].map((i) => `${role} : ${i}`));
  73  |         if (issues.length > 0) {
  74  |             console.log(`[e2e][terrain] ${this.testInfo.title} — observations du navigateur (non bloquantes) :\n${issues.join('\n')}`);
  75  |             await this.testInfo.attach('navigateur.txt', { body: issues.join('\n'), contentType: 'text/plain' });
  76  |         }
  77  |         for (const o of this.opened) await o.context.close();
  78  |     }
  79  | }
  80  | 
  81  | /** Carte du billet dans Mes billets (repérée par son numéro). */
  82  | function ticketCard(page: Page, ticketNumber: string): Locator {
  83  |     return page.locator('li, article').filter({ hasText: ticketNumber }).last();
  84  | }
  85  | 
  86  | async function expectOfflineAvailable(page: Page, ticketNumber: string): Promise<void> {
  87  |     const card = ticketCard(page, ticketNumber);
  88  |     await expect(card, `carte du billet ${ticketNumber} dans Mes billets`).toBeVisible({ timeout: 45_000 });
  89  |     await expect(card.locator('[data-ev-offline-state]'),
  90  |         `indicateur hors ligne de la carte ${ticketNumber} (contrat 5.2) : « available » attendu après le téléchargement automatique`)
> 91  |         .toHaveAttribute('data-ev-offline-state', 'available', { timeout: 45_000 });
      |          ^ Error: indicateur hors ligne de la carte TCK-20261104-1D183C4E13 (contrat 5.2) : « available » attendu après le téléchargement automatique
  92  | }
  93  | 
  94  | /** Scanne un payload et exige `[data-scan-result=<attendu>]` affiché. */
  95  | async function scanAndExpect(ctl: Page, payload: string, what: string, expected: string): Promise<ProbeRecord> {
  96  |     const { record } = await presentPayload(ctl, payload, what);
  97  |     await expect(ctl.locator(`[data-scan-result="${expected}"]`).first(), `${what} : résultat « ${expected} » attendu (sonde : « ${record.result ?? '—'} »)`).toBeVisible();
  98  |     return record;
  99  | }
  100 | 
  101 | // ── 1. Écart d'horloge ±5 min ─────────────────────────────────────────────
  102 | 
  103 | for (const [label, offsetMin] of [['en avance de 5 min', 5], ['en retard de 5 min', -5]] as const) {
  104 |     test(`1. téléphone ${label} : codes téléchargés, hors ligne, QR accepté par le contrôleur`, async ({ browser }, testInfo) => {
  105 |         test.setTimeout(5 * 60_000);
  106 |         const s = new Session(browser, testInfo);
  107 |         let ev: TerrainEvent | null = null;
  108 |         try {
  109 |             ev = prepareTerrainEvent(`écart ${offsetMin > 0 ? '+' : ''}${offsetMin} min`, 'client', 1);
  110 |             const ticket = ev.tickets[0];
  111 |             const client = await s.open('fumee-client', { serviceWorkers: 'allow', clockOffsetMs: offsetMin * 60_000 });
  112 |             await client.page.goto('/tickets');
  113 |             await expectOfflineAvailable(client.page, ticket.number);
  114 | 
  115 |             await client.context.setOffline(true);
  116 |             client.guard.freeze(); // passage hors ligne volontaire : la collecte d'erreurs s'arrête
  117 |             const res = await client.page.goto(`${OFFLINE_PATH}?id=${ticket.id}`);
  118 |             expect(res?.fromServiceWorker(), `${OFFLINE_PATH} hors ligne : réponse servie par le service worker`).toBe(true);
  119 |             const qr = client.page.locator('[data-ev-qr-payload]');
  120 |             await expect(qr, 'QR du billet affiché hors ligne (data-ev-qr-payload)').toBeVisible({ timeout: 20_000 });
  121 |             const payload = String(await qr.getAttribute('data-ev-qr-payload'));
  122 |             expect(payload, 'payload du QR hors ligne : <préfixe>:<billet>:<6 chiffres>').toMatch(new RegExp(`:${ticket.id}:\\d{6}$`));
  123 | 
  124 |             const ctl = await s.open('fumee-controleur', { probe: true });
  125 |             await openScanner(ctl.page, ev.title);
  126 |             await scanAndExpect(ctl.page, payload, `code affiché par un téléphone ${label}`, 'valid');
  127 |             const db = ticketScans(ticket.id);
  128 |             expect(db.ticket.status, `billet ${ticket.number} composté`).toBe('UTILISE');
  129 |             expect(db.scans.filter((r) => r.accepted).length, `une seule entrée acceptée : ${JSON.stringify(db.scans)}`).toBe(1);
  130 |         } finally {
  131 |             await s.close();
  132 |             restoreTerrainSetting(ev);
  133 |         }
  134 |     });
  135 | }
  136 | 
  137 | // ── 2. Cache du service worker sans /api/ ──────────────────────────────────
  138 | 
  139 | test('2. cache du service worker : coquille hors ligne et ressources statiques seulement, anciens caches supprimés', async ({ browser }, testInfo) => {
  140 |     test.setTimeout(4 * 60_000);
  141 |     const s = new Session(browser, testInfo);
  142 |     let ev: TerrainEvent | null = null;
  143 |     try {
  144 |         ev = prepareTerrainEvent('cache sans api', 'client', 1);
  145 |         const ticket = ev.tickets[0];
  146 |         const client = await s.open('fumee-client', { serviceWorkers: 'allow' });
  147 |         const servedApi: string[] = [];
  148 |         client.page.on('response', (r) => {
  149 |             if (r.fromServiceWorker() && new URL(r.url()).pathname.startsWith('/api/')) servedApi.push(`${r.status()} ${r.url()}`);
  150 |         });
  151 | 
  152 |         // Anciens caches créés avant tout enregistrement (page statique : aucun script de l'application)
  153 |         await client.page.goto('/manifest.json');
  154 |         const before = await client.page.evaluate(async () => {
  155 |             const registrations = (await navigator.serviceWorker.getRegistrations()).length;
  156 |             for (const name of ['event-village-v1', 'ev-hors-ligne-ancien']) {
  157 |                 const cache = await caches.open(name);
  158 |                 await cache.put('/__e2e-ancien', new Response('ancien cache du projet terrain'));
  159 |             }
  160 |             return { registrations, keys: (await caches.keys()).sort() };
  161 |         });
  162 |         expect(before, 'anciens caches posés avant l’enregistrement du service worker').toEqual({ registrations: 0, keys: ['ev-hors-ligne-ancien', 'event-village-v1'] });
  163 | 
  164 |         await client.page.goto('/tickets');
  165 |         await client.page.waitForFunction(async () => {
  166 |             const reg = await navigator.serviceWorker.getRegistration('/');
  167 |             return reg?.active?.state === 'activated';
  168 |         }, null, { timeout: 30_000 });
  169 |         await expect.poll(() => client.page.evaluate(async () => (await caches.keys()).sort()), {
  170 |             message: `caches après l’activation : seul ${OFFLINE_CACHE} attendu (event-village-v1 et ev-hors-ligne-ancien supprimés)`, timeout: 30_000,
  171 |         }).toEqual([OFFLINE_CACHE]);
  172 |         await expectOfflineAvailable(client.page, ticket.number);
  173 | 
  174 |         const urls = await client.page.evaluate(async (name) => (await (await caches.open(name)).keys()).map((r) => r.url), OFFLINE_CACHE);
  175 |         const paths = urls.map((u) => new URL(u));
  176 |         const outside = paths.filter((u) => !(u.pathname === OFFLINE_PATH || u.pathname.startsWith('/_next/static/') || PUBLIC_ASSETS.includes(u.pathname)));
  177 |         const forbidden = paths.filter((u) => u.pathname.startsWith('/api/') || u.searchParams.has('_rsc'));
  178 |         console.log(`[e2e][terrain] cache ${OFFLINE_CACHE} : ${urls.length} entrée(s)\n${urls.join('\n')}`);
  179 |         expect(forbidden.map(String), 'aucune réponse /api/ ni charge _rsc en cache').toEqual([]);
  180 |         expect(outside.map(String), `cache limité à ${OFFLINE_PATH}, /_next/static/ et aux ressources publiques du contrat 5.3`).toEqual([]);
  181 |         expect(paths.some((u) => u.pathname === OFFLINE_PATH), `coquille ${OFFLINE_PATH} en cache`).toBe(true);
  182 |         expect(paths.some((u) => u.pathname.startsWith('/_next/static/')), 'ressources /_next/static/ de la coquille en cache').toBe(true);
  183 |         expect(servedApi, 'aucune réponse /api/ servie par le service worker').toEqual([]);
  184 | 
  185 |         await client.context.setOffline(true);
  186 |         client.guard.freeze();
  187 |         const outcome = await client.page.evaluate(async (id) => {
  188 |             try {
  189 |                 const r = await fetch(`/api/tickets/${id}/offline-codes`, { cache: 'no-store' });
  190 |                 return `servi (HTTP ${r.status})`;
  191 |             } catch (err) {
```