/**
 * Design 1c (point 1) — pages du contrôle responsive (e2e/responsive.spec.ts, phase « responsive », job « responsive » de
 * .github/workflows/verify.yml).
 *
 * Toutes les pages publiques (et l'espace client), de l'organisatrice, de l'administration et du contrôleur, chacune
 * vérifiée à 320, 360, 390, 768, 1024 et 1440 px de large ; le scanner aussi en paysage. Une page = une adresse et un
 * rôle ; `ready` attend le contenu utile (titre de niveau 1 par défaut), `actions` amène l'état à contrôler.
 *
 * Exclusions déclarées (vérifiées par tests/schema/design1c-responsive.test.ts : toute page de app/ est soit listée ici,
 * soit exclue avec sa raison) :
 *  - tables, menus, commandes et produits : écrans des services fermés, hors de ce contrôle (consigne du design 1c : ne pas y
 *    toucher) ;
 *  - redirections pures (/partner, /admin, /scan, /partner/halls/reservations) ;
 *  - pages à jeton à usage unique ou de démonstration interne (activation, réclamation d'un billet, vitrine du design).
 *
 * Lot 10b : les douze pages des salles de fête sont contrôlées (client : catalogue, fiche d'une salle validée, mes
 * réservations, une réservation ; organisatrice : mes salles, ajout, fiche et calendrier, modification, détail d'une
 * réservation, recettes ; super-administrateur : salles à valider, fiche d'une salle en attente). Données : salles et
 * réservation du seed de démonstration (DemoIds.halls, graine v5). Les pages du client et de l'organisatrice (`salles`)
 * tournent interrupteur features.halls_enabled ouvert, sous le verrou de e2e/support/halls-switch.ts ; celles de
 * l'administration n'en dépendent pas.
 */
import { expect, type BrowserContext, type Page } from '@playwright/test';
import type { CaptureRole } from './fixtures';
import { readDemoIds, type DemoHallKey, type DemoIds } from './demo-ids';

export type ResponsiveGroup = 'public' | 'organisatrice' | 'administration' | 'scanner';

export interface ResponsivePage {
    id: string;
    titre: string;
    groupe: ResponsiveGroup;
    role: CaptureRole;
    needsIds?: boolean;
    path: (ids: DemoIds | null) => string;
    /** Contenu utile affiché (défaut : un titre de niveau 1 visible). */
    ready?: (page: Page) => Promise<void>;
    /** État à contrôler (onglet, fenêtre ouverte…), rejoué après chaque chargement. */
    actions?: (page: Page) => Promise<void>;
    /** Caméra simulée (scanner démarré). */
    fakeCamera?: boolean;
    /** Contrôle aussi en paysage (scanner). */
    paysage?: boolean;
    /** Statut HTTP attendu du document (404 de la page introuvable). */
    expectStatus?: number;
    /** Requêtes en échec attendues (404 d'une page introuvable). */
    allowFailures?: RegExp[];
    /**
     * Lot 10b : page des salles de fête (app/halls, app/partner/halls), en 404 tant que l'interrupteur features.halls_enabled
     * est fermé : ouvert le temps du test, sous le verrou entre les workers (e2e/support/halls-switch.ts).
     */
    salles?: boolean;
}

/** Largeurs contrôlées, et hauteur de la fenêtre à chaque largeur (téléphones, tablette portrait, tablette paysage, ordinateur). */
export const RESPONSIVE_WIDTHS = [
    { width: 320, height: 568 },
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
] as const;

/** Largeurs capturées (en clair et en sombre). */
export const RESPONSIVE_CAPTURE_WIDTHS: readonly number[] = [360, 768, 1440];

/** Paysage du scanner : téléphone tenu en largeur (petit et moyen). */
export const RESPONSIVE_LANDSCAPE = [
    { width: 640, height: 360 },
    { width: 844, height: 390 },
] as const;

/** Au plus cette largeur : téléphone (tableaux interdits, cartes attendues). */
export const PHONE_MAX_WIDTH = 390;

function ids(i: DemoIds | null): DemoIds {
    if (!i) throw new Error('[e2e] page dépendant du seed de démonstration appelée sans identifiants');
    return i;
}

async function title(page: Page): Promise<void> {
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
}

