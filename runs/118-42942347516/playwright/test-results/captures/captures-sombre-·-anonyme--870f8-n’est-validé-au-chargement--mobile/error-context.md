# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · anonyme >> verification-email — Vérification d’une adresse email — « Confirmer mon adresse » (rien n’est validé au chargement)
- Location: e2e/captures.spec.ts:174:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: /^vérifier mon adresse email$/i, level: 1 })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: /^vérifier mon adresse email$/i, level: 1 }) with timeout 15000ms
  - waiting for getByRole('heading', { name: /^vérifier mon adresse email$/i, level: 1 })

```

```yaml
- banner:
  - button "Ouvrir le menu"
  - link "Event Village, accueil":
    - /url: /
  - button "Notifications"
  - button "Basculer le thème" [pressed]
  - link "Se connecter":
    - /url: /login
- main:
  - link "Event Village, accueil":
    - /url: /
    - text: EVENT VILLAGE
  - heading "Connexion" [level=1]
  - paragraph: Accédez à vos billets, commandes, réservations et portefeuille.
  - group "Mode de connexion":
    - button "Mot de passe" [pressed]
    - button "Code SMS"
  - text: Email ou téléphone
  - textbox "Email ou téléphone":
    - /placeholder: 77 123 45 67 ou adresse email
  - paragraph: Le numéro sénégalais ou l’adresse email de votre compte.
  - text: Mot de passe
  - link "Mot de passe oublié ?":
    - /url: /forgot-password
  - textbox "Mot de passe"
  - button "Afficher le mot de passe"
  - button "Se connecter"
  - paragraph:
    - text: Pas encore de compte ?
    - link "Créer un compte client":
      - /url: /register?redirect=%2Fverify-email
  - 'link "Espace professionnel Organisateurs, salles et restaurants : devenir partenaire"':
    - /url: /partner/register
- navigation "Navigation rapide":
  - link "Accueil":
    - /url: /
  - link "Explorer":
    - /url: /explore
  - link "Billets":
    - /url: /tickets
  - link "Solde":
    - /url: /wallet
