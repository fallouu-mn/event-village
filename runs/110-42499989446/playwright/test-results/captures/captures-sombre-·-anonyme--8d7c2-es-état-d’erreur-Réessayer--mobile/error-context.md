# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · anonyme >> accueil-populaires-erreur — Accueil — Populaires, état d’erreur (Réessayer)
- Location: e2e/captures.spec.ts:174:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: /réessayer/i })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('button', { name: /réessayer/i }) with timeout 15000ms
  - waiting for getByRole('button', { name: /réessayer/i })

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
  - paragraph: Billetterie officielle au Sénégal
  - heading "Découvrez, réservez et vivez les événements qui comptent." [level=1]
  - paragraph: "Concerts, festivals, soirées et rencontres : choisissez votre place, payez en quelques secondes et présentez votre billet à l’entrée."
  - search:
    - text: Rechercher un événement
    - searchbox "Rechercher un événement"
    - button "Explorer"
  - list:
    - listitem:
      - paragraph: Wave et Orange Money
      - paragraph: Payez depuis votre téléphone, le billet arrive aussitôt.
    - listitem:
      - paragraph: QR code dynamique
      - paragraph: "Un code renouvelé en continu : une capture d’écran ne passe pas l’entrée."
    - listitem:
      - paragraph: Remboursement automatique
      - paragraph: "Événement annulé : les billets payés en ligne sont remboursés."
  - region "À l’affiche":
    - heading "À l’affiche" [level=2]
    - status: En direct
    - link "Tous les événements":
      - /url: /explore
    - group "Catégorie":
      - button "Tous" [pressed]
      - button "Concerts & Musique"
      - button "Festivals"
      - button "Gastronomie & Tables"
      - button "Salles & Réceptions"
    - list:
      - listitem:
        - article:
          - paragraph: Baobab Scène
          - heading "Nuit du Sabar — édition d’automne" [level=3]:
            - link "Nuit du Sabar — édition d’automne":
              - /url: /events/708dc7ca-aaf1-400d-be6b-33df27beb3c1
          - text: Concerts & Musique
          - list:
            - listitem: 08 NOV 2026 à 17:45
            - listitem: Esplanade de la Corniche Ouest, Dakar
          - paragraph: À partir de
          - paragraph: 5 000 F CFA
      - listitem:
        - article:
          - paragraph: Baobab Scène
          - heading "Concert des Lumières de Gorée" [level=3]:
            - link "Concert des Lumières de Gorée":
              - /url: /events/9b7379a0-c736-4c98-8e75-321427086a53
          - text: Concerts & Musique
          - list:
            - listitem: 09 NOV 2026 à 13:00
            - listitem: Place du Gouvernement, Gorée
          - paragraph: À partir de
          - paragraph: 6 000 F CFA
      - listitem:
        - article:
          - paragraph: Petite-Côte Événements
          - heading "Marché gourmand de la Petite-Côte" [level=3]:
            - link "Marché gourmand de la Petite-Côte":
              - /url: /events/c1145e70-7915-4477-9657-d283c2ad7d8f
          - text: Gastronomie & Tables
          - list:
            - listitem: 13 NOV 2026 à 10:00
            - listitem: Place du Marché Central, Mbour
          - paragraph: À partir de
          - paragraph: 1 000 F CFA
      - listitem:
        - article:
          - paragraph: Saloum Culture
          - heading "Dîner-spectacle au bord du Saloum" [level=3]:
            - link "Dîner-spectacle au bord du Saloum":
              - /url: /events/4f2efd7a-173a-43a0-9cfa-c45a0a99b7ce
          - text: Salles & Réceptions
          - list:
            - listitem: 16 NOV 2026 à 20:00
            - listitem: Terrasse des Pirogues, Foundiougne
          - paragraph: À partir de
          - paragraph: 25 000 F CFA
      - listitem:
        - article:
          - paragraph: Baobab Scène
          - heading "Festival Jazz sur le Fleuve" [level=3]:
            - link "Festival Jazz sur le Fleuve":
              - /url: /events/b52d1a87-c3ac-45d1-8cfa-6d28a1267a84
          - text: Festivals
          - list:
            - listitem: 20 NOV 2026 à 18:00
            - listitem: Quai des Pêcheurs, Saint-Louis
          - paragraph: À partir de
          - paragraph: 7 500 F CFA
      - listitem:
        - article:
          - paragraph: Baobab Scène
          - heading "Soirée Kora & Lumières" [level=3]:
            - link "Soirée Kora & Lumières":
              - /url: /events/0d42c081-7200-4d5e-8315-1e0cd8f86f34
          - text: Concerts & Musique
          - list:
            - listitem: 25 NOV 2026 à 20:30
            - listitem: Jardin de la Maison des Arts, Dakar
          - paragraph: À partir de
          - paragraph: 6 000 F CFA
      - listitem:
        - article:
          - paragraph: Orga B (test)
          - heading "TEST Spectacle B (publié, à venir)" [level=3]:
            - link "TEST Spectacle B (publié, à venir)":
              - /url: /events/b7851e01-4113-48f5-8817-42edad039468
          - text: Concerts & Musique
          - list:
            - listitem: 28 NOV 2026 à 20:00
            - listitem: Salle de test, Dakar, Dakar
          - paragraph: À partir de
          - paragraph: 4 000 F CFA
      - listitem:
        - article:
          - paragraph: Saloum Culture
          - heading "Gala des entrepreneurs du Saloum" [level=3]:
            - link "Gala des entrepreneurs du Saloum":
              - /url: /events/e12a453f-7b09-4542-aee8-5d4f5d606811
          - text: Salles & Réceptions
          - list:
            - listitem: 29 NOV 2026 à 19:30
            - listitem: Salle des Palétuviers, Kaolack
          - paragraph: À partir de
          - paragraph: 10 000 F CFA
  - region "Vous organisez des événements ? Vendez vos billets avec Event Village.":
    - paragraph: Espace organisateur
    - heading "Vous organisez des événements ? Vendez vos billets avec Event Village." [level=2]
    - list:
      - listitem: Création et publication de vos événements, validées par notre équipe
      - listitem: Ventes et entrées suivies en direct, contrôleurs et caisses sur place
      - listitem: Fonds versés sur votre compte après l’événement
    - link "Devenir organisateur":
      - /url: /partner/register
  - paragraph: Event Village
  - paragraph: Billetterie et événements au Sénégal.
  - navigation "Liens du pied de page":
    - list:
      - listitem:
        - link "Explorer":
          - /url: /explore
      - listitem:
        - link "Mes billets":
          - /url: /tickets
      - listitem:
        - link "Devenir organisateur":
          - /url: /partner/register
  - paragraph: Event Village, 2026. Tous droits réservés.
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
  39  |  * route est prouvée par admin-remboursements et par l'acte 8 de la recette.
  40  |  *
  41  |  * Vague F, écrans livrés (modifications signalées, aucun seuil relâché) :
  42  |  *  - partenaire-rapport-cloture : libellés de fix(8.2r) exigés (« Rapport de clôture », « Télécharger le PDF », « Entrées »,
  43  |  *    « Généré le … ») ; `references` : le numéro CLOTURE-… n'est pas une valeur technique ; fond ramené en haut de page avant
  44  |  *    les contrôles : à 390 px, la feuille coupait un bouton du tableau de bord, relevé par axe target-size (run 96) ;
  45  |  *  - pilotage-rembourser-billet : libellés de fix(8.3-A4e) exigés, fiche d'un billet payant (seed), « Revenir à la fiche » joué.
  46  |  *
  47  |  * Lot 9 (contrat section 7 ; T26) : scanner-a-encaisser retirée (A16 : plus d'encaissement au scan) ; accueil attend Populaires ;
  48  |  * sept captures ajoutées, rouges jusqu'à leurs écrans (fix(9.0e), fix(9.1e), fix(9.2e)) : invitations-onglet,
  49  |  * invitations-confirmation, mes-paiements, profil, changement-numero, accueil-ville, accueil-populaires-erreur.
  50  |  */
  51  | import type { BrowserContext, Locator, Page } from '@playwright/test';
  52  | import { expect } from '@playwright/test';
  53  | import type { DemoIds } from './demo-ids';
  54  | import type { FakePushCounters, FakePushMode } from './fake-push';
  55  | import type { CaptureRole } from './fixtures';
  56  | import type { PageGuard } from './network';
  57  | import { expectBuyBarAnchored } from './terrain';
  58  | 
  59  | export interface ScreenContext {
  60  |     page: Page;
  61  |     context: BrowserContext;
  62  |     guard: PageGuard;
  63  |     ids: DemoIds | null;
  64  | }
  65  | 
  66  | /** Vue d'une capture : appareil et thème (lot 7, contrat 11.2). */
  67  | export type CaptureView = 'mobile-clair' | 'mobile-sombre' | 'ordinateur-clair' | 'ordinateur-sombre';
  68  | /** Écrans du contrôleur : thème sombre forcé par app/controller/layout.tsx (D85), deux vues seulement. */
  69  | export const DARK_VIEWS: readonly CaptureView[] = ['mobile-sombre', 'ordinateur-sombre'];
  70  | /** Lot 8 : écrans propres au téléphone (barre d'achat, masquée à partir de lg). */
  71  | export const MOBILE_VIEWS: readonly CaptureView[] = ['mobile-clair', 'mobile-sombre'];
  72  | 
  73  | export interface StubResponse { url: RegExp; method?: string; status: number; body: unknown }
  74  | 
  75  | export interface Screen {
  76  |     id: string;
  77  |     titre: string;
  78  |     role: CaptureRole;
  79  |     /** Faux s'il ne dépend pas du seed de démonstration (accueil, catalogue). */
  80  |     needsIds: boolean;
  81  |     path: (ids: DemoIds | null) => string;
  82  |     /** Attente spécifique avant la capture (contenu attendu). */
  83  |     ready?: (c: ScreenContext) => Promise<void>;
  84  |     /** Interaction avant la capture (onglet, modale, passage hors ligne). */
  85  |     actions?: (c: ScreenContext) => Promise<void>;
  86  |     /** Réponse d'API remplacée par une erreur 500 : capture de l'état d'erreur avec « Réessayer ». */
  87  |     injectError?: RegExp;
  88  |     /** Lot 6 : réponse d'API remplacée par une réponse valide (calqué sur injectError), ex. liste vide. */
  89  |     stubResponse?: { url: RegExp; status: number; body: unknown };
  90  |     /** Lot 6 : état du push simulé avant le chargement (e2e/support/fake-push.ts). */
  91  |     fakePush?: FakePushMode;
  92  |     allowFailures?: RegExp[];
  93  |     /** Caméra simulée (fake-camera.ts) ; 'barcode-detector' impose le faux BarcodeDetector (lot 7). */
  94  |     fakeCamera?: boolean | 'barcode-detector';
  95  |     masks?: (page: Page) => Locator[];
  96  |     /** Lot 7 : vues capturées (défaut : les 4). */
  97  |     views?: readonly CaptureView[];
  98  |     /** Lot 7 : service worker autorisé dans le contexte de cet écran. */
  99  |     serviceWorkers?: 'allow';
  100 |     /** Lot 7 : connexion coupée avant ou après le chargement du document. */
  101 |     offline?: 'before-load' | 'after-load';
  102 |     /** Lot 7 : localStorage posé avant le chargement (clé → valeur). */
  103 |     initStorage?: Record<string, string>;
  104 |     /** Lot 7 : réponses d'API valides imposées (en plus de stubResponse). */
  105 |     stubResponses?: StubResponse[];
  106 |     /** Lot 7 : requêtes retenues, jamais servies. */
  107 |     holdRequests?: Array<{ url: RegExp; method?: string }>;
  108 |     /** Lot 7 : setTimeout de minDelayMs ou plus multipliés par factor (état capturé tenu pendant les contrôles). */
  109 |     slowTimers?: { minDelayMs: number; factor: number };
  110 |     /** Lot 7 : statut HTTP attendu du document (sinon : réponse < 400 non vérifiée, comme avant). */
  111 |     expectStatus?: number;
  112 |     /** Lot 8 : formats exacts, ancrés, de références affichées, qui ne sont pas des valeurs techniques (checks.ts). */
  113 |     references?: readonly RegExp[];
  114 | }
  115 | 
  116 | const UUID = '[0-9a-f-]{36}';
  117 | /** Lot 8 (8.2 h) : UUID bien formé qu'aucun événement ne porte. */
  118 | const UNKNOWN_EVENT_ID = '00000000-0000-4000-8000-000000000404';
  119 | const NOT_AN_EVENT_ID = 'pas-un-identifiant';
  120 | /** Lot 8 (8.2 h) : document et lecture de l'API en 404, attendus par ces écrans. */
  121 | const EVENT_404_FAILURES = [new RegExp(`/api/events/${UUID}(\\?.*)?$`), new RegExp(`/events/${UUID}$`)];
  122 | 
  123 | function ids(i: DemoIds | null): DemoIds {
  124 |     if (!i) throw new Error('[e2e] écran dépendant du seed de démonstration appelé sans identifiants');
  125 |     return i;
  126 | }
  127 | 
  128 | function pilotage(key: keyof DemoIds['events']) {
  129 |     return (i: DemoIds | null) => `/partner/events/${ids(i).events[key].id}`;
  130 | }
  131 | 
  132 | async function openTab(page: Page, name: RegExp): Promise<void> {
  133 |     const tab = page.getByRole('tab', { name });
  134 |     await tab.click();
  135 |     await expect(tab).toHaveAttribute('aria-selected', 'true');
  136 | }
  137 | 
  138 | async function expectRetry(c: ScreenContext): Promise<void> {
> 139 |     await expect(c.page.getByRole('button', { name: /réessayer/i })).toBeVisible();
      |                                                                      ^ Error: expect(locator).toBeVisible() failed
  140 | }
  141 | 
  142 | /**
  143 |  * Amène l'élément au milieu de la fenêtre avant la capture (prise à la taille de l'écran, pas en pleine page) :
  144 |  * sans cela, un état placé sous la ligne de flottaison n'apparaît sur aucune image (relecture du run 77).
  145 |  */
  146 | async function revealCenter(target: Locator): Promise<void> {
  147 |     await target.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
  148 | }
  149 | 
  150 | async function expectHeading(page: Page, name: RegExp): Promise<void> {
  151 |     await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  152 | }
  153 | 
  154 | // ── Lot 7 : outils des écrans du scanner, du billet hors ligne et des pages migrées ─────────────
  155 | 
  156 | /** Page chargée : un titre de niveau 1 visible (PageHeader du système de design). */
  157 | async function expectPageTitle(page: Page): Promise<void> {
  158 |     await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  159 | }
  160 | 
  161 | /** Écran « Commencer le contrôle » affiché (ScannerStartScreen, D49), événement présélectionné. */
  162 | async function scannerStartReady(page: Page): Promise<void> {
  163 |     await expectHeading(page, /^commencer le contr[ôo]le$/i);
  164 |     await expect(page.getByRole('radio').first()).toBeVisible();
  165 | }
  166 | 
  167 | /** Départ du contrôle : bouton « Commencer le contrôle », mode caméra, flux vidéo en lecture. */
  168 | async function startScanner(page: Page): Promise<void> {
  169 |     await scannerStartReady(page);
  170 |     await page.getByRole('button', { name: /^commencer le contr[ôo]le$/i }).click();
  171 |     await expect(page.getByRole('button', { name: /^caméra$/i })).toHaveAttribute('aria-pressed', 'true');
  172 |     await page.waitForFunction(() => Array.from(document.querySelectorAll('video')).some((v) => v.readyState >= 2), null, { timeout: 30_000 });
  173 | }
  174 | 
  175 | /** QR présenté au faux BarcodeDetector (fake-camera.ts) : payload au format EVT1 d'un billet du client. */
  176 | async function presentToFakeDetector(page: Page, payload: string): Promise<void> {
  177 |     await page.evaluate((p) => {
  178 |         const cam = (window as unknown as { __evFakeCamera?: { setPayload: (x: string) => void } }).__evFakeCamera;
  179 |         if (!cam) throw new Error('caméra simulée absente de la page (fake-camera.ts)');
  180 |         cam.setPayload(p);
  181 |     }, payload);
  182 | }
  183 | 
  184 | /** Plein écran du résultat affiché (CombatFlashOverlay : data-scan-state="result", data-scan-result). */
  185 | async function expectScanResult(page: Page, result: string): Promise<void> {
  186 |     await expect(page.locator(`[data-scan-state="result"][data-scan-result="${result}"]`)).toBeVisible({ timeout: 20_000 });
  187 | }
  188 | 
  189 | /** Payload EVT1 d'un billet du client de démonstration (la réponse du scan est imposée par stubResponses). */
  190 | function demoPayload(c: ScreenContext): string {
  191 |     return `EVT1:${ids(c.ids).tickets.clientValide}:482913`;
  192 | }
  193 | 
  194 | const SCAN_URL = /\/api\/controller\/scan$/;
  195 | const SCAN_TICKET = { ticket_number: 'TCK-20261104-7C2D9A4B1E', category: 'Standard', holder: 'Fatou Mbaye', is_manual_entry: false };
  196 | /** Délai de retour du scanner pour une entrée validée posé à 3 s (contrat 11.2, initStorage). */
  197 | const SCANNER_STORAGE = { ev_scanner_auto_return_ms: '3000' };
  198 | /** Plein écran tenu pendant les contrôles : retours automatiques de 3 s étirés (×100), « Réseau lent » (1,5 s) intact. */
  199 | const SCANNER_TIMERS = { minDelayMs: 2500, factor: 100 };
  200 | 
  201 | /** Écran d'un résultat de scan : réponse du contrat 3.3 imposée, faux BarcodeDetector, plein écran attendu. */
  202 | function scanResultScreen(id: string, titre: string, body: Record<string, unknown>): Screen {
  203 |     const result = String(body.result);
  204 |     return {
  205 |         id, titre, role: 'controleur', needsIds: true, path: () => '/controller/scanner', views: DARK_VIEWS,
  206 |         fakeCamera: 'barcode-detector', initStorage: SCANNER_STORAGE, slowTimers: SCANNER_TIMERS,
  207 |         stubResponses: [{ url: SCAN_URL, method: 'POST', status: 200, body: { replayed: false, ...body } }],
  208 |         ready: async ({ page }) => startScanner(page),
  209 |         actions: async (c) => {
  210 |             await presentToFakeDetector(c.page, demoPayload(c));
  211 |             await expectScanResult(c.page, result);
  212 |         },
  213 |     };
  214 | }
  215 | 
  216 | /** Lien de la carte d'un billet vers sa page hors ligne (TicketCard, état « available »). */
  217 | function offlineLink(page: Page, ticketId: string): Locator {
  218 |     return page.locator(`a[href="/billet/hors-ligne?id=${encodeURIComponent(ticketId)}"]`);
  219 | }
  220 | 
  221 | const OFFLINE_CODES_URL = /\/api\/tickets\/[^/]+\/offline-codes(\?.*)?$/;
  222 | 
  223 | /** Compteurs du push simulé (fake-push.ts) ; erreur explicite si le script d'initialisation manque. */
  224 | async function fakePushCounters(page: Page): Promise<FakePushCounters> {
  225 |     const counters = await page.evaluate(() => (window as unknown as { __evFakePush?: FakePushCounters }).__evFakePush ?? null);
  226 |     if (!counters) throw new Error('[e2e] push simulé absent de la page (script d’initialisation fake-push.ts non chargé)');
  227 |     return counters;
  228 | }
  229 | 
  230 | /** Page des préférences chargée (section « Vous choisissez ») et état du push sur l'appareil affiché. */
  231 | async function preferencesReady(page: Page, deviceState: RegExp): Promise<void> {
  232 |     await expectHeading(page, /^préférences de notification$/i);
  233 |     await expect(page.getByRole('heading', { name: /^vous choisissez$/i })).toBeVisible();
  234 |     await expect(page.getByText(deviceState).first()).toBeVisible();
  235 | }
  236 | 
  237 | /** Aucune demande d'autorisation au chargement de la page (contrat F4 : seulement après un geste). */
  238 | async function expectNoPermissionPrompt(page: Page): Promise<void> {
  239 |     const counters = await fakePushCounters(page);
```