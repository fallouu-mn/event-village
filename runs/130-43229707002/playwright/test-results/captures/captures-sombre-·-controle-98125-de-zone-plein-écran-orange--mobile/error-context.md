# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · controleur >> scanner-pas-encore-entre — Scanner — pas encore entré (contrôle de zone, plein écran orange)
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-scan-state="result"][data-scan-result="not_entered"]')
Expected: visible
Timeout: 20000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('[data-scan-state="result"][data-scan-result="not_entered"]') with timeout 20000ms
  - waiting for locator('[data-scan-state="result"][data-scan-result="not_entered"]')

```

```yaml
- banner:
  - link "Mon espace client":
    - /url: /
  - link "Event Village, accueil":
    - /url: /
  - button "Notifications, 1 non lue": "1"
  - link "Ibrahima Gueye":
    - /url: /controller/profile
- main:
  - heading "Nuit du Sabar — édition d’automne" [level=1]
  - paragraph:
    - status: "Entrée principale : 54 entrées"
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
    - 'button "Derniers scans Vous : 32 entrées, 5 refus"'
    - group: Réglages de cet appareil
  - alert:
    - paragraph: "Erreur serveur : réessayez"
    - paragraph: "Le billet n’est pas en cause. Ne refusez pas le spectateur pour ce motif : faites patienter et réessayez."
    - paragraph: Retour automatique au scan · touchez pour passer
