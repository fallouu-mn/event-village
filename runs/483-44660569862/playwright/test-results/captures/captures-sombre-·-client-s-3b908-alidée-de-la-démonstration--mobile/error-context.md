# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · client >> salles-catalogue — Salles de fête — catalogue (salle validée de la démonstration)
- Location: e2e/captures.spec.ts:192:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: /^salles de fête$/i, level: 1 })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: /^salles de fête$/i, level: 1 }) with timeout 15000ms
  - waiting for getByRole('heading', { name: /^salles de fête$/i, level: 1 })

```

```yaml
- banner:
  - button "Ouvrir le menu"
  - link "Event Village, accueil":
    - /url: /
  - button "Notifications, 10 non lues": "10"
  - button "Basculer le thème"
  - link "Mon profil (Fatou Mbaye)":
    - /url: /profile
- main:
  - alert:
    - heading "Quelque chose s’est mal passé de notre côté." [level=1]
    - paragraph: Réessayez dans un instant. Si cela continue, revenez à l’accueil.
    - button "Réessayer"
    - link "Accueil":
      - /url: /
- navigation "Navigation rapide":
  - link "Accueil":
    - /url: /
  - link "Explorer":
    - /url: /explore
  - link "Billets":
    - /url: /tickets
  - link "Achats":
    - /url: /orders
  - link "Portefeuille":
    - /url: /wallet