function pilotage(key: keyof DemoIds['events'], tab?: string) {
    return (i: DemoIds | null) => `/partner/events/${ids(i).events[key].id}${tab ? `?tab=${tab}` : ''}`;
}

async function tabSelected(page: Page, name: RegExp): Promise<void> {
    await title(page);
    await expect(page.getByRole('tab', { name, selected: true })).toBeVisible({ timeout: 30_000 });
}

async function scannerStart(page: Page): Promise<void> {
    await expect(page.getByRole('heading', { level: 1, name: /^commencer le contr[ôo]le$/i })).toBeVisible({ timeout: 30_000 });
}

async function scannerStarted(page: Page): Promise<void> {
    // Rechargé à chaque largeur : le scanner reprend le contrôle déjà démarré (reprise du lot 7, A10) ; l'écran de départ
    // n'apparaît qu'au premier chargement (run 439 : attente de l'écran de départ à 360 px, jamais affiché).
    const start = page.getByRole('heading', { level: 1, name: /^commencer le contr[ôo]le$/i });
    const camera = page.getByRole('button', { name: /^caméra$/i });
    await expect(start.or(camera).first()).toBeVisible({ timeout: 30_000 });
    if (await start.isVisible()) await page.getByRole('button', { name: /^commencer le contr[ôo]le$/i }).click();
    // Reprise : la caméra attend le geste « Reprendre le contrôle » (A10)
    const resume = page.getByRole('button', { name: /^reprendre le contr[ôo]le$/i });
    const needsResume = await resume.waitFor({ state: 'visible', timeout: 3_000 }).then(() => true, () => false); // absent : caméra déjà relancée
    if (needsResume) await resume.click();
    await expect(page.getByRole('button', { name: /^caméra$/i })).toHaveAttribute('aria-pressed', 'true');
    await page.waitForFunction(() => Array.from(document.querySelectorAll('video')).some((v) => v.readyState >= 2), null, { timeout: 30_000 });
}

// ── Lot 10b : salles de fête (salles et réservation du seed de démonstration, DemoIds.halls) ──────────────

/**
 * Préchargement de « Voir le détail » de la notification « Réservation demandée » du client (graine v5) : 404 tant que
 * l'interrupteur des salles est fermé. Même motif que HALL_RESERVATION_PREFETCH de screens.ts (recopié : ce module reste
 * sans dépendance vers les écrans, il est lu par tests/schema/design1c-responsive.test.ts).
 */
const HALL_RESERVATION_PREFETCH = /\/halls\/reservations\/[0-9a-f-]{36}(\?_rsc=[^/]*)?$/;

function hallOf(i: DemoIds | null, key: DemoHallKey): DemoIds['halls'][DemoHallKey] {
    return ids(i).halls[key];
}

async function titled(page: Page, name: RegExp | string): Promise<void> {
    const heading = typeof name === 'string'
        ? page.getByRole('heading', { level: 1, name, exact: true })
        : page.getByRole('heading', { level: 1, name });
    await expect(heading).toBeVisible({ timeout: 30_000 });
}

/** Titre de niveau 1 : nom d'une salle du seed (lu dans demo-ids.json, comme l'adresse de la page). */
function hallTitle(key: DemoHallKey) {
    return async (page: Page): Promise<void> => { await titled(page, readDemoIds().halls[key].name); };
}

async function hallsCatalogReady(page: Page): Promise<void> {
    await titled(page, /^salles de fête$/i);
    const name = readDemoIds().halls.validee.name;
    await expect(page.getByRole('heading', { level: 3, name, exact: true }), `salle « ${name} » au catalogue`).toBeVisible();
}

async function myHallReservationsReady(page: Page): Promise<void> {
    await titled(page, /^mes réservations$/i);
    await expect(page.getByRole('tab', { name: /^à venir/i, selected: true })).toBeVisible();
    const name = readDemoIds().halls.validee.name;
    await expect(page.getByRole('heading', { level: 3, name, exact: true }), `réservation de « ${name} » en attente de paiement`).toBeVisible();
}