- alert
```

# Test source

```ts
  120 |     /** Lot 9 : texte de cette erreur quand l'écran l'affiche tel quel, celui du repli de la route (sinon texte générique). */
  121 |     injectErrorMessage?: string;
  122 |     /** Lot 6 : réponse d'API remplacée par une réponse valide (calqué sur injectError), ex. liste vide. */
  123 |     stubResponse?: { url: RegExp; status: number; body: unknown };
  124 |     /** Lot 6 : état du push simulé avant le chargement (e2e/support/fake-push.ts). */
  125 |     fakePush?: FakePushMode;
  126 |     allowFailures?: RegExp[];
  127 |     /** Caméra simulée (fake-camera.ts) ; 'barcode-detector' impose le faux BarcodeDetector (lot 7). */
  128 |     fakeCamera?: boolean | 'barcode-detector';
  129 |     masks?: (page: Page) => Locator[];
  130 |     /** Lot 7 : vues capturées (défaut : les 4). */
  131 |     views?: readonly CaptureView[];
  132 |     /** Lot 7 : service worker autorisé dans le contexte de cet écran. */
  133 |     serviceWorkers?: 'allow';
  134 |     /** Lot 7 : connexion coupée avant ou après le chargement du document. */
  135 |     offline?: 'before-load' | 'after-load';
  136 |     /** Lot 7 : localStorage posé avant le chargement (clé → valeur). */
  137 |     initStorage?: Record<string, string>;
  138 |     /** Lot 7 : réponses d'API valides imposées (en plus de stubResponse). */
  139 |     stubResponses?: StubResponse[];
  140 |     /** Lot 7 : requêtes retenues, jamais servies. */
  141 |     holdRequests?: Array<{ url: RegExp; method?: string }>;
  142 |     /** Lot 7 : setTimeout de minDelayMs ou plus multipliés par factor (état capturé tenu pendant les contrôles). */
  143 |     slowTimers?: { minDelayMs: number; factor: number };
  144 |     /** Lot 7 : statut HTTP attendu du document (sinon : réponse < 400 non vérifiée, comme avant). */
  145 |     expectStatus?: number;
  146 |     /** Lot 8 : formats exacts, ancrés, de références affichées, qui ne sont pas des valeurs techniques (checks.ts). */
  147 |     references?: readonly RegExp[];
  148 | }
  149 | 
  150 | const UUID = '[0-9a-f-]{36}';
  151 | /** Lot 8 (8.2 h) : UUID bien formé qu'aucun événement ne porte. */
  152 | const UNKNOWN_EVENT_ID = '00000000-0000-4000-8000-000000000404';
  153 | const NOT_AN_EVENT_ID = 'pas-un-identifiant';
  154 | /** Lot 8 (8.2 h) : document et lecture de l'API en 404, attendus par ces écrans. */
  155 | const EVENT_404_FAILURES = [new RegExp(`/api/events/${UUID}(\\?.*)?$`), new RegExp(`/events/${UUID}$`)];
  156 | 
  157 | function ids(i: DemoIds | null): DemoIds {
  158 |     if (!i) throw new Error('[e2e] écran dépendant du seed de démonstration appelé sans identifiants');
  159 |     return i;
  160 | }
  161 | 
  162 | function pilotage(key: keyof DemoIds['events']) {
  163 |     return (i: DemoIds | null) => `/partner/events/${ids(i).events[key].id}`;
  164 | }
  165 | 
  166 | async function openTab(page: Page, name: RegExp): Promise<void> {
  167 |     const tab = page.getByRole('tab', { name });
  168 |     await tab.click();
  169 |     await expect(tab).toHaveAttribute('aria-selected', 'true');
  170 | }
  171 | 
  172 | async function expectRetry(c: ScreenContext): Promise<void> {
  173 |     await expect(c.page.getByRole('button', { name: /réessayer/i })).toBeVisible();
  174 | }
  175 | 
  176 | /**
  177 |  * Amène l'élément au milieu de la fenêtre avant la capture (prise à la taille de l'écran, pas en pleine page) :
  178 |  * sans cela, un état placé sous la ligne de flottaison n'apparaît sur aucune image (relecture du run 77).
  179 |  */
  180 | async function revealCenter(target: Locator): Promise<void> {
  181 |     await target.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
  182 | }
  183 | 
  184 | async function expectHeading(page: Page, name: RegExp): Promise<void> {
  185 |     await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  186 | }
  187 | 
  188 | // ── Lot 7 : outils des écrans du scanner, du billet hors ligne et des pages migrées ─────────────
  189 | 
  190 | /** Page chargée : un titre de niveau 1 visible (PageHeader du système de design). */
  191 | async function expectPageTitle(page: Page): Promise<void> {
  192 |     await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  193 | }
  194 | 
  195 | /** Écran « Commencer le contrôle » affiché (ScannerStartScreen, D49), événement présélectionné. */
  196 | async function scannerStartReady(page: Page): Promise<void> {
  197 |     await expectHeading(page, /^commencer le contr[ôo]le$/i);
  198 |     await expect(page.getByRole('radio').first()).toBeVisible();
  199 | }
  200 | 
  201 | /** Départ du contrôle : bouton « Commencer le contrôle », mode caméra, flux vidéo en lecture. */
  202 | async function startScanner(page: Page): Promise<void> {
  203 |     await scannerStartReady(page);
  204 |     await page.getByRole('button', { name: /^commencer le contr[ôo]le$/i }).click();
  205 |     await expect(page.getByRole('button', { name: /^caméra$/i })).toHaveAttribute('aria-pressed', 'true');
  206 |     await page.waitForFunction(() => Array.from(document.querySelectorAll('video')).some((v) => v.readyState >= 2), null, { timeout: 30_000 });
  207 | }
  208 | 
  209 | /** QR présenté au faux BarcodeDetector (fake-camera.ts) : payload au format EVT1 d'un billet du client. */
  210 | async function presentToFakeDetector(page: Page, payload: string): Promise<void> {
  211 |     await page.evaluate((p) => {
  212 |         const cam = (window as unknown as { __evFakeCamera?: { setPayload: (x: string) => void } }).__evFakeCamera;
  213 |         if (!cam) throw new Error('caméra simulée absente de la page (fake-camera.ts)');
  214 |         cam.setPayload(p);
  215 |     }, payload);
  216 | }
  217 | 
  218 | /** Plein écran du résultat affiché (CombatFlashOverlay : data-scan-state="result", data-scan-result). */
  219 | async function expectScanResult(page: Page, result: string): Promise<void> {
> 220 |     await expect(page.locator(`[data-scan-state="result"][data-scan-result="${result}"]`)).toBeVisible({ timeout: 20_000 });
      |                                                                                            ^ Error: expect(locator).toBeVisible() failed
  221 | }
  222 | 
  223 | /** Payload EVT1 d'un billet du client de démonstration (la réponse du scan est imposée par stubResponses). */
  224 | function demoPayload(c: ScreenContext): string {
  225 |     return `EVT1:${ids(c.ids).tickets.clientValide}:482913`;
  226 | }
  227 | 
  228 | const SCAN_URL = /\/api\/controller\/scan$/;
  229 | const SCAN_TICKET = { ticket_number: 'TCK-20261104-7C2D9A4B1E', category: 'Standard', holder: 'Fatou Mbaye', is_manual_entry: false };
  230 | /** Délai de retour du scanner pour une entrée validée posé à 3 s (contrat 11.2, initStorage). */
  231 | const SCANNER_STORAGE = { ev_scanner_auto_return_ms: '3000' };
  232 | /** Plein écran tenu pendant les contrôles : retours automatiques de 3 s étirés (×100), « Réseau lent » (1,5 s) intact. */
  233 | const SCANNER_TIMERS = { minDelayMs: 2500, factor: 100 };
  234 | 
  235 | /** Écran d'un résultat de scan : réponse du contrat 3.3 imposée, faux BarcodeDetector, plein écran attendu. */
  236 | function scanResultScreen(id: string, titre: string, body: Record<string, unknown>): Screen {
  237 |     const result = String(body.result);
  238 |     return {
  239 |         id, titre, role: 'controleur', needsIds: true, path: () => '/controller/scanner', views: DARK_VIEWS,
  240 |         fakeCamera: 'barcode-detector', initStorage: SCANNER_STORAGE, slowTimers: SCANNER_TIMERS,
  241 |         stubResponses: [{ url: SCAN_URL, method: 'POST', status: 200, body: { replayed: false, ...body } }],
  242 |         ready: async ({ page }) => startScanner(page),
  243 |         actions: async (c) => {
  244 |             await presentToFakeDetector(c.page, demoPayload(c));
  245 |             await expectScanResult(c.page, result);
  246 |         },
  247 |     };
  248 | }
  249 | 
  250 | /** Lien de la carte d'un billet vers sa page hors ligne (TicketCard, état « available »). */
  251 | function offlineLink(page: Page, ticketId: string): Locator {
  252 |     return page.locator(`a[href="/billet/hors-ligne?id=${encodeURIComponent(ticketId)}"]`);
  253 | }
  254 | 
  255 | const OFFLINE_CODES_URL = /\/api\/tickets\/[^/]+\/offline-codes(\?.*)?$/;
  256 | 
  257 | /** Compteurs du push simulé (fake-push.ts) ; erreur explicite si le script d'initialisation manque. */
  258 | async function fakePushCounters(page: Page): Promise<FakePushCounters> {
  259 |     const counters = await page.evaluate(() => (window as unknown as { __evFakePush?: FakePushCounters }).__evFakePush ?? null);
  260 |     if (!counters) throw new Error('[e2e] push simulé absent de la page (script d’initialisation fake-push.ts non chargé)');
  261 |     return counters;
  262 | }
  263 | 
  264 | /** Page des préférences chargée (section « Vous choisissez ») et état du push sur l'appareil affiché. */
  265 | async function preferencesReady(page: Page, deviceState: RegExp): Promise<void> {
  266 |     await expectHeading(page, /^préférences de notification$/i);
  267 |     await expect(page.getByRole('heading', { name: /^vous choisissez$/i })).toBeVisible();
  268 |     await expect(page.getByText(deviceState).first()).toBeVisible();
  269 | }
  270 | 
  271 | /** Aucune demande d'autorisation au chargement de la page (contrat F4 : seulement après un geste). */
  272 | async function expectNoPermissionPrompt(page: Page): Promise<void> {
  273 |     const counters = await fakePushCounters(page);
  274 |     expect(counters.requestPermissionCalls, 'demandes d’autorisation des notifications au chargement').toBe(0);
  275 | }
  276 | 
  277 | // ── Lot 8 : champ de date, canaux de vente, remboursements ──────────────────
  278 | 
  279 | /** Nœud du document lu par CDP (DOM.getDocument en pierce) : champs utiles seulement. */
  280 | interface CdpNode { nodeType?: number; nodeName?: string; nodeValue?: string; attributes?: string[]; children?: CdpNode[]; shadowRoots?: CdpNode[] }
  281 | 
  282 | function cdpKids(node: CdpNode): CdpNode[] {
  283 |     return [...(node.shadowRoots ?? []), ...(node.children ?? [])];
  284 | }
  285 | 
  286 | function findDateInput(node: CdpNode): CdpNode | null {
  287 |     const attrs = node.attributes ?? [];
  288 |     if (node.nodeName === 'INPUT') {
  289 |         for (let i = 0; i < attrs.length; i += 2) if (attrs[i] === 'type' && attrs[i + 1] === 'date') return node;
  290 |     }
  291 |     for (const kid of cdpKids(node)) {
  292 |         const found = findDateInput(kid);
  293 |         if (found) return found;
  294 |     }
  295 |     return null;
  296 | }
  297 | 
  298 | function cdpText(node: CdpNode): string {
  299 |     const own = node.nodeType === 3 ? (node.nodeValue ?? '').trim() : '';
  300 |     return own + cdpKids(node).map(cdpText).join('');
  301 | }
  302 | 
  303 | /**
  304 |  * Gabarit affiché par le premier champ de date vide (8.2 t, L66). Il vit dans la racine fantôme du navigateur, que le
  305 |  * DOM de la page ne montre pas : lecture par CDP. Non vérifié sous Linux : si le run « avant » lit encore mm/dd/yyyy,
  306 |  * le rapport l'explique, sans changer de binaire (contrat 11.4).
  307 |  */
  308 | async function expectFrenchDateField(c: ScreenContext): Promise<void> {
  309 |     await expect(c.page.locator('input[type="date"]').first()).toBeAttached();
  310 |     const cdp = await c.context.newCDPSession(c.page);
  311 |     try {
  312 |         const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
  313 |         const input = findDateInput(root);
  314 |         if (!input) throw new Error('[e2e] aucun champ de date dans l’arbre lu par CDP');
  315 |         expect(cdpText(input), 'gabarit du champ de date, lu par CDP (8.2 t)').toBe('dd/mm/yyyy');
  316 |     } finally {
  317 |         await cdp.detach();
  318 |     }
  319 | }
  320 | 
```