- alert
```

# Test source

```ts
  102 |     ids: DemoIds | null;
  103 | }
  104 | 
  105 | /** Vue d'une capture : appareil et thème (lot 7, contrat 11.2). */
  106 | export type CaptureView = 'mobile-clair' | 'mobile-sombre' | 'ordinateur-clair' | 'ordinateur-sombre';
  107 | /** Écrans du contrôleur : thème sombre forcé par app/controller/layout.tsx (D85), deux vues seulement. */
  108 | export const DARK_VIEWS: readonly CaptureView[] = ['mobile-sombre', 'ordinateur-sombre'];
  109 | /** Lot 8 : écrans propres au téléphone (barre d'achat, masquée à partir de lg). */
  110 | export const MOBILE_VIEWS: readonly CaptureView[] = ['mobile-clair', 'mobile-sombre'];
  111 | 
  112 | export interface StubResponse { url: RegExp; method?: string; status: number; body: unknown }
  113 | 
  114 | export interface Screen {
  115 |     id: string;
  116 |     titre: string;
  117 |     role: CaptureRole;
  118 |     /** Faux s'il ne dépend pas du seed de démonstration (accueil, catalogue). */
  119 |     needsIds: boolean;
  120 |     path: (ids: DemoIds | null) => string;
  121 |     /** Attente spécifique avant la capture (contenu attendu). */
  122 |     ready?: (c: ScreenContext) => Promise<void>;
  123 |     /** Interaction avant la capture (onglet, modale, passage hors ligne). */
  124 |     actions?: (c: ScreenContext) => Promise<void>;
  125 |     /** Réponse d'API remplacée par une erreur 500 : capture de l'état d'erreur avec « Réessayer ». */
  126 |     injectError?: RegExp;
  127 |     /** Lot 9 : texte de cette erreur quand l'écran l'affiche tel quel, celui du repli de la route (sinon texte générique). */
  128 |     injectErrorMessage?: string;
  129 |     /** Lot 6 : réponse d'API remplacée par une réponse valide (calqué sur injectError), ex. liste vide. */
  130 |     stubResponse?: { url: RegExp; status: number; body: unknown };
  131 |     /** Lot 6 : état du push simulé avant le chargement (e2e/support/fake-push.ts). */
  132 |     fakePush?: FakePushMode;
  133 |     allowFailures?: RegExp[];
  134 |     /** Caméra simulée (fake-camera.ts) ; 'barcode-detector' impose le faux BarcodeDetector (lot 7). */
  135 |     fakeCamera?: boolean | 'barcode-detector';
  136 |     masks?: (page: Page) => Locator[];
  137 |     /** Lot 7 : vues capturées (défaut : les 4). */
  138 |     views?: readonly CaptureView[];
  139 |     /** Lot 7 : service worker autorisé dans le contexte de cet écran. */
  140 |     serviceWorkers?: 'allow';
  141 |     /** Lot 7 : connexion coupée avant ou après le chargement du document. */
  142 |     offline?: 'before-load' | 'after-load';
  143 |     /** Lot 7 : localStorage posé avant le chargement (clé → valeur). */
  144 |     initStorage?: Record<string, string>;
  145 |     /** Lot 7 : réponses d'API valides imposées (en plus de stubResponse). */
  146 |     stubResponses?: StubResponse[];
  147 |     /** Lot 7 : requêtes retenues, jamais servies. */
  148 |     holdRequests?: Array<{ url: RegExp; method?: string }>;
  149 |     /** Lot 7 : setTimeout de minDelayMs ou plus multipliés par factor (état capturé tenu pendant les contrôles). */
  150 |     slowTimers?: { minDelayMs: number; factor: number };
  151 |     /** Lot 7 : statut HTTP attendu du document (sinon : réponse < 400 non vérifiée, comme avant). */
  152 |     expectStatus?: number;
  153 |     /** Lot 8 : formats exacts, ancrés, de références affichées, qui ne sont pas des valeurs techniques (checks.ts). */
  154 |     references?: readonly RegExp[];
  155 |     /**
  156 |      * Lot 10b : écran d'une page des salles de fête (app/halls, app/partner/halls), en 404 tant que l'interrupteur
  157 |      * features.halls_enabled est fermé : ouvert le temps de la capture, sous le verrou de e2e/support/halls-switch.ts.
  158 |      */
  159 |     salles?: boolean;
  160 | }
  161 | 
  162 | const UUID = '[0-9a-f-]{36}';
  163 | // Design 1c (point 5) : l'exception RAW_ID_TEXT du design 1b (identifiant brut admis sur trois écrans de la finance de
  164 | // l'administration) est retirée : la référence d'un paiement sans référence SamirPay s'affiche en référence courte
  165 | // (« Réf. interne … », lib/finance/payment-labels.ts, readablePaymentReference).
  166 | /** Design 1b : préchargement (next/link) d'une fiche fictive de la vitrine ou d'une fiche imposée : 404 attendu. */
  167 | const fakeEventPrefetch = (id: string): RegExp => new RegExp(`/events/${id}(\\?_rsc=[^/]*)?$`);
  168 | /** Lot 8 (8.2 h) : UUID bien formé qu'aucun événement ne porte. */
  169 | const UNKNOWN_EVENT_ID = '00000000-0000-4000-8000-000000000404';
  170 | const NOT_AN_EVENT_ID = 'pas-un-identifiant';
  171 | /** Lot 8 (8.2 h) : document et lecture de l'API en 404, attendus par ces écrans. */
  172 | const EVENT_404_FAILURES = [new RegExp(`/api/events/${UUID}(\\?.*)?$`), new RegExp(`/events/${UUID}$`)];
  173 | 
  174 | function ids(i: DemoIds | null): DemoIds {
  175 |     if (!i) throw new Error('[e2e] écran dépendant du seed de démonstration appelé sans identifiants');
  176 |     return i;
  177 | }
  178 | 
  179 | function pilotage(key: keyof DemoIds['events']) {
  180 |     return (i: DemoIds | null) => `/partner/events/${ids(i).events[key].id}`;
  181 | }
  182 | 
  183 | async function openTab(page: Page, name: RegExp): Promise<void> {
  184 |     const tab = page.getByRole('tab', { name });
  185 |     await tab.click();
  186 |     await expect(tab).toHaveAttribute('aria-selected', 'true');
  187 | }
  188 | 
  189 | async function expectRetry(c: ScreenContext): Promise<void> {
  190 |     await expect(c.page.getByRole('button', { name: /réessayer/i })).toBeVisible();
  191 | }
  192 | 
  193 | /**
  194 |  * Amène l'élément au milieu de la fenêtre avant la capture (prise à la taille de l'écran, pas en pleine page) :
  195 |  * sans cela, un état placé sous la ligne de flottaison n'apparaît sur aucune image (relecture du run 77).
  196 |  */
  197 | async function revealCenter(target: Locator): Promise<void> {
  198 |     await target.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
  199 | }
  200 | 
  201 | async function expectHeading(page: Page, name: RegExp): Promise<void> {
> 202 |     await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
      |                                                                 ^ Error: expect(locator).toBeVisible() failed
  203 | }
  204 | 
  205 | // ── Lot 7 : outils des écrans du scanner, du billet hors ligne et des pages migrées ─────────────
  206 | 
  207 | /** Page chargée : un titre de niveau 1 visible (PageHeader du système de design). */
  208 | async function expectPageTitle(page: Page): Promise<void> {
  209 |     await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  210 | }
  211 | 
  212 | /** Écran « Commencer le contrôle » affiché (ScannerStartScreen, D49), événement présélectionné. */
  213 | async function scannerStartReady(page: Page): Promise<void> {
  214 |     await expectHeading(page, /^commencer le contr[ôo]le$/i);
  215 |     await expect(page.getByRole('radio').first()).toBeVisible();
  216 | }
  217 | 
  218 | /** Départ du contrôle : bouton « Commencer le contrôle », mode caméra, flux vidéo en lecture. */
  219 | async function startScanner(page: Page): Promise<void> {
  220 |     await scannerStartReady(page);
  221 |     await page.getByRole('button', { name: /^commencer le contr[ôo]le$/i }).click();
  222 |     await expect(page.getByRole('button', { name: /^caméra$/i })).toHaveAttribute('aria-pressed', 'true');
  223 |     await page.waitForFunction(() => Array.from(document.querySelectorAll('video')).some((v) => v.readyState >= 2), null, { timeout: 30_000 });
  224 | }
  225 | 
  226 | /** QR présenté au faux BarcodeDetector (fake-camera.ts) : payload au format EVT1 d'un billet du client. */
  227 | async function presentToFakeDetector(page: Page, payload: string): Promise<void> {
  228 |     await page.evaluate((p) => {
  229 |         const cam = (window as unknown as { __evFakeCamera?: { setPayload: (x: string) => void } }).__evFakeCamera;
  230 |         if (!cam) throw new Error('caméra simulée absente de la page (fake-camera.ts)');
  231 |         cam.setPayload(p);
  232 |     }, payload);
  233 | }
  234 | 
  235 | /** Plein écran du résultat affiché (CombatFlashOverlay : data-scan-state="result", data-scan-result). */
  236 | async function expectScanResult(page: Page, result: string): Promise<void> {
  237 |     await expect(page.locator(`[data-scan-state="result"][data-scan-result="${result}"]`)).toBeVisible({ timeout: 20_000 });
  238 | }
  239 | 
  240 | /** Payload EVT1 d'un billet du client de démonstration (la réponse du scan est imposée par stubResponses). */
  241 | function demoPayload(c: ScreenContext): string {
  242 |     return `EVT1:${ids(c.ids).tickets.clientValide}:482913`;
  243 | }
  244 | 
  245 | const SCAN_URL = /\/api\/controller\/scan$/;
  246 | const SCAN_TICKET = { ticket_number: 'TCK-20261104-7C2D9A4B1E', category: 'Standard', holder: 'Fatou Mbaye', is_manual_entry: false };
  247 | /** Délai de retour du scanner pour une entrée validée posé à 3 s (contrat 11.2, initStorage). */
  248 | const SCANNER_STORAGE = { ev_scanner_auto_return_ms: '3000' };
  249 | /** Plein écran tenu pendant les contrôles : retours automatiques de 3 s étirés (×100), « Réseau lent » (1,5 s) intact. */
  250 | const SCANNER_TIMERS = { minDelayMs: 2500, factor: 100 };
  251 | 
  252 | /** Écran d'un résultat de scan : réponse du contrat 3.3 imposée, faux BarcodeDetector, plein écran attendu. */
  253 | function scanResultScreen(id: string, titre: string, body: Record<string, unknown>): Screen {
  254 |     const result = String(body.result);
  255 |     return {
  256 |         id, titre, role: 'controleur', needsIds: true, path: () => '/controller/scanner', views: DARK_VIEWS,
  257 |         fakeCamera: 'barcode-detector', initStorage: SCANNER_STORAGE, slowTimers: SCANNER_TIMERS,
  258 |         stubResponses: [{ url: SCAN_URL, method: 'POST', status: 200, body: { replayed: false, ...body } }],
  259 |         ready: async ({ page }) => startScanner(page),
  260 |         actions: async (c) => {
  261 |             await presentToFakeDetector(c.page, demoPayload(c));
  262 |             await expectScanResult(c.page, result);
  263 |         },
  264 |     };
  265 | }
  266 | 
  267 | /** Lien de la carte d'un billet vers sa page hors ligne (TicketCard, état « available »). */
  268 | function offlineLink(page: Page, ticketId: string): Locator {
  269 |     return page.locator(`a[href="/billet/hors-ligne?id=${encodeURIComponent(ticketId)}"]`);
  270 | }
  271 | 
  272 | const OFFLINE_CODES_URL = /\/api\/tickets\/[^/]+\/offline-codes(\?.*)?$/;
  273 | 
  274 | /** Compteurs du push simulé (fake-push.ts) ; erreur explicite si le script d'initialisation manque. */
  275 | async function fakePushCounters(page: Page): Promise<FakePushCounters> {
  276 |     const counters = await page.evaluate(() => (window as unknown as { __evFakePush?: FakePushCounters }).__evFakePush ?? null);
  277 |     if (!counters) throw new Error('[e2e] push simulé absent de la page (script d’initialisation fake-push.ts non chargé)');
  278 |     return counters;
  279 | }
  280 | 
  281 | /** Page des préférences chargée (section « Vous choisissez ») et état du push sur l'appareil affiché. */
  282 | async function preferencesReady(page: Page, deviceState: RegExp): Promise<void> {
  283 |     await expectHeading(page, /^préférences de notification$/i);
  284 |     await expect(page.getByRole('heading', { name: /^vous choisissez$/i })).toBeVisible();
  285 |     await expect(page.getByText(deviceState).first()).toBeVisible();
  286 | }
  287 | 
  288 | /** Aucune demande d'autorisation au chargement de la page (contrat F4 : seulement après un geste). */
  289 | async function expectNoPermissionPrompt(page: Page): Promise<void> {
  290 |     const counters = await fakePushCounters(page);
  291 |     expect(counters.requestPermissionCalls, 'demandes d’autorisation des notifications au chargement').toBe(0);
  292 | }
  293 | 
  294 | // ── Lot 8 : champ de date, canaux de vente, remboursements ──────────────────
  295 | 
  296 | /** Nœud du document lu par CDP (DOM.getDocument en pierce) : champs utiles seulement. */
  297 | interface CdpNode { nodeType?: number; nodeName?: string; nodeValue?: string; attributes?: string[]; children?: CdpNode[]; shadowRoots?: CdpNode[] }
  298 | 
  299 | function cdpKids(node: CdpNode): CdpNode[] {
  300 |     return [...(node.shadowRoots ?? []), ...(node.children ?? [])];
  301 | }
  302 | 
```