async function partnerHallsReady(page: Page): Promise<void> {
    await titled(page, /^mes salles$/i);
    const { validee, enAttente, refusee } = readDemoIds().halls;
    for (const h of [validee, enAttente, refusee]) {
        await expect(page.getByRole('heading', { level: 2, name: h.name, exact: true }), `salle « ${h.name} » (${h.validationStatus})`).toBeVisible();
    }
}

async function partnerHallSheetReady(page: Page): Promise<void> {
    await hallTitle('validee')(page);
    const calendar = page.locator('#calendrier');
    await expect(calendar.getByRole('heading', { level: 2, name: /^calendrier des réservations$/i })).toBeVisible();
    await expect(calendar.locator('[aria-busy="true"]'), 'réservations du mois chargées').toHaveCount(0, { timeout: 30_000 });
}

async function adminHallsReady(page: Page): Promise<void> {
    await titled(page, /^salles à valider$/i);
    const name = readDemoIds().halls.enAttente.name;
    await expect(page.getByRole('link', { name, exact: true }).filter({ visible: true }).first(), `salle « ${name} » en attente de validation`).toBeVisible();
}

const P = (p: Omit<ResponsivePage, 'groupe'>): Omit<ResponsivePage, 'groupe'> => p;

const PUBLIQUES: Array<Omit<ResponsivePage, 'groupe'>> = [
    P({ id: 'accueil', titre: 'Accueil', role: 'anonyme', path: () => '/' }),
    P({ id: 'explorer', titre: 'Explorer', role: 'anonyme', path: () => '/explore' }),
    P({ id: 'fiche', titre: 'Fiche d’un événement publié', role: 'anonyme', needsIds: true, path: (i) => `/events/${ids(i).events.publie.id}` }),
    P({ id: 'fiche-en-cours', titre: 'Fiche d’un événement en cours', role: 'anonyme', needsIds: true, path: (i) => `/events/${ids(i).events.ceSoir.id}` }),
    P({
        id: 'fiche-introuvable', titre: 'Événement introuvable', role: 'anonyme', path: () => '/events/00000000-0000-4000-8000-000000000404',
        expectStatus: 404, allowFailures: [/\/api\/events\/[0-9a-f-]{36}(\?.*)?$/, /\/events\/[0-9a-f-]{36}$/],
    }),
    P({ id: 'connexion', titre: 'Connexion', role: 'anonyme', path: () => '/login' }),
    P({ id: 'inscription', titre: 'Inscription', role: 'anonyme', path: () => '/register' }),
    P({ id: 'mot-de-passe-oublie', titre: 'Mot de passe oublié', role: 'anonyme', path: () => '/forgot-password' }),
    P({ id: 'inscription-partenaire', titre: 'Inscription de l’organisatrice', role: 'anonyme', path: () => '/partner/register' }),
    P({ id: 'aide', titre: 'Aide', role: 'anonyme', path: () => '/aide' }),
    P({ id: 'hors-ligne', titre: 'Page hors ligne', role: 'anonyme', path: () => '/hors-ligne' }),
    P({ id: 'mes-billets', titre: 'Mes billets', role: 'client', path: () => '/tickets?tab=a-venir' }),
    P({ id: 'billet-hors-ligne', titre: 'Billet hors ligne', role: 'client', needsIds: true, path: (i) => `/billet/hors-ligne?id=${encodeURIComponent(ids(i).tickets.clientVeille)}`, ready: async (page) => { await expect(page.locator('main').first()).toBeVisible(); } }),
    P({ id: 'paiement', titre: 'Suivi d’un paiement', role: 'client', needsIds: true, path: (i) => `/paiement/${ids(i).payments.pending}` }),
    P({ id: 'profil', titre: 'Profil', role: 'client', path: () => '/profile' }),
    P({ id: 'profil-paiements', titre: 'Mes paiements', role: 'client', path: () => '/profile/payments' }),
    P({ id: 'profil-notifications', titre: 'Réglages des notifications', role: 'client', path: () => '/profile/notifications' }),
    P({ id: 'profil-soirees', titre: 'Mes soirées', role: 'client', path: () => '/profile/soirees' }),
    // Lot 10b : notification de la réservation de salle du seed, lien vers une page fermée (HALL_RESERVATION_PREFETCH)
    P({ id: 'notifications', titre: 'Notifications', role: 'client', path: () => '/notifications', allowFailures: [HALL_RESERVATION_PREFETCH] }),
    P({ id: 'invitations', titre: 'Invitations du contrôleur', role: 'client', path: () => '/invitations' }),
    // Lot 10b : salles de fête du client (interrupteur ouvert le temps du test)
    P({ id: 'salles-catalogue', titre: 'Salles de fête — catalogue', role: 'client', salles: true, path: () => '/halls', ready: hallsCatalogReady }),
    P({ id: 'salles-fiche', titre: 'Fiche d’une salle validée', role: 'client', salles: true, needsIds: true, path: (i) => `/halls/${hallOf(i, 'validee').id}`, ready: hallTitle('validee') }),
    P({ id: 'salles-reservations', titre: 'Mes réservations de salle', role: 'client', salles: true, path: () => '/halls/reservations', ready: myHallReservationsReady }),
    P({ id: 'salles-reservation', titre: 'Ma réservation de salle (en attente de paiement)', role: 'client', salles: true, needsIds: true, path: (i) => `/halls/reservations/${ids(i).halls.reservation.id}`, ready: hallTitle('validee') }),
];

