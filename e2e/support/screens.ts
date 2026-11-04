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
 *
 * Lot 7 (contrat 11.2, tâche 7.7 ; commit fix(7.7)) : 116 captures de plus (billet hors ligne dans ses états,
 * scanner : départ, chaque résultat, réseau lent, hors ligne, saisie manuelle, guichet, caisse ; paiement : modale,
 * attente, succès, échec ; inscription par le code ; pages partenaire migrées dont la première utilisation ; pages
 * masquées par les interrupteurs en 404 propre ; activation et profil du contrôleur ; campagnes ; aide au
 * transfert ; portefeuille). Champs nouveaux de `Screen` :
 *  - `views` : vues capturées (défaut : les 4) ; écrans du contrôleur en sombre seul (thème forcé, D85) ;
 *  - `serviceWorkers: 'allow'` : service worker autorisé dans le contexte de l'écran (D7 : bloqué partout ailleurs) ;
 *  - `offline` : connexion coupée avant ou après le chargement (collecte d'erreurs arrêtée, guard.freeze) ;
 *  - `initStorage` : localStorage posé avant le chargement (ex. délai de retour du scanner à 3 s) ;
 *  - `stubResponses` : plusieurs réponses d'API valides imposées (méthode facultative), en plus de `stubResponse` ;
 *  - `holdRequests` : requêtes retenues, jamais servies (réseau lent, téléchargement en cours) ;
 *  - `slowTimers` : minuteries de la page de `minDelayMs` ou plus étirées (× `factor`) pour que l'état capturé ne
 *    se referme pas pendant les contrôles (plein écran du scanner, redirection après un paiement réussi) ;
 *  - `fakeCamera: 'barcode-detector'` : faux BarcodeDetector imposé (payload posé par le test) ;
 *  - `expectStatus` : statut HTTP attendu du document (404 des pages masquées).
 * Chaque simulation est écrite dans les notes de l'index (captures.spec.ts).
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

/** Vue d'une capture : appareil et thème (lot 7, contrat 11.2). */
export type CaptureView = 'mobile-clair' | 'mobile-sombre' | 'ordinateur-clair' | 'ordinateur-sombre';
/** Écrans du contrôleur : thème sombre forcé par app/controller/layout.tsx (D85), deux vues seulement. */
export const DARK_VIEWS: readonly CaptureView[] = ['mobile-sombre', 'ordinateur-sombre'];

export interface StubResponse { url: RegExp; method?: string; status: number; body: unknown }

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
    /** Caméra simulée (fake-camera.ts) ; 'barcode-detector' impose le faux BarcodeDetector (lot 7). */
    fakeCamera?: boolean | 'barcode-detector';
    masks?: (page: Page) => Locator[];
    /** Lot 7 : vues capturées (défaut : les 4). */
    views?: readonly CaptureView[];
    /** Lot 7 : service worker autorisé dans le contexte de cet écran. */
    serviceWorkers?: 'allow';
    /** Lot 7 : connexion coupée avant ou après le chargement du document. */
    offline?: 'before-load' | 'after-load';
    /** Lot 7 : localStorage posé avant le chargement (clé → valeur). */
    initStorage?: Record<string, string>;
    /** Lot 7 : réponses d'API valides imposées (en plus de stubResponse). */
    stubResponses?: StubResponse[];
    /** Lot 7 : requêtes retenues, jamais servies. */
    holdRequests?: Array<{ url: RegExp; method?: string }>;
    /** Lot 7 : setTimeout de minDelayMs ou plus multipliés par factor (état capturé tenu pendant les contrôles). */
    slowTimers?: { minDelayMs: number; factor: number };
    /** Lot 7 : statut HTTP attendu du document (sinon : réponse < 400 non vérifiée, comme avant). */
    expectStatus?: number;
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

// ── Lot 7 : outils des écrans du scanner, du billet hors ligne et des pages migrées ─────────────

/** Page chargée : un titre de niveau 1 visible (PageHeader du système de design). */
async function expectPageTitle(page: Page): Promise<void> {
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
}

/** Écran « Commencer le contrôle » affiché (ScannerStartScreen, D49), événement présélectionné. */
async function scannerStartReady(page: Page): Promise<void> {
    await expectHeading(page, /^commencer le contr[ôo]le$/i);
    await expect(page.getByRole('radio').first()).toBeVisible();
}

/** Départ du contrôle : bouton « Commencer le contrôle », mode caméra, flux vidéo en lecture. */
async function startScanner(page: Page): Promise<void> {
    await scannerStartReady(page);
    await page.getByRole('button', { name: /^commencer le contr[ôo]le$/i }).click();
    await expect(page.getByRole('button', { name: /^caméra$/i })).toHaveAttribute('aria-pressed', 'true');
    await page.waitForFunction(() => Array.from(document.querySelectorAll('video')).some((v) => v.readyState >= 2), null, { timeout: 30_000 });
}

/** QR présenté au faux BarcodeDetector (fake-camera.ts) : payload au format EVT1 d'un billet du client. */
async function presentToFakeDetector(page: Page, payload: string): Promise<void> {
    await page.evaluate((p) => {
        const cam = (window as unknown as { __evFakeCamera?: { setPayload: (x: string) => void } }).__evFakeCamera;
        if (!cam) throw new Error('caméra simulée absente de la page (fake-camera.ts)');
        cam.setPayload(p);
    }, payload);
}

/** Plein écran du résultat affiché (CombatFlashOverlay : data-scan-state="result", data-scan-result). */
async function expectScanResult(page: Page, result: string): Promise<void> {
    await expect(page.locator(`[data-scan-state="result"][data-scan-result="${result}"]`)).toBeVisible({ timeout: 20_000 });
}

/** Payload EVT1 d'un billet du client de démonstration (la réponse du scan est imposée par stubResponses). */
function demoPayload(c: ScreenContext): string {
    return `EVT1:${ids(c.ids).tickets.clientValide}:482913`;
}

const SCAN_URL = /\/api\/controller\/scan$/;
const SCAN_TICKET = { ticket_number: 'TCK-20261104-7C2D9A4B1E', category: 'Standard', holder: 'Fatou Mbaye', is_manual_entry: false };
/** Délai de retour du scanner pour une entrée validée posé à 3 s (contrat 11.2, initStorage). */
const SCANNER_STORAGE = { ev_scanner_auto_return_ms: '3000' };
/** Plein écran tenu pendant les contrôles : retours automatiques de 3 s étirés (×100), « Réseau lent » (1,5 s) intact. */
const SCANNER_TIMERS = { minDelayMs: 2500, factor: 100 };

/** Écran d'un résultat de scan : réponse du contrat 3.3 imposée, faux BarcodeDetector, plein écran attendu. */
function scanResultScreen(id: string, titre: string, body: Record<string, unknown>): Screen {
    const result = String(body.result);
    return {
        id, titre, role: 'controleur', needsIds: true, path: () => '/controller/scanner', views: DARK_VIEWS,
        fakeCamera: 'barcode-detector', initStorage: SCANNER_STORAGE, slowTimers: SCANNER_TIMERS,
        stubResponses: [{ url: SCAN_URL, method: 'POST', status: 200, body: { replayed: false, ...body } }],
        ready: async ({ page }) => startScanner(page),
        actions: async (c) => {
            await presentToFakeDetector(c.page, demoPayload(c));
            await expectScanResult(c.page, result);
        },
    };
}

/** Lien de la carte d'un billet vers sa page hors ligne (TicketCard, état « available »). */
function offlineLink(page: Page, ticketId: string): Locator {
    return page.locator(`a[href="/billet/hors-ligne?id=${encodeURIComponent(ticketId)}"]`);
}

const OFFLINE_CODES_URL = /\/api\/tickets\/[^/]+\/offline-codes(\?.*)?$/;

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
            // Corps lu seulement en cas d'échec, pour l'afficher (run 65 : lecture bloquée sur une réponse 200).
            if (res.status() !== 200) {
                throw new Error(`inscription de l’appareil par POST /api/push/subscriptions : HTTP ${res.status()} ${await res.text()}`);
            }
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
    // Lot 7 (D85, E3) : thème sombre forcé, 2 vues ; après « Commencer le contrôle » (l'écran de départ est
    // capturé à part : scanner-accueil)
    {
        id: 'controleur-scanner', titre: 'Scanner du contrôleur en cours de contrôle (caméra simulée)', role: 'controleur', needsIds: true,
        path: () => '/controller/scanner', fakeCamera: true, views: DARK_VIEWS,
        ready: async ({ page }) => startScanner(page),
    },
    // ── Lot 7 : billet hors ligne (7.1, E2) ─────────────────────────────────
    {
        id: 'billet-hors-ligne-disponible', titre: 'Mes billets — billet disponible hors ligne (service worker actif)', role: 'client', needsIds: true,
        path: () => '/tickets', serviceWorkers: 'allow',
        ready: async ({ page }) => {
            await expect(page.locator('[data-ev-offline-state="available"]').first()).toBeVisible({ timeout: 45_000 });
        },
        masks: (page) => [page.getByRole('img', { name: /QR/i })],
    },
    {
        id: 'billet-hors-ligne-a-telecharger', titre: 'Mes billets — billet pas encore enregistré sur le téléphone (téléchargement en cours)', role: 'client', needsIds: true,
        path: () => '/tickets', holdRequests: [{ url: OFFLINE_CODES_URL, method: 'GET' }],
        ready: async ({ page }) => {
            await expect(page.locator('[data-ev-offline-state="missing"]').first()).toBeVisible({ timeout: 30_000 });
        },
        masks: (page) => [page.getByRole('img', { name: /QR/i })],
    },
    {
        id: 'billet-hors-ligne-qr', titre: 'Billet hors ligne — QR affiché sans réseau (page servie par le service worker)', role: 'client', needsIds: true,
        path: () => '/tickets', serviceWorkers: 'allow',
        ready: async (c) => {
            await expect(offlineLink(c.page, ids(c.ids).tickets.clientVeille)).toBeVisible({ timeout: 45_000 });
        },
        actions: async (c) => {
            const id = ids(c.ids).tickets.clientVeille;
            c.guard.freeze(); // passage hors ligne volontaire : la collecte d'erreurs s'arrête
            await c.context.setOffline(true);
            const res = await c.page.goto(`/billet/hors-ligne?id=${encodeURIComponent(id)}`);
            expect(res?.fromServiceWorker(), '/billet/hors-ligne hors ligne : réponse servie par le service worker').toBe(true);
            await expect(c.page.locator('[data-ev-qr-payload]')).toBeVisible({ timeout: 20_000 });
        },
        masks: (page) => [page.locator('[data-ev-qr-payload]')],
    },
    {
        id: 'billet-hors-ligne-sans-codes', titre: 'Billet hors ligne — aucun code enregistré sur ce téléphone, réseau coupé', role: 'client', needsIds: true,
        path: (i) => `/billet/hors-ligne?id=${encodeURIComponent(ids(i).tickets.clientVeille)}`,
        holdRequests: [{ url: OFFLINE_CODES_URL, method: 'GET' }], offline: 'after-load',
        ready: async ({ page }) => {
            await expect(page.locator('[data-ev-offline-state="offline_missing"]').first()).toBeVisible({ timeout: 20_000 });
        },
    },
    // ── Lot 7 : scanner professionnel (7.2, E3) ─────────────────────────────
    {
        id: 'scanner-accueil', titre: 'Scanner — écran « Commencer le contrôle » (événement, porte)', role: 'controleur', needsIds: true,
        path: () => '/controller/scanner', fakeCamera: true, views: DARK_VIEWS,
        ready: async ({ page }) => scannerStartReady(page),
    },
    scanResultScreen('scanner-accepte', 'Scanner — entrée validée (plein écran)', { result: 'valid', scan_id: '5d2c7a10-8e4b-4f61-9a3d-1c2b3e4f5a60', ticket: SCAN_TICKET }),
    scanResultScreen('scanner-deja-utilise', 'Scanner — billet déjà utilisé (plein écran, heure d’entrée)', {
        result: 'already_used', scan_id: '6e3d8b21-9f5c-4a72-8b4e-2d3c4f5a6b71',
        ticket: { ...SCAN_TICKET, checked_in_at: '2026-11-04T19:42:00.000Z', checked_in_by_me: false },
    }),
    scanResultScreen('scanner-refuse', 'Scanner — entrée refusée (plein écran, QR expiré)', { result: 'qr_expired', scan_id: '7f4e9c32-a06d-4b83-9c5f-3e4d5a6b7c82', ticket: SCAN_TICKET }),
    scanResultScreen('scanner-a-encaisser', 'Scanner — encaissement requis (plein écran, caisse ouverte)', {
        result: 'cash_required', scan_id: '80a5ad43-b17e-4c94-8d6a-4f5e6b7c8d93', amount_due: 5000, ticket: SCAN_TICKET,
    }),
    scanResultScreen('scanner-hors-fenetre', 'Scanner — contrôle pas encore ouvert (plein écran)', { result: 'event_not_open', scan_id: '91b6be54-c28f-4da5-9e7b-5a6f7c8d9ea4' }),
    scanResultScreen('scanner-evenement-annule', 'Scanner — événement annulé (plein écran)', { result: 'event_cancelled', scan_id: 'a2c7cf65-d39a-4eb6-8f8c-6b7a8d9eafb5' }),
    {
        id: 'scanner-reseau-lent', titre: 'Scanner — réseau lent (envoi retenu, nouvel essai automatique)', role: 'controleur', needsIds: true,
        path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: 'barcode-detector', initStorage: SCANNER_STORAGE, slowTimers: SCANNER_TIMERS,
        holdRequests: [{ url: SCAN_URL, method: 'POST' }], allowFailures: [SCAN_URL],
        ready: async ({ page }) => startScanner(page),
        actions: async (c) => {
            await presentToFakeDetector(c.page, demoPayload(c));
            await expect(c.page.locator('[data-scan-state="slow"]')).toBeVisible({ timeout: 10_000 });
        },
    },
    {
        id: 'scanner-hors-ligne', titre: 'Scanner — hors ligne (bandeau permanent, rien n’est validé)', role: 'controleur', needsIds: true,
        path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: 'barcode-detector',
        ready: async ({ page }) => startScanner(page),
        actions: async ({ page, context, guard }) => {
            guard.freeze(); // passage hors ligne volontaire après le chargement
            await context.setOffline(true);
            await expect(page.locator('[data-scan-state="offline"]')).toBeVisible({ timeout: 10_000 });
        },
    },
    {
        id: 'scanner-saisie-manuelle', titre: 'Scanner — saisie manuelle, étape « Vérifier » (titulaire affiché)', role: 'controleur', needsIds: true,
        path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
        ready: async ({ page }) => startScanner(page),
        actions: async (c) => {
            const number = ids(c.ids).tickets.manualLookup.number;
            await c.page.getByRole('button', { name: /^saisie manuelle$/i }).click();
            await c.page.getByLabel(/^numéro du billet/i).fill(number);
            await c.page.getByRole('button', { name: /^vérifier le billet$/i }).click();
            await expect(c.page.getByRole('heading', { name: new RegExp(`billet ${number}`, 'i') })).toBeVisible();
            await expect(c.page.getByText(/^titulaire$/i)).toBeVisible();
        },
    },
    {
        id: 'scanner-guichet', titre: 'Scanner — onglet Guichet, devis servi par le serveur', role: 'controleur', needsIds: true,
        path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
        ready: async ({ page }) => startScanner(page),
        actions: async ({ page }) => {
            await openTab(page, /^guichet$/i);
            await page.getByRole('button', { name: /^ajouter un billet standard$/i }).click();
            await expect(page.getByRole('region', { name: /^total à encaisser$/i })).toBeVisible();
        },
    },
    {
        id: 'caisse-ouverture', titre: 'Caisse — ouverture (fonds de caisse, PIN facultatif)', role: 'controleur', needsIds: true,
        path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
        stubResponses: [{ url: /\/api\/controller\/shifts\/active(\?.*)?$/, method: 'GET', status: 200, body: { success: true, shift: null, expected_cash_in_drawer: null } }],
        ready: async ({ page }) => startScanner(page),
        actions: async ({ page }) => {
            await openTab(page, /^caisse$/i);
            await page.getByRole('button', { name: /^ouvrir ma caisse$/i }).click();
            await expect(page.getByRole('dialog', { name: /^ouvrir ma caisse$/i })).toBeVisible();
        },
    },
    {
        id: 'caisse-cloture-ecart', titre: 'Caisse — clôture avec écart constaté par le serveur (justification, PIN)', role: 'controleur', needsIds: true,
        path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
        stubResponses: [{
            url: /\/api\/controller\/shifts\/close$/, method: 'POST', status: 409,
            body: { success: false, code: 'JUSTIFICATION_REQUIRED', discrepancy: -2000, error: 'Écart constaté : justification et code PIN du régisseur requis.' },
        }],
        allowFailures: [/\/api\/controller\/shifts\/close$/],
        ready: async ({ page }) => startScanner(page),
        actions: async ({ page }) => {
            await openTab(page, /^caisse$/i);
            await page.getByRole('button', { name: /^clôturer ma caisse$/i }).click();
            const dialog = page.getByRole('dialog', { name: /^clôturer ma caisse$/i });
            await expect(dialog).toBeVisible();
            await dialog.getByLabel(/^espèces encaissées comptées/i).fill('8000');
            await dialog.getByRole('button', { name: /^clôturer la caisse$/i }).click();
            await expect(dialog.getByText(/^écart constaté par le serveur$/i)).toBeVisible();
            await expect(dialog.getByLabel(/^justification de l.écart/i)).toBeVisible();
        },
    },
    {
        id: 'caisse-ticket-z', titre: 'Caisse — Z de caisse après la clôture', role: 'controleur', needsIds: true,
        path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
        stubResponses: [{
            url: /\/api\/controller\/shifts\/close$/, method: 'POST', status: 200,
            body: {
                success: true,
                summary: {
                    shift_id: 'b3d8d076-e4ab-4fc7-9a9d-7c8b9eafc0c6', controller_id: 'c4e9e187-f5bc-40d8-8bae-8d9caf0b1d17',
                    controller_name: 'Ibrahima Gueye', controller_phone: '+221700000106', event_id: 'd5fae298-06cd-41e9-9cbf-9eadb01c2e28',
                    event_title: 'Nuit du Sabar — édition d’automne', opened_at: '2026-11-04T18:30:00.000Z', closed_at: '2026-11-04T23:45:00.000Z',
                    opening_float_amount: 10000, expected_cash_total: 23000, declared_cash_total: 21000, discrepancy_amount: -2000,
                    discrepancy_justification: 'Monnaie rendue en trop à un spectateur, signalée au régisseur.', status: 'CLOTURE', closing_confirmed_by_pin: true,
                },
            },
        }],
        ready: async ({ page }) => startScanner(page),
        actions: async ({ page }) => {
            await openTab(page, /^caisse$/i);
            await page.getByRole('button', { name: /^clôturer ma caisse$/i }).click();
            const dialog = page.getByRole('dialog', { name: /^clôturer ma caisse$/i });
            await dialog.getByLabel(/^espèces encaissées comptées/i).fill('21000');
            await dialog.getByRole('button', { name: /^clôturer la caisse$/i }).click();
            await expect(page.getByRole('dialog', { name: /^caisse clôturée$/i })).toBeVisible();
        },
    },
    // ── Lot 7 : paiement et inscription (7.3, E4) ───────────────────────────
    {
        id: 'paiement-modale', titre: 'Paiement — modale d’achat ouverte (opérateur, numéro)', role: 'client', needsIds: true,
        path: (i) => `/events/${ids(i).events.ceSoir.id}`,
        actions: async ({ page }) => {
            await page.getByRole('button', { name: /^ajouter un billet standard/i }).click();
            await page.getByRole('button', { name: /^acheter/i }).click();
            await expect(page.getByRole('dialog').or(page.getByRole('alertdialog'))).toBeVisible();
        },
    },
    {
        id: 'paiement-attente', titre: 'Paiement — en attente de validation chez l’opérateur', role: 'client', needsIds: true,
        path: (i) => `/paiement/${ids(i).payments.pending}`,
        ready: async ({ page }) => {
            await expect(page.locator('#payment-status-title')).toBeVisible({ timeout: 30_000 });
        },
    },
    {
        id: 'paiement-succes', titre: 'Paiement — confirmé (billets émis, redirection annulable)', role: 'client', needsIds: true,
        path: (i) => `/paiement/${ids(i).payments.success}`, slowTimers: { minDelayMs: 1000, factor: 100 },
        ready: async ({ page }) => {
            await expect(page.locator('#payment-status-title')).toHaveText(/paiement confirmé/i, { timeout: 30_000 });
        },
    },
    {
        id: 'paiement-echec', titre: 'Paiement — refusé (Réessayer le paiement)', role: 'client', needsIds: true,
        path: (i) => `/paiement/${ids(i).payments.failed}`,
        ready: async ({ page }) => {
            await expect(page.locator('#payment-status-title')).toHaveText(/n.a pas abouti/i, { timeout: 30_000 });
        },
    },
    {
        id: 'inscription-code', titre: 'Inscription — étape 2 : code reçu et profil (envoi du code simulé)', role: 'anonyme', needsIds: false, path: () => '/register',
        stubResponses: [{ url: /\/api\/auth\/register\/start$/, method: 'POST', status: 200, body: { ok: true, phone: '+221771234567', resend_after: 60 } }],
        ready: async ({ page }) => { await expectHeading(page, /^créer un compte$/i); },
        actions: async ({ page }) => {
            await page.getByLabel(/^numéro de téléphone/i).fill('77 123 45 67');
            await page.getByRole('button', { name: /^recevoir le code par sms$/i }).click();
            await expect(page.getByText(/^code reçu par sms$/i)).toBeVisible();
        },
    },
    // ── Lot 7 : pages partenaire migrées (7.4, E5 ; 7.0 f, E1) ──────────────
    {
        id: 'partenaire-inscription', titre: 'Inscription d’un partenaire (système de design)', role: 'anonyme', needsIds: false, path: () => '/partner/register',
        ready: async ({ page }) => expectPageTitle(page),
    },
    { id: 'partenaire-tableau-de-bord', titre: 'Partenaire — tableau de bord (chiffres servis par le serveur)', role: 'organisateur', needsIds: true, path: () => '/partner/dashboard', ready: async ({ page }) => expectPageTitle(page) },
    { id: 'partenaire-finances', titre: 'Partenaire — finances (écritures, retraits)', role: 'organisateur', needsIds: true, path: () => '/partner/finance', ready: async ({ page }) => expectPageTitle(page) },
    { id: 'partenaire-equipe', titre: 'Partenaire — équipe (contrôleurs et affectations)', role: 'organisateur', needsIds: true, path: () => '/partner/team', ready: async ({ page }) => expectPageTitle(page) },
    { id: 'partenaire-profil', titre: 'Partenaire — profil de l’organisateur', role: 'organisateur', needsIds: true, path: () => '/partner/profile', ready: async ({ page }) => expectPageTitle(page) },
    { id: 'partenaire-abonnement', titre: 'Partenaire — abonnement et période d’essai', role: 'organisateur', needsIds: true, path: () => '/partner/subscription', ready: async ({ page }) => expectPageTitle(page) },
    {
        id: 'partenaire-premiers-pas', titre: 'Partenaire validé sans événement — première utilisation (étapes cochées par le serveur)', role: 'partenaire-premiers-pas', needsIds: true,
        path: () => '/partner/dashboard',
        ready: async ({ page }) => {
            await expect(page.getByRole('heading', { name: /^publiez votre premier événement$/i })).toBeVisible({ timeout: 30_000 });
        },
    },
    // ── Lot 7 : pages masquées par les interrupteurs (7.3, D55) ─────────────
    {
        id: 'page-masquee-salles', titre: 'Salles de fête masquées (interrupteur fermé) : page introuvable propre', role: 'anonyme', needsIds: false, path: () => '/halls',
        expectStatus: 404, allowFailures: [/\/halls(\?.*)?$/],
        ready: async ({ page }) => { await expectHeading(page, /^page introuvable$/i); },
    },
    {
        id: 'page-masquee-commandes', titre: 'Commandes masquées (trois interrupteurs fermés) : page introuvable propre', role: 'client', needsIds: true, path: () => '/orders',
        expectStatus: 404, allowFailures: [/\/orders(\?.*)?$/],
        ready: async ({ page }) => { await expectHeading(page, /^page introuvable$/i); },
    },
    // ── Lot 7 : restes d'interface du lot 6 (7.0 f, E1) ─────────────────────
    {
        id: 'controleur-activation', titre: 'Activation d’un compte contrôleur (lien de l’invitation)', role: 'anonyme', needsIds: false,
        path: () => '/controller/setup?phone=%2B221700000199', views: DARK_VIEWS,
        ready: async ({ page }) => { await expectHeading(page, /^activer votre compte contrôleur$/i); },
    },
    {
        id: 'controleur-profil', titre: 'Profil du contrôleur (événements assignés, mot de passe)', role: 'controleur', needsIds: true, path: () => '/controller/profile', views: DARK_VIEWS,
        ready: async ({ page }) => { await expectHeading(page, /^mon profil$/i); },
    },
    {
        id: 'admin-campagnes', titre: 'Administration — campagnes de communication', role: 'admin', needsIds: true, path: () => '/admin/communications',
        ready: async ({ page }) => { await expectHeading(page, /^campagnes de communication$/i); },
    },
    {
        id: 'aide-transfert', titre: 'Mes billets — aide « Comment marche le transfert ? »', role: 'client', needsIds: true, path: () => '/tickets',
        actions: async ({ page }) => {
            await page.getByRole('button', { name: /^comment marche le transfert/i }).click();
            await expect(page.getByRole('dialog')).toBeVisible();
        },
        masks: (page) => [page.getByRole('img', { name: /QR/i })],
    },
    { id: 'portefeuille', titre: 'Portefeuille du client (solde, parrainage)', role: 'client', needsIds: true, path: () => '/wallet', ready: async ({ page }) => expectPageTitle(page) },
];
