# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · client >> salles-catalogue — Salles de fête — catalogue
- Location: e2e/responsive.spec.ts:76:21

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: /^salles de fête$/i, level: 1 })
Expected: visible
Timeout: 30000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: /^salles de fête$/i, level: 1 }) with timeout 30000ms
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
  31  |     titre: string;
  32  |     groupe: ResponsiveGroup;
  33  |     role: CaptureRole;
  34  |     needsIds?: boolean;
  35  |     path: (ids: DemoIds | null) => string;
  36  |     /** Contenu utile affiché (défaut : un titre de niveau 1 visible). */
  37  |     ready?: (page: Page) => Promise<void>;
  38  |     /** État à contrôler (onglet, fenêtre ouverte…), rejoué après chaque chargement. */
  39  |     actions?: (page: Page) => Promise<void>;
  40  |     /** Caméra simulée (scanner démarré). */
  41  |     fakeCamera?: boolean;
  42  |     /** Contrôle aussi en paysage (scanner). */
  43  |     paysage?: boolean;
  44  |     /** Statut HTTP attendu du document (404 de la page introuvable). */
  45  |     expectStatus?: number;
  46  |     /** Requêtes en échec attendues (404 d'une page introuvable). */
  47  |     allowFailures?: RegExp[];
  48  |     /**
  49  |      * Lot 10b : page des salles de fête (app/halls, app/partner/halls), en 404 tant que l'interrupteur features.halls_enabled
  50  |      * est fermé : ouvert le temps du test, sous le verrou entre les workers (e2e/support/halls-switch.ts).
  51  |      */
  52  |     salles?: boolean;
  53  | }
  54  | 
  55  | /** Largeurs contrôlées, et hauteur de la fenêtre à chaque largeur (téléphones, tablette portrait, tablette paysage, ordinateur). */
  56  | export const RESPONSIVE_WIDTHS = [
  57  |     { width: 320, height: 568 },
  58  |     { width: 360, height: 800 },
  59  |     { width: 390, height: 844 },
  60  |     { width: 768, height: 1024 },
  61  |     { width: 1024, height: 768 },
  62  |     { width: 1440, height: 900 },
  63  | ] as const;
  64  | 
  65  | /** Largeurs capturées (en clair et en sombre). */
  66  | export const RESPONSIVE_CAPTURE_WIDTHS: readonly number[] = [360, 768, 1440];
  67  | 
  68  | /** Paysage du scanner : téléphone tenu en largeur (petit et moyen). */
  69  | export const RESPONSIVE_LANDSCAPE = [
  70  |     { width: 640, height: 360 },
  71  |     { width: 844, height: 390 },
  72  | ] as const;
  73  | 
  74  | /** Au plus cette largeur : téléphone (tableaux interdits, cartes attendues). */
  75  | export const PHONE_MAX_WIDTH = 390;
  76  | 
  77  | function ids(i: DemoIds | null): DemoIds {
  78  |     if (!i) throw new Error('[e2e] page dépendant du seed de démonstration appelée sans identifiants');
  79  |     return i;
  80  | }
  81  | 
  82  | async function title(page: Page): Promise<void> {
  83  |     await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
  84  | }
  85  | 
  86  | function pilotage(key: keyof DemoIds['events'], tab?: string) {
  87  |     return (i: DemoIds | null) => `/partner/events/${ids(i).events[key].id}${tab ? `?tab=${tab}` : ''}`;
  88  | }
  89  | 
  90  | async function tabSelected(page: Page, name: RegExp): Promise<void> {
  91  |     await title(page);
  92  |     await expect(page.getByRole('tab', { name, selected: true })).toBeVisible({ timeout: 30_000 });
  93  | }
  94  | 
  95  | async function scannerStart(page: Page): Promise<void> {
  96  |     await expect(page.getByRole('heading', { level: 1, name: /^commencer le contr[ôo]le$/i })).toBeVisible({ timeout: 30_000 });
  97  | }
  98  | 
  99  | async function scannerStarted(page: Page): Promise<void> {
  100 |     // Rechargé à chaque largeur : le scanner reprend le contrôle déjà démarré (reprise du lot 7, A10) ; l'écran de départ
  101 |     // n'apparaît qu'au premier chargement (run 439 : attente de l'écran de départ à 360 px, jamais affiché).
  102 |     const start = page.getByRole('heading', { level: 1, name: /^commencer le contr[ôo]le$/i });
  103 |     const camera = page.getByRole('button', { name: /^caméra$/i });
  104 |     await expect(start.or(camera).first()).toBeVisible({ timeout: 30_000 });
  105 |     if (await start.isVisible()) await page.getByRole('button', { name: /^commencer le contr[ôo]le$/i }).click();
  106 |     // Reprise : la caméra attend le geste « Reprendre le contrôle » (A10)
  107 |     const resume = page.getByRole('button', { name: /^reprendre le contr[ôo]le$/i });
  108 |     const needsResume = await resume.waitFor({ state: 'visible', timeout: 3_000 }).then(() => true, () => false); // absent : caméra déjà relancée
  109 |     if (needsResume) await resume.click();
  110 |     await expect(page.getByRole('button', { name: /^caméra$/i })).toHaveAttribute('aria-pressed', 'true');
  111 |     await page.waitForFunction(() => Array.from(document.querySelectorAll('video')).some((v) => v.readyState >= 2), null, { timeout: 30_000 });
  112 | }
  113 | 
  114 | // ── Lot 10b : salles de fête (salles et réservation du seed de démonstration, DemoIds.halls) ──────────────
  115 | 
  116 | /**
  117 |  * Préchargement de « Voir le détail » de la notification « Réservation demandée » du client (graine v5) : 404 tant que
  118 |  * l'interrupteur des salles est fermé. Même motif que HALL_RESERVATION_PREFETCH de screens.ts (recopié : ce module reste
  119 |  * sans dépendance vers les écrans, il est lu par tests/schema/design1c-responsive.test.ts).
  120 |  */
  121 | const HALL_RESERVATION_PREFETCH = /\/halls\/reservations\/[0-9a-f-]{36}(\?_rsc=[^/]*)?$/;
  122 | 
  123 | function hallOf(i: DemoIds | null, key: DemoHallKey): DemoIds['halls'][DemoHallKey] {
  124 |     return ids(i).halls[key];
  125 | }
  126 | 
  127 | async function titled(page: Page, name: RegExp | string): Promise<void> {
  128 |     const heading = typeof name === 'string'
  129 |         ? page.getByRole('heading', { level: 1, name, exact: true })
  130 |         : page.getByRole('heading', { level: 1, name });
> 131 |     await expect(heading).toBeVisible({ timeout: 30_000 });
      |                           ^ Error: expect(locator).toBeVisible() failed
  132 | }
  133 | 
  134 | /** Titre de niveau 1 : nom d'une salle du seed (lu dans demo-ids.json, comme l'adresse de la page). */
  135 | function hallTitle(key: DemoHallKey) {
  136 |     return async (page: Page): Promise<void> => { await titled(page, readDemoIds().halls[key].name); };
  137 | }
  138 | 
  139 | async function hallsCatalogReady(page: Page): Promise<void> {
  140 |     await titled(page, /^salles de fête$/i);
  141 |     const name = readDemoIds().halls.validee.name;
  142 |     await expect(page.getByRole('heading', { level: 3, name, exact: true }), `salle « ${name} » au catalogue`).toBeVisible();
  143 | }
  144 | 
  145 | async function myHallReservationsReady(page: Page): Promise<void> {
  146 |     await titled(page, /^mes réservations$/i);
  147 |     await expect(page.getByRole('tab', { name: /^à venir/i, selected: true })).toBeVisible();
  148 |     const name = readDemoIds().halls.validee.name;
  149 |     await expect(page.getByRole('heading', { level: 3, name, exact: true }), `réservation de « ${name} » en attente de paiement`).toBeVisible();
  150 | }
  151 | 
  152 | async function partnerHallsReady(page: Page): Promise<void> {
  153 |     await titled(page, /^mes salles$/i);
  154 |     const { validee, enAttente, refusee } = readDemoIds().halls;
  155 |     for (const h of [validee, enAttente, refusee]) {
  156 |         await expect(page.getByRole('heading', { level: 2, name: h.name, exact: true }), `salle « ${h.name} » (${h.validationStatus})`).toBeVisible();
  157 |     }
  158 | }
  159 | 
  160 | async function partnerHallSheetReady(page: Page): Promise<void> {
  161 |     await hallTitle('validee')(page);
  162 |     const calendar = page.locator('#calendrier');
  163 |     await expect(calendar.getByRole('heading', { level: 2, name: /^calendrier des réservations$/i })).toBeVisible();
  164 |     await expect(calendar.locator('[aria-busy="true"]'), 'réservations du mois chargées').toHaveCount(0, { timeout: 30_000 });
  165 | }
  166 | 
  167 | async function adminHallsReady(page: Page): Promise<void> {
  168 |     await titled(page, /^salles à valider$/i);
  169 |     const name = readDemoIds().halls.enAttente.name;
  170 |     await expect(page.getByRole('link', { name, exact: true }).filter({ visible: true }).first(), `salle « ${name} » en attente de validation`).toBeVisible();
  171 | }
  172 | 
  173 | const P = (p: Omit<ResponsivePage, 'groupe'>): Omit<ResponsivePage, 'groupe'> => p;
  174 | 
  175 | const PUBLIQUES: Array<Omit<ResponsivePage, 'groupe'>> = [
  176 |     P({ id: 'accueil', titre: 'Accueil', role: 'anonyme', path: () => '/' }),
  177 |     P({ id: 'explorer', titre: 'Explorer', role: 'anonyme', path: () => '/explore' }),
  178 |     P({ id: 'fiche', titre: 'Fiche d’un événement publié', role: 'anonyme', needsIds: true, path: (i) => `/events/${ids(i).events.publie.id}` }),
  179 |     P({ id: 'fiche-en-cours', titre: 'Fiche d’un événement en cours', role: 'anonyme', needsIds: true, path: (i) => `/events/${ids(i).events.ceSoir.id}` }),
  180 |     P({
  181 |         id: 'fiche-introuvable', titre: 'Événement introuvable', role: 'anonyme', path: () => '/events/00000000-0000-4000-8000-000000000404',
  182 |         expectStatus: 404, allowFailures: [/\/api\/events\/[0-9a-f-]{36}(\?.*)?$/, /\/events\/[0-9a-f-]{36}$/],
  183 |     }),
  184 |     P({ id: 'connexion', titre: 'Connexion', role: 'anonyme', path: () => '/login' }),
  185 |     P({ id: 'inscription', titre: 'Inscription', role: 'anonyme', path: () => '/register' }),
  186 |     P({ id: 'mot-de-passe-oublie', titre: 'Mot de passe oublié', role: 'anonyme', path: () => '/forgot-password' }),
  187 |     P({ id: 'inscription-partenaire', titre: 'Inscription de l’organisatrice', role: 'anonyme', path: () => '/partner/register' }),
  188 |     P({ id: 'aide', titre: 'Aide', role: 'anonyme', path: () => '/aide' }),
  189 |     P({ id: 'hors-ligne', titre: 'Page hors ligne', role: 'anonyme', path: () => '/hors-ligne' }),
  190 |     P({ id: 'mes-billets', titre: 'Mes billets', role: 'client', path: () => '/tickets?tab=a-venir' }),
  191 |     P({ id: 'billet-hors-ligne', titre: 'Billet hors ligne', role: 'client', needsIds: true, path: (i) => `/billet/hors-ligne?id=${encodeURIComponent(ids(i).tickets.clientVeille)}`, ready: async (page) => { await expect(page.locator('main').first()).toBeVisible(); } }),
  192 |     P({ id: 'paiement', titre: 'Suivi d’un paiement', role: 'client', needsIds: true, path: (i) => `/paiement/${ids(i).payments.pending}` }),
  193 |     P({ id: 'profil', titre: 'Profil', role: 'client', path: () => '/profile' }),
  194 |     P({ id: 'profil-paiements', titre: 'Mes paiements', role: 'client', path: () => '/profile/payments' }),
  195 |     P({ id: 'profil-notifications', titre: 'Réglages des notifications', role: 'client', path: () => '/profile/notifications' }),
  196 |     P({ id: 'profil-soirees', titre: 'Mes soirées', role: 'client', path: () => '/profile/soirees' }),
  197 |     // Lot 10b : notification de la réservation de salle du seed, lien vers une page fermée (HALL_RESERVATION_PREFETCH)
  198 |     P({ id: 'notifications', titre: 'Notifications', role: 'client', path: () => '/notifications', allowFailures: [HALL_RESERVATION_PREFETCH] }),
  199 |     P({ id: 'invitations', titre: 'Invitations du contrôleur', role: 'client', path: () => '/invitations' }),
  200 |     // Lot 10b : salles de fête du client (interrupteur ouvert le temps du test)
  201 |     P({ id: 'salles-catalogue', titre: 'Salles de fête — catalogue', role: 'client', salles: true, path: () => '/halls', ready: hallsCatalogReady }),
  202 |     P({ id: 'salles-fiche', titre: 'Fiche d’une salle validée', role: 'client', salles: true, needsIds: true, path: (i) => `/halls/${hallOf(i, 'validee').id}`, ready: hallTitle('validee') }),
  203 |     P({ id: 'salles-reservations', titre: 'Mes réservations de salle', role: 'client', salles: true, path: () => '/halls/reservations', ready: myHallReservationsReady }),
  204 |     P({ id: 'salles-reservation', titre: 'Ma réservation de salle (en attente de paiement)', role: 'client', salles: true, needsIds: true, path: (i) => `/halls/reservations/${ids(i).halls.reservation.id}`, ready: hallTitle('validee') }),
  205 | ];
  206 | 
  207 | const ORGANISATRICE: Array<Omit<ResponsivePage, 'groupe'>> = [
  208 |     P({ id: 'org-tableau-de-bord', titre: 'Tableau de bord', role: 'organisateur', path: () => '/partner/dashboard' }),
  209 |     P({ id: 'org-premiers-pas', titre: 'Tableau de bord sans événement', role: 'partenaire-premiers-pas', path: () => '/partner/dashboard' }),
  210 |     P({ id: 'org-evenements', titre: 'Mes événements', role: 'organisateur', path: () => '/partner/events' }),
  211 |     P({ id: 'org-creation', titre: 'Création d’un événement', role: 'organisateur', path: () => '/partner/events/new' }),
  212 |     P({ id: 'org-modification', titre: 'Modification d’un événement', role: 'organisateur', needsIds: true, path: (i) => `/partner/events/${ids(i).events.publie.id}/edit` }),
  213 |     P({ id: 'org-pilotage-apercu', titre: 'Pilotage — Aperçu', role: 'organisateur', needsIds: true, path: pilotage('ceSoir'), ready: (p) => tabSelected(p, /^aperçu/i) }),
  214 |     P({ id: 'org-pilotage-infos', titre: 'Pilotage — Infos', role: 'organisateur', needsIds: true, path: pilotage('ceSoir', 'infos'), ready: (p) => tabSelected(p, /^infos/i) }),
  215 |     P({ id: 'org-pilotage-ventes', titre: 'Pilotage — Ventes', role: 'organisateur', needsIds: true, path: pilotage('ceSoir', 'ventes'), ready: (p) => tabSelected(p, /^ventes/i) }),
  216 |     P({ id: 'org-pilotage-invitations', titre: 'Pilotage — Invitations', role: 'organisateur', needsIds: true, path: pilotage('ceSoir', 'invitations'), ready: (p) => tabSelected(p, /^invitations/i) }),
  217 |     P({ id: 'org-pilotage-entrees', titre: 'Pilotage — Entrées', role: 'organisateur', needsIds: true, path: pilotage('ceSoir', 'entrees'), ready: (p) => tabSelected(p, /^entrées/i) }),
  218 |     P({ id: 'org-pilotage-equipe', titre: 'Pilotage — Équipe', role: 'organisateur', needsIds: true, path: pilotage('ceSoir', 'equipe'), ready: (p) => tabSelected(p, /^équipe/i) }),
  219 |     P({ id: 'org-pilotage-caisse', titre: 'Pilotage — Caisse', role: 'organisateur', needsIds: true, path: pilotage('ceSoir', 'caisse'), ready: (p) => tabSelected(p, /^caisse/i) }),
  220 |     P({ id: 'org-pilotage-cloture', titre: 'Pilotage — Clôture', role: 'organisateur', needsIds: true, path: pilotage('termine', 'cloture'), ready: (p) => tabSelected(p, /^clôture/i) }),
  221 |     P({ id: 'org-equipe-evenement', titre: 'Équipe d’un événement', role: 'organisateur', needsIds: true, path: (i) => `/partner/events/${ids(i).events.ceSoir.id}/team` }),
  222 |     P({ id: 'org-caisse-evenement', titre: 'Caisse d’un événement', role: 'organisateur', needsIds: true, path: (i) => `/partner/events/${ids(i).events.ceSoir.id}/caisse` }),
  223 |     P({ id: 'org-equipe', titre: 'Mon équipe', role: 'organisateur', path: () => '/partner/team' }),
  224 |     P({ id: 'org-finance', titre: 'Finances', role: 'organisateur', path: () => '/partner/finance' }),
  225 |     P({ id: 'org-portefeuille', titre: 'Portefeuille', role: 'organisateur', path: () => '/wallet' }),
  226 |     P({ id: 'org-statistiques', titre: 'Statistiques de ventes', role: 'organisateur', path: () => '/partner/stats' }),
  227 |     P({ id: 'org-calendrier', titre: 'Calendrier', role: 'organisateur', path: () => '/partner/calendar' }),
  228 |     P({ id: 'org-profil', titre: 'Profil de l’organisatrice', role: 'organisateur', path: () => '/partner/profile' }),
  229 |     P({ id: 'org-abonnement', titre: 'Abonnement', role: 'organisateur', path: () => '/partner/subscription' }),
  230 |     P({ id: 'org-scan', titre: 'Scanner de l’organisatrice', role: 'organisateur', path: () => '/partner/scan' }),
  231 |     // Lot 10b : salles de fête de l'organisatrice (interrupteur ouvert le temps du test)
```