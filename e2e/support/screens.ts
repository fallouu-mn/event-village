/**
 * Lot 5.1 — écrans capturés (contrat P et liste de la découverte 5.1, point 20).
 * Chaque écran est capturé en mobile (390×844, DPR 2) et en ordinateur (1440×900), en clair et en
 * sombre. Les routes et les libellés sont ceux du contrat du lot 5 (sections G à J et O) : un écran
 * qui n'existe pas encore (pilotage, /admin/events…) échoue tant que sa tâche n'est pas livrée.
 * Les noms d'onglets suivent le composant Tabs du contrat (rôle tab, nom accessible = libellé).
 * Lot 6 (contrat P1, tâche 6.12) : 13 écrans de plus (connexion, inscription, mot de passe oublié,
 * préférences de notification dans les trois états du push, cloche ouverte, /notifications vide et en
 * erreur, billets reçus, supervision admin des notifications : liste, détail, erreur). Deux mécanismes
 * nouveaux : `stubResponse` (réponse d'API remplacée par une réponse valide, ex. liste vide) et
 * `fakePush` (e2e/support/fake-push.ts : état du push simulé, ce qui est simulé y est décrit).
 */
import type { BrowserContext, Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { DemoIds } from './demo-ids';
import type { FakePushCounters, FakePushMode } from './fake-push';
import type { CaptureRole } from './fixtures';
import type { PageGuard } from './network';

export interface ScreenContext {
    page: Page;
    context: BrowserContext;
    guard: PageGuard;
    ids: DemoIds | null;
}

export interface Screen {
    id: string;
    titre: string;
    role: CaptureRole;
    /** Faux s'il ne dépend pas du seed de démonstration (accueil, catalogue). */
    needsIds: boolean;
    path: (ids: DemoIds | null) => string;
    /** Attente spécifique avant la capture (contenu attendu). */
    ready?: (c: ScreenContext) => Promise<void>;
    /** Interaction avant la capture (onglet, modale, passage hors ligne). */
    actions?: (c: ScreenContext) => Promise<void>;
    /** Réponse d'API remplacée par une erreur 500 : capture de l'état d'erreur avec « Réessayer ». */
    injectError?: RegExp;
    /** Lot 6 : réponse d'API remplacée par une réponse valide (calqué sur injectError), ex. liste vide. */
    stubResponse?: { url: RegExp; status: number; body: unknown };
    /** Lot 6 : état du push simulé avant le chargement (e2e/support/fake-push.ts). */
    fakePush?: FakePushMode;
    allowFailures?: RegExp[];
    fakeCamera?: boolean;
    masks?: (page: Page) => Locator[];
}

const UUID = '[0-9a-f-]{36}';

function ids(i: DemoIds | null): DemoIds {
    if (!i) throw new Error('[e2e] écran dépendant du seed de démonstration appelé sans identifiants');
    return i;
}

function pilotage(key: keyof DemoIds['events']) {
    return (i: DemoIds | null) => `/partner/events/${ids(i).events[key].id}`;
}

async function openTab(page: Page, name: RegExp): Promise<void> {
    const tab = page.getByRole('tab', { name });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
}

async function expectRetry(c: ScreenContext): Promise<void> {
    await expect(c.page.getByRole('button', { name: /réessayer/i })).toBeVisible();
}

async function expectHeading(page: Page, name: RegExp): Promise<void> {
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

/** Compteurs du push simulé (fake-push.ts) ; erreur explicite si le script d'initialisation manque. */
async function fakePushCounters(page: Page): Promise<FakePushCounters> {
    const counters = await page.evaluate(() => (window as unknown as { __evFakePush?: FakePushCounters }).__evFakePush ?? null);
    if (!counters) throw new Error('[e2e] push simulé absent de la page (script d’initialisation fake-push.ts non chargé)');
    return counters;
}

/** Page des préférences chargée (section « Vous choisissez ») et état du push sur l'appareil affiché. */
async function preferencesReady(page: Page, deviceState: RegExp): Promise<void> {
    await expectHeading(page, /^préférences de notification$/i);
    await expect(page.getByRole('heading', { name: /^vous choisissez$/i })).toBeVisible();
    await expect(page.getByText(deviceState).first()).toBeVisible();
}

/** Aucune demande d'autorisation au chargement de la page (contrat F4 : seulement après un geste). */
async function expectNoPermissionPrompt(page: Page): Promise<void> {
    const counters = await fakePushCounters(page);
    expect(counters.requestPermissionCalls, 'demandes d’autorisation des notifications au chargement').toBe(0);
}

function tabScreen(id: string, titre: string, tab: RegExp): Screen {
    return {
        id, titre, role: 'organisateur', needsIds: true, path: pilotage('ceSoir'),
        actions: async ({ page }) => openTab(page, tab),
    };
}

export const SCREENS: readonly Screen[] = [
    // ── Public ──────────────────────────────────────────────────────────────
    { id: 'accueil', titre: 'Accueil', role: 'anonyme', needsIds: false, path: () => '/' },
    { id: 'catalogue', titre: 'Catalogue des événements', role: 'anonyme', needsIds: false, path: () => '/explore' },
    { id: 'evenement-publie', titre: 'Page publique — événement publié (ce soir)', role: 'anonyme', needsIds: true, path: (i) => `/events/${ids(i).events.ceSoir.id}` },
    {
        id: 'evenement-suspendu', titre: 'Page publique — événement suspendu (bandeau, sans achat)', role: 'anonyme', needsIds: true,
        path: (i) => `/events/${ids(i).events.suspendu.id}`,
        ready: async ({ page }) => { await expect(page.getByText(/suspendu/i).first()).toBeVisible(); },
    },
    {
        id: 'evenement-annule', titre: 'Page publique — événement annulé (avis public, remboursement)', role: 'anonyme', needsIds: true,
        path: (i) => `/events/${ids(i).events.annule.id}`,
        ready: async ({ page }) => { await expect(page.getByText(/annulé/i).first()).toBeVisible(); },
    },
    {
        id: 'evenement-termine', titre: 'Page publique — événement terminé (archive)', role: 'anonyme', needsIds: true,
        path: (i) => `/events/${ids(i).events.termine.id}`,
        ready: async ({ page }) => { await expect(page.getByText(/terminé/i).first()).toBeVisible(); },
    },
    {
        id: 'evenement-non-public', titre: 'URL d’un brouillon : page introuvable propre', role: 'anonyme', needsIds: true,
        path: (i) => `/events/${ids(i).events.brouillon.id}`,
        allowFailures: [new RegExp(`/api/events/${UUID}(\\?.*)?$`), new RegExp(`/events/${UUID}$`)],
        ready: async ({ page }) => { await expect(page.getByText(/introuvable|n[’']existe pas|404/i).first()).toBeVisible(); },
    },
    {
        id: 'hors-ligne', titre: 'Indicateur « Hors ligne » (catalogue ouvert, connexion coupée)', role: 'anonyme', needsIds: false, path: () => '/explore',
        actions: async ({ page, context, guard }) => {
            guard.freeze();
            await context.setOffline(true);
            await expect(page.getByText(/hors ligne/i).first()).toBeVisible({ timeout: 20_000 });
        },
    },
    // ── Authentification (lot 6, 6.0 e) ─────────────────────────────────────
    {
        id: 'connexion', titre: 'Connexion (système de design)', role: 'anonyme', needsIds: false, path: () => '/login',
        ready: async ({ page }) => {
            await expectHeading(page, /^connexion$/i);
            await expect(page.getByRole('button', { name: /^se connecter$/i })).toBeVisible();
        },
    },
    {
        id: 'inscription', titre: 'Inscription (système de design)', role: 'anonyme', needsIds: false, path: () => '/register',
        ready: async ({ page }) => { await expectHeading(page, /^créer un compte$/i); },
    },
    {
        id: 'mot-de-passe-oublie', titre: 'Mot de passe oublié (système de design)', role: 'anonyme', needsIds: false, path: () => '/forgot-password',
        ready: async ({ page }) => { await expectHeading(page, /^mot de passe oublié$/i); },
    },
    // ── Client ──────────────────────────────────────────────────────────────
    {
        id: 'mes-billets', titre: 'Mes billets (QR masqué)', role: 'client', needsIds: true, path: () => '/tickets',
        masks: (page) => [page.getByRole('img', { name: /QR/i })],
    },
    {
        id: 'mes-billets-recus', titre: 'Mes billets — onglet « Reçus » (transfert entrant à accepter)', role: 'client', needsIds: true,
        path: () => '/tickets?tab=recus',
        ready: async ({ page }) => {
            await expect(page.getByRole('tab', { name: /^reçus/i })).toHaveAttribute('aria-selected', 'true');
            await expect(page.getByRole('button', { name: /^accepter le billet$/i }).first()).toBeVisible();
        },
    },
    {
        id: 'preferences-push-active', titre: 'Préférences de notification — push activé sur l’appareil (abonnement simulé)', role: 'client', needsIds: true,
        path: () => '/profile/notifications', fakePush: 'granted',
        ready: async ({ page }) => {
            await preferencesReady(page, /^désactivées$/i);
            await expectNoPermissionPrompt(page);
        },
        actions: async ({ page }) => {
            const registered = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/push/subscriptions' && r.request().method() === 'POST');
            await page.getByRole('button', { name: /^activer les notifications$/i }).click();
            const res = await registered;
            expect(res.status(), `inscription de l’appareil par POST /api/push/subscriptions : ${await res.text()}`).toBe(200);
            await expect(page.getByText(/^activées sur cet appareil$/i)).toBeVisible();
            await expect(page.getByRole('button', { name: /^envoyer une notification d.essai$/i })).toBeVisible();
            const counters = await fakePushCounters(page);
            expect(counters.requestPermissionCalls, 'une seule demande d’autorisation, au clic').toBe(1);
            expect(counters.subscribeCalls, 'un seul abonnement').toBe(1);
        },
    },
    {
        id: 'preferences-push-refuse', titre: 'Préférences de notification — push refusé dans le navigateur', role: 'client', needsIds: true,
        path: () => '/profile/notifications', fakePush: 'denied',
        ready: async ({ page }) => {
            await preferencesReady(page, /^refusées dans le navigateur$/i);
            await expect(page.getByRole('button', { name: /^activer les notifications$/i })).toHaveCount(0);
            await expectNoPermissionPrompt(page);
        },
    },
    {
        id: 'preferences-push-non-pris-en-charge', titre: 'Préférences de notification — push non pris en charge par le navigateur', role: 'client', needsIds: true,
        path: () => '/profile/notifications', fakePush: 'unsupported',
        ready: async ({ page }) => {
            await preferencesReady(page, /^non prises en charge par ce navigateur$/i);
            await expect(page.getByRole('button', { name: /^activer les notifications$/i })).toHaveCount(0);
        },
    },
    {
        id: 'cloche-ouverte', titre: 'Cloche ouverte (non lues d’abord, Tout marquer comme lu)', role: 'client', needsIds: true, path: () => '/tickets',
        actions: async ({ page }) => {
            await page.getByRole('button', { name: /^notifications/i }).filter({ visible: true }).first().click();
            const panel = page.getByRole('region', { name: /^notifications$/i });
            await expect(panel).toBeVisible();
            await expect(panel.getByRole('listitem').first()).toBeVisible();
        },
    },
    {
        id: 'notifications-vide', titre: 'Notifications du client — aucune notification', role: 'client', needsIds: true, path: () => '/notifications',
        stubResponse: { url: /\/api\/notifications(\?|$)/, status: 200, body: { notifications: [], unreadCount: 0, total: 0, page: 1, pageSize: 20 } },
        ready: async ({ page }) => { await expect(page.getByText('Aucune notification', { exact: true })).toBeVisible(); },
    },
    { id: 'notifications', titre: 'Notifications du client', role: 'client', needsIds: true, path: () => '/notifications' },
    {
        id: 'notifications-erreur', titre: 'Notifications du client — état d’erreur', role: 'client', needsIds: true, path: () => '/notifications',
        injectError: /\/api\/notifications(\?|$)/, ready: expectRetry,
    },
    // ── Organisateur ────────────────────────────────────────────────────────
    { id: 'partenaire-evenements', titre: 'Liste des événements de l’organisateur', role: 'organisateur', needsIds: true, path: () => '/partner/events' },
    {
        id: 'partenaire-evenements-annules', titre: 'Liste de l’organisateur — onglet Annulé', role: 'organisateur', needsIds: true, path: () => '/partner/events',
        actions: async ({ page }) => openTab(page, /^annulé/i),
    },
    {
        id: 'partenaire-evenements-erreur', titre: 'Liste de l’organisateur — état d’erreur', role: 'organisateur', needsIds: true, path: () => '/partner/events',
        injectError: /\/api\/partner\/events(\/overview)?(\?.*)?$/, ready: expectRetry,
    },
    { id: 'partenaire-creation', titre: 'Création d’un événement (formulaire partagé)', role: 'organisateur', needsIds: true, path: () => '/partner/events/new' },
    {
        id: 'partenaire-edition', titre: 'Édition d’un événement publié avec ventes (champs verrouillés)', role: 'organisateur', needsIds: true,
        path: (i) => `/partner/events/${ids(i).events.publie.id}/edit`,
    },
    tabScreen('pilotage-apercu', 'Pilotage — Aperçu', /^aperçu/i),
    tabScreen('pilotage-ventes', 'Pilotage — Ventes', /^ventes/i),
    tabScreen('pilotage-entrees', 'Pilotage — Entrées en direct', /^entrées/i),
    tabScreen('pilotage-equipe', 'Pilotage — Équipe', /^équipe/i),
    tabScreen('pilotage-caisse', 'Pilotage — Caisse', /^caisse/i),
    tabScreen('pilotage-cloture', 'Pilotage — Clôture et export', /^clôture/i),
    {
        id: 'pilotage-annulation', titre: 'Modale « Annuler l’événement » (impact, titre à retaper)', role: 'organisateur', needsIds: true, path: pilotage('publie'),
        actions: async ({ page }) => {
            await page.getByRole('button', { name: /annuler l[’']événement/i }).click();
            await expect(page.getByRole('dialog').or(page.getByRole('alertdialog'))).toBeVisible();
        },
    },
    {
        id: 'pilotage-remboursements', titre: 'Événement annulé — avancement des remboursements', role: 'organisateur', needsIds: true, path: pilotage('annule'),
        ready: async ({ page }) => { await expect(page.getByText(/remboursements/i).first()).toBeVisible(); },
    },
    {
        id: 'pilotage-erreur', titre: 'Pilotage — état d’erreur', role: 'organisateur', needsIds: true, path: pilotage('ceSoir'),
        injectError: /\/api\/partner\/events\/[^/]+\/pilotage\/overview(\?.*)?$/, ready: expectRetry,
    },
    // ── Administration ──────────────────────────────────────────────────────
    { id: 'admin-evenements', titre: 'Administration — événements (filtres, pagination)', role: 'admin', needsIds: true, path: () => '/admin/events' },
    { id: 'admin-evenements-en-attente', titre: 'Administration — file de validation', role: 'admin', needsIds: true, path: () => '/admin/events?status=EN_ATTENTE' },
    {
        id: 'admin-evenements-erreur', titre: 'Administration — état d’erreur', role: 'admin', needsIds: true, path: () => '/admin/events',
        injectError: /\/api\/admin\/events(\?.*)?$/, ready: expectRetry,
    },
    { id: 'admin-fiche-en-attente', titre: 'Administration — fiche complète avant validation', role: 'admin', needsIds: true, path: (i) => `/admin/events/${ids(i).events.enAttente.id}` },
    { id: 'admin-fiche-suspendu', titre: 'Administration — fiche d’un événement suspendu (motif, réactiver)', role: 'admin', needsIds: true, path: (i) => `/admin/events/${ids(i).events.suspendu.id}` },
    {
        id: 'admin-notifications', titre: 'Administration — supervision des notifications (liste filtrable, compteurs)', role: 'admin', needsIds: true,
        path: () => '/admin/notifications',
        ready: async ({ page }) => {
            await expectHeading(page, /^notifications$/i);
            await expect(page.getByRole('link', { name: /^voir le détail/i }).first()).toBeVisible();
        },
    },
    {
        id: 'admin-notifications-detail', titre: 'Administration — détail d’une notification en échec (Relancer)', role: 'admin', needsIds: true,
        path: (i) => `/admin/notifications/${ids(i).notifications.failedId}`,
        ready: async ({ page }) => { await expect(page.getByRole('button', { name: /^relancer$/i })).toBeVisible(); },
    },
    {
        id: 'admin-notifications-erreur', titre: 'Administration — supervision des notifications, état d’erreur', role: 'admin', needsIds: true,
        path: () => '/admin/notifications',
        injectError: /\/api\/admin\/notifications(\?.*)?$/, ready: expectRetry,
    },
    // ── Contrôle d'accès ────────────────────────────────────────────────────
    { id: 'controleur-scanner', titre: 'Scanner du contrôleur (caméra simulée)', role: 'controleur', needsIds: true, path: () => '/controller/scanner', fakeCamera: true },
];