- alert
```

# Test source

```ts
  67  | import type { DemoAccountKey, DemoIds } from './demo-ids';
  68  | import type { FakePushCounters, FakePushMode } from './fake-push';
  69  | import type { CaptureRole } from './fixtures';
  70  | import type { PageGuard } from './network';
  71  | import { expectBuyBarAnchored } from './terrain';
  72  | 
  73  | export interface ScreenContext {
  74  |     page: Page;
  75  |     context: BrowserContext;
  76  |     guard: PageGuard;
  77  |     ids: DemoIds | null;
  78  | }
  79  | 
  80  | /** Vue d'une capture : appareil et thème (lot 7, contrat 11.2). */
  81  | export type CaptureView = 'mobile-clair' | 'mobile-sombre' | 'ordinateur-clair' | 'ordinateur-sombre';
  82  | /** Écrans du contrôleur : thème sombre forcé par app/controller/layout.tsx (D85), deux vues seulement. */
  83  | export const DARK_VIEWS: readonly CaptureView[] = ['mobile-sombre', 'ordinateur-sombre'];
  84  | /** Lot 8 : écrans propres au téléphone (barre d'achat, masquée à partir de lg). */
  85  | export const MOBILE_VIEWS: readonly CaptureView[] = ['mobile-clair', 'mobile-sombre'];
  86  | 
  87  | export interface StubResponse { url: RegExp; method?: string; status: number; body: unknown }
  88  | 
  89  | export interface Screen {
  90  |     id: string;
  91  |     titre: string;
  92  |     role: CaptureRole;
  93  |     /** Faux s'il ne dépend pas du seed de démonstration (accueil, catalogue). */
  94  |     needsIds: boolean;
  95  |     path: (ids: DemoIds | null) => string;
  96  |     /** Attente spécifique avant la capture (contenu attendu). */
  97  |     ready?: (c: ScreenContext) => Promise<void>;
  98  |     /** Interaction avant la capture (onglet, modale, passage hors ligne). */
  99  |     actions?: (c: ScreenContext) => Promise<void>;
  100 |     /** Réponse d'API remplacée par une erreur 500 : capture de l'état d'erreur avec « Réessayer ». */
  101 |     injectError?: RegExp;
  102 |     /** Lot 9 : texte de cette erreur quand l'écran l'affiche tel quel, celui du repli de la route (sinon texte générique). */
  103 |     injectErrorMessage?: string;
  104 |     /** Lot 6 : réponse d'API remplacée par une réponse valide (calqué sur injectError), ex. liste vide. */
  105 |     stubResponse?: { url: RegExp; status: number; body: unknown };
  106 |     /** Lot 6 : état du push simulé avant le chargement (e2e/support/fake-push.ts). */
  107 |     fakePush?: FakePushMode;
  108 |     allowFailures?: RegExp[];
  109 |     /** Caméra simulée (fake-camera.ts) ; 'barcode-detector' impose le faux BarcodeDetector (lot 7). */
  110 |     fakeCamera?: boolean | 'barcode-detector';
  111 |     masks?: (page: Page) => Locator[];
  112 |     /** Lot 7 : vues capturées (défaut : les 4). */
  113 |     views?: readonly CaptureView[];
  114 |     /** Lot 7 : service worker autorisé dans le contexte de cet écran. */
  115 |     serviceWorkers?: 'allow';
  116 |     /** Lot 7 : connexion coupée avant ou après le chargement du document. */
  117 |     offline?: 'before-load' | 'after-load';
  118 |     /** Lot 7 : localStorage posé avant le chargement (clé → valeur). */
  119 |     initStorage?: Record<string, string>;
  120 |     /** Lot 7 : réponses d'API valides imposées (en plus de stubResponse). */
  121 |     stubResponses?: StubResponse[];
  122 |     /** Lot 7 : requêtes retenues, jamais servies. */
  123 |     holdRequests?: Array<{ url: RegExp; method?: string }>;
  124 |     /** Lot 7 : setTimeout de minDelayMs ou plus multipliés par factor (état capturé tenu pendant les contrôles). */
  125 |     slowTimers?: { minDelayMs: number; factor: number };
  126 |     /** Lot 7 : statut HTTP attendu du document (sinon : réponse < 400 non vérifiée, comme avant). */
  127 |     expectStatus?: number;
  128 |     /** Lot 8 : formats exacts, ancrés, de références affichées, qui ne sont pas des valeurs techniques (checks.ts). */
  129 |     references?: readonly RegExp[];
  130 | }
  131 | 
  132 | const UUID = '[0-9a-f-]{36}';
  133 | /** Lot 8 (8.2 h) : UUID bien formé qu'aucun événement ne porte. */
  134 | const UNKNOWN_EVENT_ID = '00000000-0000-4000-8000-000000000404';
  135 | const NOT_AN_EVENT_ID = 'pas-un-identifiant';
  136 | /** Lot 8 (8.2 h) : document et lecture de l'API en 404, attendus par ces écrans. */
  137 | const EVENT_404_FAILURES = [new RegExp(`/api/events/${UUID}(\\?.*)?$`), new RegExp(`/events/${UUID}$`)];
  138 | 
  139 | function ids(i: DemoIds | null): DemoIds {
  140 |     if (!i) throw new Error('[e2e] écran dépendant du seed de démonstration appelé sans identifiants');
  141 |     return i;
  142 | }
  143 | 
  144 | function pilotage(key: keyof DemoIds['events']) {
  145 |     return (i: DemoIds | null) => `/partner/events/${ids(i).events[key].id}`;
  146 | }
  147 | 
  148 | async function openTab(page: Page, name: RegExp): Promise<void> {
  149 |     const tab = page.getByRole('tab', { name });
  150 |     await tab.click();
  151 |     await expect(tab).toHaveAttribute('aria-selected', 'true');
  152 | }
  153 | 
  154 | async function expectRetry(c: ScreenContext): Promise<void> {
  155 |     await expect(c.page.getByRole('button', { name: /réessayer/i })).toBeVisible();
  156 | }
  157 | 
  158 | /**
  159 |  * Amène l'élément au milieu de la fenêtre avant la capture (prise à la taille de l'écran, pas en pleine page) :
  160 |  * sans cela, un état placé sous la ligne de flottaison n'apparaît sur aucune image (relecture du run 77).
  161 |  */
  162 | async function revealCenter(target: Locator): Promise<void> {
  163 |     await target.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
  164 | }
  165 | 
  166 | async function expectHeading(page: Page, name: RegExp): Promise<void> {
> 167 |     await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
      |                                                                 ^ Error: expect(locator).toBeVisible() failed
  168 | }
  169 | 
  170 | // ── Lot 7 : outils des écrans du scanner, du billet hors ligne et des pages migrées ─────────────
  171 | 
  172 | /** Page chargée : un titre de niveau 1 visible (PageHeader du système de design). */
  173 | async function expectPageTitle(page: Page): Promise<void> {
  174 |     await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  175 | }
  176 | 
  177 | /** Écran « Commencer le contrôle » affiché (ScannerStartScreen, D49), événement présélectionné. */
  178 | async function scannerStartReady(page: Page): Promise<void> {
  179 |     await expectHeading(page, /^commencer le contr[ôo]le$/i);
  180 |     await expect(page.getByRole('radio').first()).toBeVisible();
  181 | }
  182 | 
  183 | /** Départ du contrôle : bouton « Commencer le contrôle », mode caméra, flux vidéo en lecture. */
  184 | async function startScanner(page: Page): Promise<void> {
  185 |     await scannerStartReady(page);
  186 |     await page.getByRole('button', { name: /^commencer le contr[ôo]le$/i }).click();
  187 |     await expect(page.getByRole('button', { name: /^caméra$/i })).toHaveAttribute('aria-pressed', 'true');
  188 |     await page.waitForFunction(() => Array.from(document.querySelectorAll('video')).some((v) => v.readyState >= 2), null, { timeout: 30_000 });
  189 | }
  190 | 
  191 | /** QR présenté au faux BarcodeDetector (fake-camera.ts) : payload au format EVT1 d'un billet du client. */
  192 | async function presentToFakeDetector(page: Page, payload: string): Promise<void> {
  193 |     await page.evaluate((p) => {
  194 |         const cam = (window as unknown as { __evFakeCamera?: { setPayload: (x: string) => void } }).__evFakeCamera;
  195 |         if (!cam) throw new Error('caméra simulée absente de la page (fake-camera.ts)');
  196 |         cam.setPayload(p);
  197 |     }, payload);
  198 | }
  199 | 
  200 | /** Plein écran du résultat affiché (CombatFlashOverlay : data-scan-state="result", data-scan-result). */
  201 | async function expectScanResult(page: Page, result: string): Promise<void> {
  202 |     await expect(page.locator(`[data-scan-state="result"][data-scan-result="${result}"]`)).toBeVisible({ timeout: 20_000 });
  203 | }
  204 | 
  205 | /** Payload EVT1 d'un billet du client de démonstration (la réponse du scan est imposée par stubResponses). */
  206 | function demoPayload(c: ScreenContext): string {
  207 |     return `EVT1:${ids(c.ids).tickets.clientValide}:482913`;
  208 | }
  209 | 
  210 | const SCAN_URL = /\/api\/controller\/scan$/;
  211 | const SCAN_TICKET = { ticket_number: 'TCK-20261104-7C2D9A4B1E', category: 'Standard', holder: 'Fatou Mbaye', is_manual_entry: false };
  212 | /** Délai de retour du scanner pour une entrée validée posé à 3 s (contrat 11.2, initStorage). */
  213 | const SCANNER_STORAGE = { ev_scanner_auto_return_ms: '3000' };
  214 | /** Plein écran tenu pendant les contrôles : retours automatiques de 3 s étirés (×100), « Réseau lent » (1,5 s) intact. */
  215 | const SCANNER_TIMERS = { minDelayMs: 2500, factor: 100 };
  216 | 
  217 | /** Écran d'un résultat de scan : réponse du contrat 3.3 imposée, faux BarcodeDetector, plein écran attendu. */
  218 | function scanResultScreen(id: string, titre: string, body: Record<string, unknown>): Screen {
  219 |     const result = String(body.result);
  220 |     return {
  221 |         id, titre, role: 'controleur', needsIds: true, path: () => '/controller/scanner', views: DARK_VIEWS,
  222 |         fakeCamera: 'barcode-detector', initStorage: SCANNER_STORAGE, slowTimers: SCANNER_TIMERS,
  223 |         stubResponses: [{ url: SCAN_URL, method: 'POST', status: 200, body: { replayed: false, ...body } }],
  224 |         ready: async ({ page }) => startScanner(page),
  225 |         actions: async (c) => {
  226 |             await presentToFakeDetector(c.page, demoPayload(c));
  227 |             await expectScanResult(c.page, result);
  228 |         },
  229 |     };
  230 | }
  231 | 
  232 | /** Lien de la carte d'un billet vers sa page hors ligne (TicketCard, état « available »). */
  233 | function offlineLink(page: Page, ticketId: string): Locator {
  234 |     return page.locator(`a[href="/billet/hors-ligne?id=${encodeURIComponent(ticketId)}"]`);
  235 | }
  236 | 
  237 | const OFFLINE_CODES_URL = /\/api\/tickets\/[^/]+\/offline-codes(\?.*)?$/;
  238 | 
  239 | /** Compteurs du push simulé (fake-push.ts) ; erreur explicite si le script d'initialisation manque. */
  240 | async function fakePushCounters(page: Page): Promise<FakePushCounters> {
  241 |     const counters = await page.evaluate(() => (window as unknown as { __evFakePush?: FakePushCounters }).__evFakePush ?? null);
  242 |     if (!counters) throw new Error('[e2e] push simulé absent de la page (script d’initialisation fake-push.ts non chargé)');
  243 |     return counters;
  244 | }
  245 | 
  246 | /** Page des préférences chargée (section « Vous choisissez ») et état du push sur l'appareil affiché. */
  247 | async function preferencesReady(page: Page, deviceState: RegExp): Promise<void> {
  248 |     await expectHeading(page, /^préférences de notification$/i);
  249 |     await expect(page.getByRole('heading', { name: /^vous choisissez$/i })).toBeVisible();
  250 |     await expect(page.getByText(deviceState).first()).toBeVisible();
  251 | }
  252 | 
  253 | /** Aucune demande d'autorisation au chargement de la page (contrat F4 : seulement après un geste). */
  254 | async function expectNoPermissionPrompt(page: Page): Promise<void> {
  255 |     const counters = await fakePushCounters(page);
  256 |     expect(counters.requestPermissionCalls, 'demandes d’autorisation des notifications au chargement').toBe(0);
  257 | }
  258 | 
  259 | // ── Lot 8 : champ de date, canaux de vente, remboursements ──────────────────
  260 | 
  261 | /** Nœud du document lu par CDP (DOM.getDocument en pierce) : champs utiles seulement. */
  262 | interface CdpNode { nodeType?: number; nodeName?: string; nodeValue?: string; attributes?: string[]; children?: CdpNode[]; shadowRoots?: CdpNode[] }
  263 | 
  264 | function cdpKids(node: CdpNode): CdpNode[] {
  265 |     return [...(node.shadowRoots ?? []), ...(node.children ?? [])];
  266 | }
  267 | 
```