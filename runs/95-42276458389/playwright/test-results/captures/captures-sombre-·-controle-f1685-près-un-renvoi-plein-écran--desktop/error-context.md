# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · controleur >> scanner-non-traite — Scanner — scan non traité après un renvoi (plein écran)
- Location: e2e/captures.spec.ts:159:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-scan-state="result"][data-scan-result="not_processed"]')
Expected: visible
Timeout: 20000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('[data-scan-state="result"][data-scan-result="not_processed"]') with timeout 20000ms
  - waiting for locator('[data-scan-state="result"][data-scan-result="not_processed"]')

```

```yaml
- banner:
  - link "Mon espace client":
    - /url: /
  - link "Event Village, accueil":
    - /url: /
    - text: EVENT VILLAGE
  - button "Notifications, 1 non lue": "1"
  - link "Ibrahima Gueye":
    - /url: /controller/profile
- main:
  - heading "Nuit du Sabar — édition d’automne" [level=1]
  - paragraph:
    - status: "Porte Entrée principale : 53 entrées"
    - text: En ligne
  - button "Changer d’événement"
  - button "Se déconnecter"
  - tablist "Espace du contrôleur":
    - tab "Contrôle" [selected]
    - tab "Guichet"
    - tab "Caisse"
  - tabpanel "Contrôle":
    - text: Détection en pause
    - group "Mode de contrôle":
      - button "Caméra" [pressed]
      - button "Saisie manuelle"
    - 'button "Derniers scans Vous : 31 entrées, 5 refus"'
    - group: Réglages de cet appareil
  - alert:
    - paragraph: "Erreur serveur : réessayez"
    - paragraph: "Scan non traité : aucune entrée enregistrée. Scannez le billet de nouveau."
    - paragraph: "Le billet n’est pas en cause. Ne refusez pas le spectateur pour ce motif : faites patienter et réessayez."
    - paragraph: Retour automatique au scan · touchez pour passer