const ORGANISATRICE: Array<Omit<ResponsivePage, 'groupe'>> = [
    P({ id: 'org-tableau-de-bord', titre: 'Tableau de bord', role: 'organisateur', path: () => '/partner/dashboard' }),
    P({ id: 'org-premiers-pas', titre: 'Tableau de bord sans événement', role: 'partenaire-premiers-pas', path: () => '/partner/dashboard' }),
    P({ id: 'org-evenements', titre: 'Mes événements', role: 'organisateur', path: () => '/partner/events' }),
    P({ id: 'org-creation', titre: 'Création d’un événement', role: 'organisateur', path: () => '/partner/events/new' }),
    P({ id: 'org-modification', titre: 'Modification d’un événement', role: 'organisateur', needsIds: true, path: (i) => `/partner/events/${ids(i).events.publie.id}/edit` }),
    P({ id: 'org-pilotage-apercu', titre: 'Pilotage — Aperçu', role: 'organisateur', needsIds: true, path: pilotage('ceSoir'), ready: (p) => tabSelected(p, /^aperçu/i) }),
    P({ id: 'org-pilotage-infos', titre: 'Pilotage — Infos', role: 'organisateur', needsIds: true, path: pilotage('ceSoir', 'infos'), ready: (p) => tabSelected(p, /^infos/i) }),
    P({ id: 'org-pilotage-ventes', titre: 'Pilotage — Ventes', role: 'organisateur', needsIds: true, path: pilotage('ceSoir', 'ventes'), ready: (p) => tabSelected(p, /^ventes/i) }),
    P({ id: 'org-pilotage-invitations', titre: 'Pilotage — Invitations', role: 'organisateur', needsIds: true, path: pilotage('ceSoir', 'invitations'), ready: (p) => tabSelected(p, /^invitations/i) }),
    P({ id: 'org-pilotage-entrees', titre: 'Pilotage — Entrées', role: 'organisateur', needsIds: true, path: pilotage('ceSoir', 'entrees'), ready: (p) => tabSelected(p, /^entrées/i) }),
    P({ id: 'org-pilotage-equipe', titre: 'Pilotage — Équipe', role: 'organisateur', needsIds: true, path: pilotage('ceSoir', 'equipe'), ready: (p) => tabSelected(p, /^équipe/i) }),
    P({ id: 'org-pilotage-caisse', titre: 'Pilotage — Caisse', role: 'organisateur', needsIds: true, path: pilotage('ceSoir', 'caisse'), ready: (p) => tabSelected(p, /^caisse/i) }),
    P({ id: 'org-pilotage-cloture', titre: 'Pilotage — Clôture', role: 'organisateur', needsIds: true, path: pilotage('termine', 'cloture'), ready: (p) => tabSelected(p, /^clôture/i) }),
    P({ id: 'org-equipe-evenement', titre: 'Équipe d’un événement', role: 'organisateur', needsIds: true, path: (i) => `/partner/events/${ids(i).events.ceSoir.id}/team` }),
    P({ id: 'org-caisse-evenement', titre: 'Caisse d’un événement', role: 'organisateur', needsIds: true, path: (i) => `/partner/events/${ids(i).events.ceSoir.id}/caisse` }),
    P({ id: 'org-equipe', titre: 'Mon équipe', role: 'organisateur', path: () => '/partner/team' }),
    P({ id: 'org-finance', titre: 'Finances', role: 'organisateur', path: () => '/partner/finance' }),
    P({ id: 'org-portefeuille', titre: 'Portefeuille', role: 'organisateur', path: () => '/wallet' }),
    P({ id: 'org-statistiques', titre: 'Statistiques de ventes', role: 'organisateur', path: () => '/partner/stats' }),
    P({ id: 'org-calendrier', titre: 'Calendrier', role: 'organisateur', path: () => '/partner/calendar' }),
    P({ id: 'org-profil', titre: 'Profil de l’organisatrice', role: 'organisateur', path: () => '/partner/profile' }),
    P({ id: 'org-abonnement', titre: 'Abonnement', role: 'organisateur', path: () => '/partner/subscription' }),
    P({ id: 'org-scan', titre: 'Scanner de l’organisatrice', role: 'organisateur', path: () => '/partner/scan' }),
    // Lot 10b : salles de fête de l'organisatrice (interrupteur ouvert le temps du test)
    P({ id: 'org-salles', titre: 'Mes salles (validée, en attente, refusée)', role: 'organisateur', salles: true, path: () => '/partner/halls', ready: partnerHallsReady }),
    P({ id: 'org-salle-ajout', titre: 'Ajout d’une salle', role: 'organisateur', salles: true, path: () => '/partner/halls/new', ready: (p) => titled(p, /^ajouter une salle$/i) }),
    P({ id: 'org-salle-fiche', titre: 'Fiche d’une salle et calendrier des réservations', role: 'organisateur', salles: true, needsIds: true, path: (i) => `/partner/halls/${hallOf(i, 'validee').id}`, ready: partnerHallSheetReady }),
    P({ id: 'org-salle-modification', titre: 'Modification d’une salle', role: 'organisateur', salles: true, needsIds: true, path: (i) => `/partner/halls/${hallOf(i, 'validee').id}/edit`, ready: (p) => titled(p, /^modifier la salle$/i) }),
    P({ id: 'org-salle-reservation', titre: 'Détail d’une réservation de salle', role: 'organisateur', salles: true, needsIds: true, path: (i) => `/partner/halls/reservations/${ids(i).halls.reservation.id}`, ready: hallTitle('validee') }),
    P({ id: 'org-salles-recettes', titre: 'Recettes des salles', role: 'organisateur', salles: true, path: () => '/partner/halls/recettes', ready: (p) => titled(p, /^recettes des salles$/i) }),
];

