# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · client >> notifications-erreur — Notifications du client — état d’erreur
- Location: e2e/captures.spec.ts:90:21

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
  - link "Mon profil (Fatou Mbaye)":
    - /url: /profile
- main:
  - status: En direct
  - heading "Notifications" [level=1]
  - paragraph: "Billets, rappels, paiements et changements d’événement : ce qui concerne votre compte, mis à jour en direct."
  - link "Préférences":
    - /url: /profile/notifications
  - tablist "Filtrer mes notifications":
    - tab "Toutes" [selected]
    - tab "Non lues , 0"
    - tab "Événements"
    - tab "Billets"
    - tab "Paiements et remboursements"
    - tab "Réservations et commandes"
    - tab "Compte"
    - tab "Alertes"
    - tab "Informations"
  - tabpanel "Toutes": Chargement de vos notifications…
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
  2   |  * Lot 5.1 — écrans capturés (contrat P et liste de la découverte 5.1, point 20).
  3   |  * Chaque écran est capturé en mobile (390×844, DPR 2) et en ordinateur (1440×900), en clair et en
  4   |  * sombre. Les routes et les libellés sont ceux du contrat du lot 5 (sections G à J et O) : un écran
  5   |  * qui n'existe pas encore (pilotage, /admin/events…) échoue tant que sa tâche n'est pas livrée.
  6   |  * Les noms d'onglets suivent le composant Tabs du contrat (rôle tab, nom accessible = libellé).
  7   |  * Lot 6 (contrat P1, tâche 6.12) : 13 écrans de plus (connexion, inscription, mot de passe oublié,
  8   |  * préférences de notification dans les trois états du push, cloche ouverte, /notifications vide et en
  9   |  * erreur, billets reçus, supervision admin des notifications : liste, détail, erreur). Deux mécanismes
  10  |  * nouveaux : `stubResponse` (réponse d'API remplacée par une réponse valide, ex. liste vide) et
  11  |  * `fakePush` (e2e/support/fake-push.ts : état du push simulé, ce qui est simulé y est décrit).
  12  |  */
  13  | import type { BrowserContext, Locator, Page } from '@playwright/test';
  14  | import { expect } from '@playwright/test';
  15  | import type { DemoIds } from './demo-ids';
  16  | import type { FakePushCounters, FakePushMode } from './fake-push';
  17  | import type { CaptureRole } from './fixtures';
  18  | import type { PageGuard } from './network';
  19  | 
  20  | export interface ScreenContext {
  21  |     page: Page;
  22  |     context: BrowserContext;
  23  |     guard: PageGuard;
  24  |     ids: DemoIds | null;
  25  | }
  26  | 
  27  | export interface Screen {
  28  |     id: string;
  29  |     titre: string;
  30  |     role: CaptureRole;
  31  |     /** Faux s'il ne dépend pas du seed de démonstration (accueil, catalogue). */
  32  |     needsIds: boolean;
  33  |     path: (ids: DemoIds | null) => string;
  34  |     /** Attente spécifique avant la capture (contenu attendu). */
  35  |     ready?: (c: ScreenContext) => Promise<void>;
  36  |     /** Interaction avant la capture (onglet, modale, passage hors ligne). */
  37  |     actions?: (c: ScreenContext) => Promise<void>;
  38  |     /** Réponse d'API remplacée par une erreur 500 : capture de l'état d'erreur avec « Réessayer ». */
  39  |     injectError?: RegExp;
  40  |     /** Lot 6 : réponse d'API remplacée par une réponse valide (calqué sur injectError), ex. liste vide. */
  41  |     stubResponse?: { url: RegExp; status: number; body: unknown };
  42  |     /** Lot 6 : état du push simulé avant le chargement (e2e/support/fake-push.ts). */
  43  |     fakePush?: FakePushMode;
  44  |     allowFailures?: RegExp[];
  45  |     fakeCamera?: boolean;
  46  |     masks?: (page: Page) => Locator[];
  47  | }
  48  | 
  49  | const UUID = '[0-9a-f-]{36}';
  50  | 
  51  | function ids(i: DemoIds | null): DemoIds {
  52  |     if (!i) throw new Error('[e2e] écran dépendant du seed de démonstration appelé sans identifiants');
  53  |     return i;
  54  | }
  55  | 
  56  | function pilotage(key: keyof DemoIds['events']) {
  57  |     return (i: DemoIds | null) => `/partner/events/${ids(i).events[key].id}`;
  58  | }
  59  | 
  60  | async function openTab(page: Page, name: RegExp): Promise<void> {
  61  |     const tab = page.getByRole('tab', { name });
  62  |     await tab.click();
  63  |     await expect(tab).toHaveAttribute('aria-selected', 'true');
  64  | }
  65  | 
  66  | async function expectRetry(c: ScreenContext): Promise<void> {
> 67  |     await expect(c.page.getByRole('button', { name: /réessayer/i })).toBeVisible();
      |                                                                      ^ Error: expect(locator).toBeVisible() failed
  68  | }
  69  | 
  70  | async function expectHeading(page: Page, name: RegExp): Promise<void> {
  71  |     await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  72  | }
  73  | 
  74  | /** Compteurs du push simulé (fake-push.ts) ; erreur explicite si le script d'initialisation manque. */
  75  | async function fakePushCounters(page: Page): Promise<FakePushCounters> {
  76  |     const counters = await page.evaluate(() => (window as unknown as { __evFakePush?: FakePushCounters }).__evFakePush ?? null);
  77  |     if (!counters) throw new Error('[e2e] push simulé absent de la page (script d’initialisation fake-push.ts non chargé)');
  78  |     return counters;
  79  | }
  80  | 
  81  | /** Page des préférences chargée (section « Vous choisissez ») et état du push sur l'appareil affiché. */
  82  | async function preferencesReady(page: Page, deviceState: RegExp): Promise<void> {
  83  |     await expectHeading(page, /^préférences de notification$/i);
  84  |     await expect(page.getByRole('heading', { name: /^vous choisissez$/i })).toBeVisible();
  85  |     await expect(page.getByText(deviceState).first()).toBeVisible();
  86  | }
  87  | 
  88  | /** Aucune demande d'autorisation au chargement de la page (contrat F4 : seulement après un geste). */
  89  | async function expectNoPermissionPrompt(page: Page): Promise<void> {
  90  |     const counters = await fakePushCounters(page);
  91  |     expect(counters.requestPermissionCalls, 'demandes d’autorisation des notifications au chargement').toBe(0);
  92  | }
  93  | 
  94  | function tabScreen(id: string, titre: string, tab: RegExp): Screen {
  95  |     return {
  96  |         id, titre, role: 'organisateur', needsIds: true, path: pilotage('ceSoir'),
  97  |         actions: async ({ page }) => openTab(page, tab),
  98  |     };
  99  | }
  100 | 
  101 | export const SCREENS: readonly Screen[] = [
  102 |     // ── Public ──────────────────────────────────────────────────────────────
  103 |     { id: 'accueil', titre: 'Accueil', role: 'anonyme', needsIds: false, path: () => '/' },
  104 |     { id: 'catalogue', titre: 'Catalogue des événements', role: 'anonyme', needsIds: false, path: () => '/explore' },
  105 |     { id: 'evenement-publie', titre: 'Page publique — événement publié (ce soir)', role: 'anonyme', needsIds: true, path: (i) => `/events/${ids(i).events.ceSoir.id}` },
  106 |     {
  107 |         id: 'evenement-suspendu', titre: 'Page publique — événement suspendu (bandeau, sans achat)', role: 'anonyme', needsIds: true,
  108 |         path: (i) => `/events/${ids(i).events.suspendu.id}`,
  109 |         ready: async ({ page }) => { await expect(page.getByText(/suspendu/i).first()).toBeVisible(); },
  110 |     },
  111 |     {
  112 |         id: 'evenement-annule', titre: 'Page publique — événement annulé (avis public, remboursement)', role: 'anonyme', needsIds: true,
  113 |         path: (i) => `/events/${ids(i).events.annule.id}`,
  114 |         ready: async ({ page }) => { await expect(page.getByText(/annulé/i).first()).toBeVisible(); },
  115 |     },
  116 |     {
  117 |         id: 'evenement-termine', titre: 'Page publique — événement terminé (archive)', role: 'anonyme', needsIds: true,
  118 |         path: (i) => `/events/${ids(i).events.termine.id}`,
  119 |         ready: async ({ page }) => { await expect(page.getByText(/terminé/i).first()).toBeVisible(); },
  120 |     },
  121 |     {
  122 |         id: 'evenement-non-public', titre: 'URL d’un brouillon : page introuvable propre', role: 'anonyme', needsIds: true,
  123 |         path: (i) => `/events/${ids(i).events.brouillon.id}`,
  124 |         allowFailures: [new RegExp(`/api/events/${UUID}(\\?.*)?$`), new RegExp(`/events/${UUID}$`)],
  125 |         ready: async ({ page }) => { await expect(page.getByText(/introuvable|n[’']existe pas|404/i).first()).toBeVisible(); },
  126 |     },
  127 |     {
  128 |         id: 'hors-ligne', titre: 'Indicateur « Hors ligne » (catalogue ouvert, connexion coupée)', role: 'anonyme', needsIds: false, path: () => '/explore',
  129 |         actions: async ({ page, context, guard }) => {
  130 |             guard.freeze();
  131 |             await context.setOffline(true);
  132 |             await expect(page.getByText(/hors ligne/i).first()).toBeVisible({ timeout: 20_000 });
  133 |         },
  134 |     },
  135 |     // ── Authentification (lot 6, 6.0 e) ─────────────────────────────────────
  136 |     {
  137 |         id: 'connexion', titre: 'Connexion (système de design)', role: 'anonyme', needsIds: false, path: () => '/login',
  138 |         ready: async ({ page }) => {
  139 |             await expectHeading(page, /^connexion$/i);
  140 |             await expect(page.getByRole('button', { name: /^se connecter$/i })).toBeVisible();
  141 |         },
  142 |     },
  143 |     {
  144 |         id: 'inscription', titre: 'Inscription (système de design)', role: 'anonyme', needsIds: false, path: () => '/register',
  145 |         ready: async ({ page }) => { await expectHeading(page, /^créer un compte$/i); },
  146 |     },
  147 |     {
  148 |         id: 'mot-de-passe-oublie', titre: 'Mot de passe oublié (système de design)', role: 'anonyme', needsIds: false, path: () => '/forgot-password',
  149 |         ready: async ({ page }) => { await expectHeading(page, /^mot de passe oublié$/i); },
  150 |     },
  151 |     // ── Client ──────────────────────────────────────────────────────────────
  152 |     {
  153 |         id: 'mes-billets', titre: 'Mes billets (QR masqué)', role: 'client', needsIds: true, path: () => '/tickets',
  154 |         masks: (page) => [page.getByRole('img', { name: /QR/i })],
  155 |     },
  156 |     {
  157 |         id: 'mes-billets-recus', titre: 'Mes billets — onglet « Reçus » (transfert entrant à accepter)', role: 'client', needsIds: true,
  158 |         path: () => '/tickets?tab=recus',
  159 |         ready: async ({ page }) => {
  160 |             await expect(page.getByRole('tab', { name: /^reçus/i })).toHaveAttribute('aria-selected', 'true');
  161 |             await expect(page.getByRole('button', { name: /^accepter le billet$/i }).first()).toBeVisible();
  162 |         },
  163 |     },
  164 |     {
  165 |         id: 'preferences-push-active', titre: 'Préférences de notification — push activé sur l’appareil (abonnement simulé)', role: 'client', needsIds: true,
  166 |         path: () => '/profile/notifications', fakePush: 'granted',
  167 |         ready: async ({ page }) => {
```