- alert
```

# Test source

```ts
  74  |     /** Interaction avant la capture (onglet, modale, passage hors ligne). */
  75  |     actions?: (c: ScreenContext) => Promise<void>;
  76  |     /** Réponse d'API remplacée par une erreur 500 : capture de l'état d'erreur avec « Réessayer ». */
  77  |     injectError?: RegExp;
  78  |     /** Lot 6 : réponse d'API remplacée par une réponse valide (calqué sur injectError), ex. liste vide. */
  79  |     stubResponse?: { url: RegExp; status: number; body: unknown };
  80  |     /** Lot 6 : état du push simulé avant le chargement (e2e/support/fake-push.ts). */
  81  |     fakePush?: FakePushMode;
  82  |     allowFailures?: RegExp[];
  83  |     /** Caméra simulée (fake-camera.ts) ; 'barcode-detector' impose le faux BarcodeDetector (lot 7). */
  84  |     fakeCamera?: boolean | 'barcode-detector';
  85  |     masks?: (page: Page) => Locator[];
  86  |     /** Lot 7 : vues capturées (défaut : les 4). */
  87  |     views?: readonly CaptureView[];
  88  |     /** Lot 7 : service worker autorisé dans le contexte de cet écran. */
  89  |     serviceWorkers?: 'allow';
  90  |     /** Lot 7 : connexion coupée avant ou après le chargement du document. */
  91  |     offline?: 'before-load' | 'after-load';
  92  |     /** Lot 7 : localStorage posé avant le chargement (clé → valeur). */
  93  |     initStorage?: Record<string, string>;
  94  |     /** Lot 7 : réponses d'API valides imposées (en plus de stubResponse). */
  95  |     stubResponses?: StubResponse[];
  96  |     /** Lot 7 : requêtes retenues, jamais servies. */
  97  |     holdRequests?: Array<{ url: RegExp; method?: string }>;
  98  |     /** Lot 7 : setTimeout de minDelayMs ou plus multipliés par factor (état capturé tenu pendant les contrôles). */
  99  |     slowTimers?: { minDelayMs: number; factor: number };
  100 |     /** Lot 7 : statut HTTP attendu du document (sinon : réponse < 400 non vérifiée, comme avant). */
  101 |     expectStatus?: number;
  102 | }
  103 | 
  104 | const UUID = '[0-9a-f-]{36}';
  105 | /** Lot 8 (8.2 h) : UUID bien formé qu'aucun événement ne porte. */
  106 | const UNKNOWN_EVENT_ID = '00000000-0000-4000-8000-000000000404';
  107 | const NOT_AN_EVENT_ID = 'pas-un-identifiant';
  108 | /** Lot 8 (8.2 h) : document et lecture de l'API en 404, attendus par ces écrans. */
  109 | const EVENT_404_FAILURES = [new RegExp(`/api/events/${UUID}(\\?.*)?$`), new RegExp(`/events/${UUID}$`)];
  110 | 
  111 | function ids(i: DemoIds | null): DemoIds {
  112 |     if (!i) throw new Error('[e2e] écran dépendant du seed de démonstration appelé sans identifiants');
  113 |     return i;
  114 | }
  115 | 
  116 | function pilotage(key: keyof DemoIds['events']) {
  117 |     return (i: DemoIds | null) => `/partner/events/${ids(i).events[key].id}`;
  118 | }
  119 | 
  120 | async function openTab(page: Page, name: RegExp): Promise<void> {
  121 |     const tab = page.getByRole('tab', { name });
  122 |     await tab.click();
  123 |     await expect(tab).toHaveAttribute('aria-selected', 'true');
  124 | }
  125 | 
  126 | async function expectRetry(c: ScreenContext): Promise<void> {
  127 |     await expect(c.page.getByRole('button', { name: /réessayer/i })).toBeVisible();
  128 | }
  129 | 
  130 | /**
  131 |  * Amène l'élément au milieu de la fenêtre avant la capture (prise à la taille de l'écran, pas en pleine page) :
  132 |  * sans cela, un état placé sous la ligne de flottaison n'apparaît sur aucune image (relecture du run 77).
  133 |  */
  134 | async function revealCenter(target: Locator): Promise<void> {
  135 |     await target.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
  136 | }
  137 | 
  138 | async function expectHeading(page: Page, name: RegExp): Promise<void> {
  139 |     await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  140 | }
  141 | 
  142 | // ── Lot 7 : outils des écrans du scanner, du billet hors ligne et des pages migrées ─────────────
  143 | 
  144 | /** Page chargée : un titre de niveau 1 visible (PageHeader du système de design). */
  145 | async function expectPageTitle(page: Page): Promise<void> {
  146 |     await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  147 | }
  148 | 
  149 | /** Écran « Commencer le contrôle » affiché (ScannerStartScreen, D49), événement présélectionné. */
  150 | async function scannerStartReady(page: Page): Promise<void> {
  151 |     await expectHeading(page, /^commencer le contr[ôo]le$/i);
  152 |     await expect(page.getByRole('radio').first()).toBeVisible();
  153 | }
  154 | 
  155 | /** Départ du contrôle : bouton « Commencer le contrôle », mode caméra, flux vidéo en lecture. */
  156 | async function startScanner(page: Page): Promise<void> {
  157 |     await scannerStartReady(page);
  158 |     await page.getByRole('button', { name: /^commencer le contr[ôo]le$/i }).click();
  159 |     await expect(page.getByRole('button', { name: /^caméra$/i })).toHaveAttribute('aria-pressed', 'true');
  160 |     await page.waitForFunction(() => Array.from(document.querySelectorAll('video')).some((v) => v.readyState >= 2), null, { timeout: 30_000 });
  161 | }
  162 | 
  163 | /** QR présenté au faux BarcodeDetector (fake-camera.ts) : payload au format EVT1 d'un billet du client. */
  164 | async function presentToFakeDetector(page: Page, payload: string): Promise<void> {
  165 |     await page.evaluate((p) => {
  166 |         const cam = (window as unknown as { __evFakeCamera?: { setPayload: (x: string) => void } }).__evFakeCamera;
  167 |         if (!cam) throw new Error('caméra simulée absente de la page (fake-camera.ts)');
  168 |         cam.setPayload(p);
  169 |     }, payload);
  170 | }
  171 | 
  172 | /** Plein écran du résultat affiché (CombatFlashOverlay : data-scan-state="result", data-scan-result). */
  173 | async function expectScanResult(page: Page, result: string): Promise<void> {
> 174 |     await expect(page.locator(`[data-scan-state="result"][data-scan-result="${result}"]`)).toBeVisible({ timeout: 20_000 });
      |                                                                                            ^ Error: expect(locator).toBeVisible() failed
  175 | }
  176 | 
  177 | /** Payload EVT1 d'un billet du client de démonstration (la réponse du scan est imposée par stubResponses). */
  178 | function demoPayload(c: ScreenContext): string {
  179 |     return `EVT1:${ids(c.ids).tickets.clientValide}:482913`;
  180 | }
  181 | 
  182 | const SCAN_URL = /\/api\/controller\/scan$/;
  183 | const SCAN_TICKET = { ticket_number: 'TCK-20261104-7C2D9A4B1E', category: 'Standard', holder: 'Fatou Mbaye', is_manual_entry: false };
  184 | /** Délai de retour du scanner pour une entrée validée posé à 3 s (contrat 11.2, initStorage). */
  185 | const SCANNER_STORAGE = { ev_scanner_auto_return_ms: '3000' };
  186 | /** Plein écran tenu pendant les contrôles : retours automatiques de 3 s étirés (×100), « Réseau lent » (1,5 s) intact. */
  187 | const SCANNER_TIMERS = { minDelayMs: 2500, factor: 100 };
  188 | 
  189 | /** Écran d'un résultat de scan : réponse du contrat 3.3 imposée, faux BarcodeDetector, plein écran attendu. */
  190 | function scanResultScreen(id: string, titre: string, body: Record<string, unknown>): Screen {
  191 |     const result = String(body.result);
  192 |     return {
  193 |         id, titre, role: 'controleur', needsIds: true, path: () => '/controller/scanner', views: DARK_VIEWS,
  194 |         fakeCamera: 'barcode-detector', initStorage: SCANNER_STORAGE, slowTimers: SCANNER_TIMERS,
  195 |         stubResponses: [{ url: SCAN_URL, method: 'POST', status: 200, body: { replayed: false, ...body } }],
  196 |         ready: async ({ page }) => startScanner(page),
  197 |         actions: async (c) => {
  198 |             await presentToFakeDetector(c.page, demoPayload(c));
  199 |             await expectScanResult(c.page, result);
  200 |         },
  201 |     };
  202 | }
  203 | 
  204 | /** Lien de la carte d'un billet vers sa page hors ligne (TicketCard, état « available »). */
  205 | function offlineLink(page: Page, ticketId: string): Locator {
  206 |     return page.locator(`a[href="/billet/hors-ligne?id=${encodeURIComponent(ticketId)}"]`);
  207 | }
  208 | 
  209 | const OFFLINE_CODES_URL = /\/api\/tickets\/[^/]+\/offline-codes(\?.*)?$/;
  210 | 
  211 | /** Compteurs du push simulé (fake-push.ts) ; erreur explicite si le script d'initialisation manque. */
  212 | async function fakePushCounters(page: Page): Promise<FakePushCounters> {
  213 |     const counters = await page.evaluate(() => (window as unknown as { __evFakePush?: FakePushCounters }).__evFakePush ?? null);
  214 |     if (!counters) throw new Error('[e2e] push simulé absent de la page (script d’initialisation fake-push.ts non chargé)');
  215 |     return counters;
  216 | }
  217 | 
  218 | /** Page des préférences chargée (section « Vous choisissez ») et état du push sur l'appareil affiché. */
  219 | async function preferencesReady(page: Page, deviceState: RegExp): Promise<void> {
  220 |     await expectHeading(page, /^préférences de notification$/i);
  221 |     await expect(page.getByRole('heading', { name: /^vous choisissez$/i })).toBeVisible();
  222 |     await expect(page.getByText(deviceState).first()).toBeVisible();
  223 | }
  224 | 
  225 | /** Aucune demande d'autorisation au chargement de la page (contrat F4 : seulement après un geste). */
  226 | async function expectNoPermissionPrompt(page: Page): Promise<void> {
  227 |     const counters = await fakePushCounters(page);
  228 |     expect(counters.requestPermissionCalls, 'demandes d’autorisation des notifications au chargement').toBe(0);
  229 | }
  230 | 
  231 | // ── Lot 8 : champ de date, canaux de vente, remboursements ──────────────────
  232 | 
  233 | /** Nœud du document lu par CDP (DOM.getDocument en pierce) : champs utiles seulement. */
  234 | interface CdpNode { nodeType?: number; nodeName?: string; nodeValue?: string; attributes?: string[]; children?: CdpNode[]; shadowRoots?: CdpNode[] }
  235 | 
  236 | function cdpKids(node: CdpNode): CdpNode[] {
  237 |     return [...(node.shadowRoots ?? []), ...(node.children ?? [])];
  238 | }
  239 | 
  240 | function findDateInput(node: CdpNode): CdpNode | null {
  241 |     const attrs = node.attributes ?? [];
  242 |     if (node.nodeName === 'INPUT') {
  243 |         for (let i = 0; i < attrs.length; i += 2) if (attrs[i] === 'type' && attrs[i + 1] === 'date') return node;
  244 |     }
  245 |     for (const kid of cdpKids(node)) {
  246 |         const found = findDateInput(kid);
  247 |         if (found) return found;
  248 |     }
  249 |     return null;
  250 | }
  251 | 
  252 | function cdpText(node: CdpNode): string {
  253 |     const own = node.nodeType === 3 ? (node.nodeValue ?? '').trim() : '';
  254 |     return own + cdpKids(node).map(cdpText).join('');
  255 | }
  256 | 
  257 | /**
  258 |  * Gabarit affiché par le premier champ de date vide (8.2 t, L66). Il vit dans la racine fantôme du navigateur, que le
  259 |  * DOM de la page ne montre pas : lecture par CDP. Non vérifié sous Linux : si le run « avant » lit encore mm/dd/yyyy,
  260 |  * le rapport l'explique, sans changer de binaire (contrat 11.4).
  261 |  */
  262 | async function expectFrenchDateField(c: ScreenContext): Promise<void> {
  263 |     await expect(c.page.locator('input[type="date"]').first()).toBeAttached();
  264 |     const cdp = await c.context.newCDPSession(c.page);
  265 |     try {
  266 |         const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
  267 |         const input = findDateInput(root);
  268 |         if (!input) throw new Error('[e2e] aucun champ de date dans l’arbre lu par CDP');
  269 |         expect(cdpText(input), 'gabarit du champ de date, lu par CDP (8.2 t)').toBe('dd/mm/yyyy');
  270 |     } finally {
  271 |         await cdp.detach();
  272 |     }
  273 | }
  274 | 
```