const ADMINISTRATION: Array<Omit<ResponsivePage, 'groupe'>> = [
    P({ id: 'adm-tableau-de-bord', titre: 'Tableau de bord', role: 'fumee-superadmin', path: () => '/admin/dashboard' }),
    P({ id: 'adm-evenements', titre: 'Événements', role: 'fumee-superadmin', path: () => '/admin/events' }),
    P({ id: 'adm-evenement', titre: 'Fiche d’un événement à valider', role: 'fumee-superadmin', needsIds: true, path: (i) => `/admin/events/${ids(i).events.enAttente.id}` }),
    P({ id: 'adm-comptes', titre: 'Comptes et administrateurs', role: 'fumee-superadmin', path: () => '/admin/users' }),
    P({ id: 'adm-journal', titre: 'Journal', role: 'fumee-superadmin', path: () => '/admin/audit' }),
    P({ id: 'adm-parrainage', titre: 'Parrainage', role: 'fumee-superadmin', path: () => '/admin/referral' }),
    P({ id: 'adm-finance', titre: 'Finances', role: 'fumee-superadmin', path: () => '/admin/finance' }),
    P({ id: 'adm-reglages', titre: 'Réglages de la plateforme', role: 'fumee-superadmin', path: () => '/admin/finance-settings' }),
    P({ id: 'adm-notifications', titre: 'Supervision des notifications', role: 'fumee-superadmin', path: () => '/admin/notifications' }),
    P({ id: 'adm-notification', titre: 'Détail d’une notification', role: 'fumee-superadmin', needsIds: true, path: (i) => `/admin/notifications/${ids(i).notifications.failedId}` }),
    P({ id: 'adm-communications', titre: 'Communications', role: 'fumee-superadmin', path: () => '/admin/communications' }),
    P({ id: 'adm-services', titre: 'Services', role: 'fumee-superadmin', path: () => '/admin/services' }),
    P({ id: 'adm-securite', titre: 'Sécurité', role: 'fumee-superadmin', path: () => '/admin/securite' }),
    P({ id: 'adm-a-la-une', titre: 'À la une', role: 'fumee-superadmin', path: () => '/admin/a-la-une' }),
    P({ id: 'adm-mes-droits', titre: 'Mes droits', role: 'admin', path: () => '/admin/mes-droits' }),
    // Lot 10b : validation des salles (app/admin/halls ne dépend pas de l'interrupteur)
    P({ id: 'adm-salles', titre: 'Salles à valider', role: 'fumee-superadmin', path: () => '/admin/halls', ready: adminHallsReady }),
    P({ id: 'adm-salle', titre: 'Fiche d’une salle en attente de validation', role: 'fumee-superadmin', needsIds: true, path: (i) => `/admin/halls/${hallOf(i, 'enAttente').id}`, ready: hallTitle('enAttente') }),
];

