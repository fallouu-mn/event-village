# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · controleur >> scan-camera — Scanner — caméra en marche
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: /^commencer le contr[ôo]le$/i, level: 1 })
Expected: visible
Timeout: 30000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: /^commencer le contr[ôo]le$/i, level: 1 }) with timeout 30000ms
  - waiting for getByRole('heading', { name: /^commencer le contr[ôo]le$/i, level: 1 })

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
    - status:
      - paragraph: Contrôle retrouvé
      - paragraph: "Même événement, même mode : rallumez la caméra."
    - button "Reprendre le contrôle"
    - group "Mode de contrôle":
      - button "Caméra" [pressed]
      - button "Saisie manuelle"
    - button "Liste des invités"
    - 'button "Derniers scans Vous : 32 entrées, 5 refus"'
    - group: Réglages de cet appareil
- alert
```

# Test source

```ts
  1   | /**
  2   |  * Design 1c (point 1) — pages du contrôle responsive (e2e/responsive.spec.ts, phase « responsive », job « responsive » de
  3   |  * .github/workflows/verify.yml).
  4   |  *
  5   |  * Toutes les pages publiques (et l'espace client), de l'organisatrice, de l'administration et du contrôleur, chacune
  6   |  * vérifiée à 320, 360, 390, 768, 1024 et 1440 px de large ; le scanner aussi en paysage. Une page = une adresse et un
  7   |  * rôle ; `ready` attend le contenu utile (titre de niveau 1 par défaut), `actions` amène l'état à contrôler.
  8   |  *
  9   |  * Exclusions déclarées (vérifiées par tests/schema/design1c-responsive.test.ts : toute page de app/ est soit listée ici,
  10  |  * soit exclue avec sa raison) :
  11  |  *  - salles, tables, menus, commandes et produits : écrans du lot 10b, en cours sur une autre branche (consigne du
  12  |  *    design 1c : ne pas y toucher) ;
  13  |  *  - redirections pures (/partner, /admin, /scan) ;
  14  |  *  - pages à jeton à usage unique ou de démonstration interne (activation, réclamation d'un billet, vitrine du design).
  15  |  */
  16  | import { expect, type BrowserContext, type Page } from '@playwright/test';
  17  | import type { CaptureRole } from './fixtures';
  18  | import type { DemoIds } from './demo-ids';
  19  | 
  20  | export type ResponsiveGroup = 'public' | 'organisatrice' | 'administration' | 'scanner';
  21  | 
  22  | export interface ResponsivePage {
  23  |     id: string;
  24  |     titre: string;
  25  |     groupe: ResponsiveGroup;
  26  |     role: CaptureRole;
  27  |     needsIds?: boolean;
  28  |     path: (ids: DemoIds | null) => string;
  29  |     /** Contenu utile affiché (défaut : un titre de niveau 1 visible). */
  30  |     ready?: (page: Page) => Promise<void>;
  31  |     /** État à contrôler (onglet, fenêtre ouverte…), rejoué après chaque chargement. */
  32  |     actions?: (page: Page) => Promise<void>;
  33  |     /** Caméra simulée (scanner démarré). */
  34  |     fakeCamera?: boolean;
  35  |     /** Contrôle aussi en paysage (scanner). */
  36  |     paysage?: boolean;
  37  |     /** Statut HTTP attendu du document (404 de la page introuvable). */
  38  |     expectStatus?: number;
  39  |     /** Requêtes en échec attendues (404 d'une page introuvable). */
  40  |     allowFailures?: RegExp[];
  41  | }
  42  | 
  43  | /** Largeurs contrôlées, et hauteur de la fenêtre à chaque largeur (téléphones, tablette portrait, tablette paysage, ordinateur). */
  44  | export const RESPONSIVE_WIDTHS = [
  45  |     { width: 320, height: 568 },
  46  |     { width: 360, height: 800 },
  47  |     { width: 390, height: 844 },
  48  |     { width: 768, height: 1024 },
  49  |     { width: 1024, height: 768 },
  50  |     { width: 1440, height: 900 },
  51  | ] as const;
  52  | 
  53  | /** Largeurs capturées (en clair et en sombre). */
  54  | export const RESPONSIVE_CAPTURE_WIDTHS: readonly number[] = [360, 768, 1440];
  55  | 
  56  | /** Paysage du scanner : téléphone tenu en largeur (petit et moyen). */
  57  | export const RESPONSIVE_LANDSCAPE = [
  58  |     { width: 640, height: 360 },
  59  |     { width: 844, height: 390 },
  60  | ] as const;
  61  | 
  62  | /** Au plus cette largeur : téléphone (tableaux interdits, cartes attendues). */
  63  | export const PHONE_MAX_WIDTH = 390;
  64  | 
  65  | function ids(i: DemoIds | null): DemoIds {
  66  |     if (!i) throw new Error('[e2e] page dépendant du seed de démonstration appelée sans identifiants');
  67  |     return i;
  68  | }
  69  | 
  70  | async function title(page: Page): Promise<void> {
  71  |     await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
  72  | }
  73  | 
  74  | function pilotage(key: keyof DemoIds['events'], tab?: string) {
  75  |     return (i: DemoIds | null) => `/partner/events/${ids(i).events[key].id}${tab ? `?tab=${tab}` : ''}`;
  76  | }
  77  | 
  78  | async function tabSelected(page: Page, name: RegExp): Promise<void> {
  79  |     await title(page);
  80  |     await expect(page.getByRole('tab', { name, selected: true })).toBeVisible({ timeout: 30_000 });
  81  | }
  82  | 
  83  | async function scannerStart(page: Page): Promise<void> {
> 84  |     await expect(page.getByRole('heading', { level: 1, name: /^commencer le contr[ôo]le$/i })).toBeVisible({ timeout: 30_000 });
      |                                                                                                ^ Error: expect(locator).toBeVisible() failed
  85  | }
  86  | 
  87  | async function scannerStarted(page: Page): Promise<void> {
  88  |     await scannerStart(page);
  89  |     await page.getByRole('button', { name: /^commencer le contr[ôo]le$/i }).click();
  90  |     await expect(page.getByRole('button', { name: /^caméra$/i })).toHaveAttribute('aria-pressed', 'true');
  91  |     await page.waitForFunction(() => Array.from(document.querySelectorAll('video')).some((v) => v.readyState >= 2), null, { timeout: 30_000 });
  92  | }
  93  | 
  94  | const P = (p: Omit<ResponsivePage, 'groupe'>): Omit<ResponsivePage, 'groupe'> => p;
  95  | 
  96  | const PUBLIQUES: Array<Omit<ResponsivePage, 'groupe'>> = [
  97  |     P({ id: 'accueil', titre: 'Accueil', role: 'anonyme', path: () => '/' }),
  98  |     P({ id: 'explorer', titre: 'Explorer', role: 'anonyme', path: () => '/explore' }),
  99  |     P({ id: 'fiche', titre: 'Fiche d’un événement publié', role: 'anonyme', needsIds: true, path: (i) => `/events/${ids(i).events.publie.id}` }),
  100 |     P({ id: 'fiche-en-cours', titre: 'Fiche d’un événement en cours', role: 'anonyme', needsIds: true, path: (i) => `/events/${ids(i).events.ceSoir.id}` }),
  101 |     P({
  102 |         id: 'fiche-introuvable', titre: 'Événement introuvable', role: 'anonyme', path: () => '/events/00000000-0000-4000-8000-000000000404',
  103 |         expectStatus: 404, allowFailures: [/\/api\/events\/[0-9a-f-]{36}(\?.*)?$/, /\/events\/[0-9a-f-]{36}$/],
  104 |     }),
  105 |     P({ id: 'connexion', titre: 'Connexion', role: 'anonyme', path: () => '/login' }),
  106 |     P({ id: 'inscription', titre: 'Inscription', role: 'anonyme', path: () => '/register' }),
  107 |     P({ id: 'mot-de-passe-oublie', titre: 'Mot de passe oublié', role: 'anonyme', path: () => '/forgot-password' }),
  108 |     P({ id: 'inscription-partenaire', titre: 'Inscription de l’organisatrice', role: 'anonyme', path: () => '/partner/register' }),
  109 |     P({ id: 'aide', titre: 'Aide', role: 'anonyme', path: () => '/aide' }),
  110 |     P({ id: 'hors-ligne', titre: 'Page hors ligne', role: 'anonyme', path: () => '/hors-ligne' }),
  111 |     P({ id: 'mes-billets', titre: 'Mes billets', role: 'client', path: () => '/tickets?tab=a-venir' }),
  112 |     P({ id: 'billet-hors-ligne', titre: 'Billet hors ligne', role: 'client', needsIds: true, path: (i) => `/billet/hors-ligne?id=${encodeURIComponent(ids(i).tickets.clientVeille)}`, ready: async (page) => { await expect(page.locator('main').first()).toBeVisible(); } }),
  113 |     P({ id: 'paiement', titre: 'Suivi d’un paiement', role: 'client', needsIds: true, path: (i) => `/paiement/${ids(i).payments.pending}` }),
  114 |     P({ id: 'profil', titre: 'Profil', role: 'client', path: () => '/profile' }),
  115 |     P({ id: 'profil-paiements', titre: 'Mes paiements', role: 'client', path: () => '/profile/payments' }),
  116 |     P({ id: 'profil-notifications', titre: 'Réglages des notifications', role: 'client', path: () => '/profile/notifications' }),
  117 |     P({ id: 'profil-soirees', titre: 'Mes soirées', role: 'client', path: () => '/profile/soirees' }),
  118 |     P({ id: 'notifications', titre: 'Notifications', role: 'client', path: () => '/notifications' }),
  119 |     P({ id: 'invitations', titre: 'Invitations du contrôleur', role: 'client', path: () => '/invitations' }),
  120 | ];
  121 | 
  122 | const ORGANISATRICE: Array<Omit<ResponsivePage, 'groupe'>> = [
  123 |     P({ id: 'org-tableau-de-bord', titre: 'Tableau de bord', role: 'organisateur', path: () => '/partner/dashboard' }),
  124 |     P({ id: 'org-premiers-pas', titre: 'Tableau de bord sans événement', role: 'partenaire-premiers-pas', path: () => '/partner/dashboard' }),
  125 |     P({ id: 'org-evenements', titre: 'Mes événements', role: 'organisateur', path: () => '/partner/events' }),
  126 |     P({ id: 'org-creation', titre: 'Création d’un événement', role: 'organisateur', path: () => '/partner/events/new' }),
  127 |     P({ id: 'org-modification', titre: 'Modification d’un événement', role: 'organisateur', needsIds: true, path: (i) => `/partner/events/${ids(i).events.publie.id}/edit` }),
  128 |     P({ id: 'org-pilotage-apercu', titre: 'Pilotage — Aperçu', role: 'organisateur', needsIds: true, path: pilotage('ceSoir'), ready: (p) => tabSelected(p, /^aperçu/i) }),
  129 |     P({ id: 'org-pilotage-infos', titre: 'Pilotage — Infos', role: 'organisateur', needsIds: true, path: pilotage('ceSoir', 'infos'), ready: (p) => tabSelected(p, /^infos/i) }),
  130 |     P({ id: 'org-pilotage-ventes', titre: 'Pilotage — Ventes', role: 'organisateur', needsIds: true, path: pilotage('ceSoir', 'ventes'), ready: (p) => tabSelected(p, /^ventes/i) }),
  131 |     P({ id: 'org-pilotage-invitations', titre: 'Pilotage — Invitations', role: 'organisateur', needsIds: true, path: pilotage('ceSoir', 'invitations'), ready: (p) => tabSelected(p, /^invitations/i) }),
  132 |     P({ id: 'org-pilotage-entrees', titre: 'Pilotage — Entrées', role: 'organisateur', needsIds: true, path: pilotage('ceSoir', 'entrees'), ready: (p) => tabSelected(p, /^entrées/i) }),
  133 |     P({ id: 'org-pilotage-equipe', titre: 'Pilotage — Équipe', role: 'organisateur', needsIds: true, path: pilotage('ceSoir', 'equipe'), ready: (p) => tabSelected(p, /^équipe/i) }),
  134 |     P({ id: 'org-pilotage-caisse', titre: 'Pilotage — Caisse', role: 'organisateur', needsIds: true, path: pilotage('ceSoir', 'caisse'), ready: (p) => tabSelected(p, /^caisse/i) }),
  135 |     P({ id: 'org-pilotage-cloture', titre: 'Pilotage — Clôture', role: 'organisateur', needsIds: true, path: pilotage('termine', 'cloture'), ready: (p) => tabSelected(p, /^clôture/i) }),
  136 |     P({ id: 'org-equipe-evenement', titre: 'Équipe d’un événement', role: 'organisateur', needsIds: true, path: (i) => `/partner/events/${ids(i).events.ceSoir.id}/team` }),
  137 |     P({ id: 'org-caisse-evenement', titre: 'Caisse d’un événement', role: 'organisateur', needsIds: true, path: (i) => `/partner/events/${ids(i).events.ceSoir.id}/caisse` }),
  138 |     P({ id: 'org-equipe', titre: 'Mon équipe', role: 'organisateur', path: () => '/partner/team' }),
  139 |     P({ id: 'org-finance', titre: 'Finances', role: 'organisateur', path: () => '/partner/finance' }),
  140 |     P({ id: 'org-portefeuille', titre: 'Portefeuille', role: 'organisateur', path: () => '/wallet' }),
  141 |     P({ id: 'org-statistiques', titre: 'Statistiques de ventes', role: 'organisateur', path: () => '/partner/stats' }),
  142 |     P({ id: 'org-calendrier', titre: 'Calendrier', role: 'organisateur', path: () => '/partner/calendar' }),
  143 |     P({ id: 'org-profil', titre: 'Profil de l’organisatrice', role: 'organisateur', path: () => '/partner/profile' }),
  144 |     P({ id: 'org-abonnement', titre: 'Abonnement', role: 'organisateur', path: () => '/partner/subscription' }),
  145 |     P({ id: 'org-scan', titre: 'Scanner de l’organisatrice', role: 'organisateur', path: () => '/partner/scan' }),
  146 | ];
  147 | 
  148 | const ADMINISTRATION: Array<Omit<ResponsivePage, 'groupe'>> = [
  149 |     P({ id: 'adm-tableau-de-bord', titre: 'Tableau de bord', role: 'fumee-superadmin', path: () => '/admin/dashboard' }),
  150 |     P({ id: 'adm-evenements', titre: 'Événements', role: 'fumee-superadmin', path: () => '/admin/events' }),
  151 |     P({ id: 'adm-evenement', titre: 'Fiche d’un événement à valider', role: 'fumee-superadmin', needsIds: true, path: (i) => `/admin/events/${ids(i).events.enAttente.id}` }),
  152 |     P({ id: 'adm-comptes', titre: 'Comptes et administrateurs', role: 'fumee-superadmin', path: () => '/admin/users' }),
  153 |     P({ id: 'adm-journal', titre: 'Journal', role: 'fumee-superadmin', path: () => '/admin/audit' }),
  154 |     P({ id: 'adm-parrainage', titre: 'Parrainage', role: 'fumee-superadmin', path: () => '/admin/referral' }),
  155 |     P({ id: 'adm-finance', titre: 'Finances', role: 'fumee-superadmin', path: () => '/admin/finance' }),
  156 |     P({ id: 'adm-reglages', titre: 'Réglages de la plateforme', role: 'fumee-superadmin', path: () => '/admin/finance-settings' }),
  157 |     P({ id: 'adm-notifications', titre: 'Supervision des notifications', role: 'fumee-superadmin', path: () => '/admin/notifications' }),
  158 |     P({ id: 'adm-notification', titre: 'Détail d’une notification', role: 'fumee-superadmin', needsIds: true, path: (i) => `/admin/notifications/${ids(i).notifications.failedId}` }),
  159 |     P({ id: 'adm-communications', titre: 'Communications', role: 'fumee-superadmin', path: () => '/admin/communications' }),
  160 |     P({ id: 'adm-services', titre: 'Services', role: 'fumee-superadmin', path: () => '/admin/services' }),
  161 |     P({ id: 'adm-securite', titre: 'Sécurité', role: 'fumee-superadmin', path: () => '/admin/securite' }),
  162 |     P({ id: 'adm-a-la-une', titre: 'À la une', role: 'fumee-superadmin', path: () => '/admin/a-la-une' }),
  163 |     P({ id: 'adm-mes-droits', titre: 'Mes droits', role: 'admin', path: () => '/admin/mes-droits' }),
  164 | ];
  165 | 
  166 | const SCANNER: Array<Omit<ResponsivePage, 'groupe'>> = [
  167 |     P({ id: 'scan-depart', titre: 'Scanner — départ du contrôle', role: 'controleur', needsIds: true, path: () => '/controller/scanner', ready: scannerStart, paysage: true }),
  168 |     P({ id: 'scan-camera', titre: 'Scanner — caméra en marche', role: 'controleur', needsIds: true, path: () => '/controller/scanner', ready: scannerStarted, fakeCamera: true, paysage: true }),
  169 |     P({ id: 'scan-profil', titre: 'Profil du contrôleur', role: 'controleur', path: () => '/controller/profile' }),
  170 |     P({ id: 'scan-activation', titre: 'Activation du contrôleur', role: 'anonyme', path: () => '/controller/setup?phone=%2B221700000199' }),
  171 | ];
  172 | 
  173 | export const RESPONSIVE_PAGES: readonly ResponsivePage[] = [
  174 |     ...PUBLIQUES.map((p) => ({ ...p, groupe: 'public' as const })),
  175 |     ...ORGANISATRICE.map((p) => ({ ...p, groupe: 'organisatrice' as const })),
  176 |     ...ADMINISTRATION.map((p) => ({ ...p, groupe: 'administration' as const })),
  177 |     ...SCANNER.map((p) => ({ ...p, groupe: 'scanner' as const })),
  178 | ];
  179 | 
  180 | /**
  181 |  * Routes de app/ non contrôlées, avec leur raison (tests/schema/design1c-responsive.test.ts : toute route est listée ou
  182 |  * exclue ici).
  183 |  */
  184 | export const RESPONSIVE_EXCLUSIONS: Readonly<Record<string, string>> = {
```