const SCANNER: Array<Omit<ResponsivePage, 'groupe'>> = [
    P({ id: 'scan-depart', titre: 'Scanner — départ du contrôle', role: 'controleur', needsIds: true, path: () => '/controller/scanner', ready: scannerStart, paysage: true }),
    P({ id: 'scan-camera', titre: 'Scanner — caméra en marche', role: 'controleur', needsIds: true, path: () => '/controller/scanner', ready: scannerStarted, fakeCamera: true, paysage: true }),
    P({ id: 'scan-profil', titre: 'Profil du contrôleur', role: 'controleur', path: () => '/controller/profile' }),
    P({ id: 'scan-activation', titre: 'Activation du contrôleur', role: 'anonyme', path: () => '/controller/setup?phone=%2B221700000199' }),
];

export const RESPONSIVE_PAGES: readonly ResponsivePage[] = [
    ...PUBLIQUES.map((p) => ({ ...p, groupe: 'public' as const })),
    ...ORGANISATRICE.map((p) => ({ ...p, groupe: 'organisatrice' as const })),
    ...ADMINISTRATION.map((p) => ({ ...p, groupe: 'administration' as const })),
    ...SCANNER.map((p) => ({ ...p, groupe: 'scanner' as const })),
];

/**
 * Routes de app/ non contrôlées, avec leur raison (tests/schema/design1c-responsive.test.ts : toute route est listée ou
 * exclue ici).
 */
export const RESPONSIVE_EXCLUSIONS: Readonly<Record<string, string>> = {
    '/partner': 'redirection vers le tableau de bord',
    '/admin': 'redirection vers le tableau de bord',
    '/scan': 'redirection vers le scanner de l’organisatrice',
    '/activation': 'lien d’activation à usage unique (jeton reçu par SMS)',
    '/tickets/claim/[token]': 'lien de réclamation à usage unique (jeton)',
    '/verify-email': 'lien de vérification à usage unique (jeton)',
    '/reset-password': 'lien de réinitialisation à usage unique (jeton)',
    '/vitrine-design': 'vitrine interne des composants (design 1a), hors parcours',
    '/partner/halls/reservations': 'salles : redirection vers « Mes salles » (les réservations se consultent dans le calendrier de chaque salle)',
    '/partner/tables': 'tables : lot 10b en cours sur une autre branche',
    '/partner/products': 'produits : service fermé, écrans du lot 10b',
    '/partner/products/new': 'produits : service fermé, écrans du lot 10b',
    '/partner/orders': 'commandes : service fermé, écrans du lot 10b',
    '/orders': 'commandes : service fermé, écrans du lot 10b',
    '/restaurants/[id]/menu': 'menus : service fermé, écrans du lot 10b',
    '/restaurants/[id]/tables': 'tables : service fermé, écrans du lot 10b',
};

/** Contexte : caméra simulée posée avant le chargement (scanner démarré). */
export type ResponsiveContextHook = (context: BrowserContext) => Promise<void>;
