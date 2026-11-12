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
 *
 * Lot 8 (contrat 15.6, 8.1, 11.4 ; T21, T22, T23) : écrans ajoutés au commit rouge, rouges jusqu'à leur tâche (la colonne
 * « tâche » du contrat). Modifications signalées :
 *  - T21 : evenement-non-public exige un vrai 404 et le titre de la page introuvable (200 sinon, 8.2 h) ; les quatre
 *    témoins publié, suspendu, annulé, terminé exigent 200 ; UUID inconnu et identifiant non UUID ajoutés ;
 *  - T22 : caisse-cloture-ecart répond 400, le vrai statut (contrat 3.6) ; le stub à 409 masquait le défaut f ;
 *  - T23 : scanner-guichet exige la mention « Sur place uniquement » sur la catégorie non vendue en ligne, à 14 px au moins ;
 *  - 8.2 t : admin-notifications lit par CDP le gabarit du champ de date, attendu dd/mm/yyyy (L66).
 * admin-remboursements-a-reprendre impose ses réponses : le compte admin de démonstration n'a ni payments.read ni
 * refunds.manage (L76, aucun rôle de capture ajouté) et le seed n'a aucun remboursement bloqué. Elle prouve l'écran, la
 * route est prouvée par admin-remboursements et par l'acte 8 de la recette.
 *
 * Vague F, écrans livrés (modifications signalées, aucun seuil relâché) :
 *  - partenaire-rapport-cloture : libellés de fix(8.2r) exigés (« Rapport de clôture », « Télécharger le PDF », « Entrées »,
 *    « Généré le … ») ; `references` : le numéro CLOTURE-… n'est pas une valeur technique ; fond ramené en haut de page avant
 *    les contrôles : à 390 px, la feuille coupait un bouton du tableau de bord, relevé par axe target-size (run 96) ;
 *  - pilotage-rembourser-billet : libellés de fix(8.3-A4e) exigés, fiche d'un billet payant (seed), « Revenir à la fiche » joué.
 *
 * Lot 9 (contrat section 7 ; T26) : scanner-a-encaisser retirée (A16 : plus d'encaissement au scan) ; accueil attend Populaires ;
 * sept captures ajoutées, rouges jusqu'à leurs écrans (fix(9.0e), fix(9.1e), fix(9.2e)) : invitations-onglet,
 * invitations-confirmation, mes-paiements, profil, changement-numero, accueil-ville, accueil-populaires-erreur.
 *
 * Lot 9 bis (contrat 7.3, T9 ; commit test(9b.e2e), vague R) : dix écrans ajoutés, rouges jusqu'à leurs écrans et aux
 * données du seed de la vague F (fix(9b.seed)) : admin-versements-marquer-verse, pilotage-especes-a-rembourser,
 * admin-fiche-partenaire-suspendre, profil-email-non-verifie, profil-mot-de-passe, confirmation-mot-de-passe,
 * invitation-controleur, mes-billets-recus-refuser, scanner-transfert-en-cours, verification-email. Aucun n'envoie
 * d'action qui écrit : les boîtes sont ouvertes puis capturées, jamais confirmées ; le transfert de
 * confirmation-mot-de-passe reçoit une réponse imposée (403 PASSWORD_CONFIRMATION_REQUIRED, contrat 4.2), il ne part
 * jamais au serveur. Modifications signalées (aucun seuil relâché) :
 *  - admin-remboursements-a-reprendre : passe sous fumee-superadmin (B114 : le compte admin de démonstration n'a pas
 *    refunds.manage et, avec R51, les boutons y seraient masqués) ; réponse imposée au format du contrat 4.1
 *    (can_resend, can_mark_paid, retrait compris) ; « Relancer » (2 attendus) devient « Renvoyer » et « Marquer versé »,
 *    comptés ligne par ligne selon can_resend et can_mark_paid ; titre « Versements à reprendre », ligne « Retrait »,
 *    conseil exact d'un versement incertain sans identifiant ; plus aucun « Relancer » ;
 *  - caisse-ouverture : PIN obligatoire (R42, A11) : champ du PIN requis (aria-required), plus aucun « facultatif ».
 *
 * Lot 9 ter (contrat 7.1 à 7.4, tâche 9t.20 ; commit test(9t.20), vague R) : seize écrans ajoutés, rouges jusqu'à leurs
 * écrans (vague E) et, pour ceux de l'événement à zones et de « Dernières places », jusqu'à la graine v4 (fix(9t.seed),
 * vague F ; clés lues par seedEvent, erreur explicite tant qu'elles manquent) : scanner-accepte-consigne,
 * scanner-mauvaise-zone, scanner-pas-encore-entre, scanner-zone-ok, scanner-porte-absente, scanner-liste-invites,
 * scanner-liste-invites-resultat, partenaire-zones, partenaire-equipe-portes, pilotage-entrees-zones,
 * accueil-dernieres-places, admin-versements-constater-non-verse, partenaire-finances-retrait-retarde,
 * portefeuille-retrait-retarde, admin-cloture-motif, edition-quitter-sans-enregistrer. Aucune action qui écrit : les
 * boîtes sont ouvertes puis capturées, jamais confirmées ; les réponses imposées portent des identifiants inconnus de la
 * base. Modifications signalées (aucun seuil relâché) :
 *  - scanner-deja-utilise : porte d'entrée dans la réponse (checked_in_gate « Porte Nord ») ; exige « Déjà utilisé à
 *    19:42, Porte Nord » et le fond rouge #991B1B du jeton scan-used (consigne 2, C.4, X5) ;
 *  - admin-remboursements-a-reprendre et admin-versements-marquer-verse (cashoutsReady partagée) : can_mark_not_sent sur
 *    chaque ligne, vrai pour le seul versement incertain sans identifiant ; un bouton « Constater non versé » compté par
 *    ligne où il est vrai (A.2.6) ;
 *  - partenaire-rapport-cloture : « Entrées (dont guichet) » au lieu de « Entrées » (un seul rapport, R106 b, T-B16) ;
 *  - invitations-confirmation : premier numéro saisi dans le champ « Numéro 1 » (lignes numéro et nom, 9t.17).
 * Le contraste de chaque nœud [data-scan-contrast] du plein écran est contrôlé par checks.ts (arbitrage 19).
 */
import type { BrowserContext, Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { DemoAccountKey, DemoEvent, DemoIds } from './demo-ids';
import type { FakePushCounters, FakePushMode } from './fake-push';
import type { CaptureRole } from './fixtures';
import type { PageGuard } from './network';
import { expectBuyBarAnchored } from './terrain';

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
/** Lot 8 : écrans propres au téléphone (barre d'achat, masquée à partir de lg). */
export const MOBILE_VIEWS: readonly CaptureView[] = ['mobile-clair', 'mobile-sombre'];

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
    /** Lot 9 : texte de cette erreur quand l'écran l'affiche tel quel, celui du repli de la route (sinon texte générique). */
    injectErrorMessage?: string;
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
    /** Lot 8 : formats exacts, ancrés, de références affichées, qui ne sont pas des valeurs techniques (checks.ts). */
    references?: readonly RegExp[];
}

const UUID = '[0-9a-f-]{36}';
/** Lot 8 (8.2 h) : UUID bien formé qu'aucun événement ne porte. */
const UNKNOWN_EVENT_ID = '00000000-0000-4000-8000-000000000404';
const NOT_AN_EVENT_ID = 'pas-un-identifiant';
/** Lot 8 (8.2 h) : document et lecture de l'API en 404, attendus par ces écrans. */
const EVENT_404_FAILURES = [new RegExp(`/api/events/${UUID}(\\?.*)?$`), new RegExp(`/events/${UUID}$`)];

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

/**
 * Amène l'élément au milieu de la fenêtre avant la capture (prise à la taille de l'écran, pas en pleine page) :
 * sans cela, un état placé sous la ligne de flottaison n'apparaît sur aucune image (relecture du run 77).
 */
async function revealCenter(target: Locator): Promise<void> {
    await target.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
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

// ── Lot 8 : champ de date, canaux de vente, remboursements ──────────────────

/** Nœud du document lu par CDP (DOM.getDocument en pierce) : champs utiles seulement. */
interface CdpNode { nodeType?: number; nodeName?: string; nodeValue?: string; attributes?: string[]; children?: CdpNode[]; shadowRoots?: CdpNode[] }

function cdpKids(node: CdpNode): CdpNode[] {
    return [...(node.shadowRoots ?? []), ...(node.children ?? [])];
}

function findDateInput(node: CdpNode): CdpNode | null {
    const attrs = node.attributes ?? [];
    if (node.nodeName === 'INPUT') {
        for (let i = 0; i < attrs.length; i += 2) if (attrs[i] === 'type' && attrs[i + 1] === 'date') return node;
    }
    for (const kid of cdpKids(node)) {
        const found = findDateInput(kid);
        if (found) return found;
    }
    return null;
}

function cdpText(node: CdpNode): string {
    const own = node.nodeType === 3 ? (node.nodeValue ?? '').trim() : '';
    return own + cdpKids(node).map(cdpText).join('');
}

/**
 * Gabarit affiché par le premier champ de date vide (8.2 t, L66). Il vit dans la racine fantôme du navigateur, que le
 * DOM de la page ne montre pas : lecture par CDP. Non vérifié sous Linux : si le run « avant » lit encore mm/dd/yyyy,
 * le rapport l'explique, sans changer de binaire (contrat 11.4).
 */
async function expectFrenchDateField(c: ScreenContext): Promise<void> {
    await expect(c.page.locator('input[type="date"]').first()).toBeAttached();
    const cdp = await c.context.newCDPSession(c.page);
    try {
        const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
        const input = findDateInput(root);
        if (!input) throw new Error('[e2e] aucun champ de date dans l’arbre lu par CDP');
        expect(cdpText(input), 'gabarit du champ de date, lu par CDP (8.2 t)').toBe('dd/mm/yyyy');
    } finally {
        await cdp.detach();
    }
}

/** Taille de texte calculée d'un élément (mention « Sur place uniquement » : 14 px au moins, contrat 15.7). */
async function fontSizePx(target: Locator): Promise<number> {
    return target.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
}

/** Étape « Billetterie » du formulaire d'un événement (EventForm, navigation par étapes). */
async function openTicketingStep(page: Page): Promise<void> {
    await page.getByRole('navigation', { name: /^étapes du formulaire$/i }).getByRole('button', { name: /billetterie/i }).click();
    await expect(page.getByRole('heading', { name: /^billetterie$/i })).toBeVisible();
}

const ONLINE_BOX = /^vendue en ligne/i;
const COUNTER_BOX = /^vendue au guichet/i;

/** Blocs des catégories enregistrées (EventTicketingManager), repérés par la case du guichet. */
function categorySections(page: Page): Locator {
    return page.locator('section').filter({ has: page.getByRole('checkbox', { name: COUNTER_BOX }) });
}

const REFUNDS_URL = /\/api\/admin\/refunds(\?.*)?$/;
const RECONCILIATION_URL = /\/api\/admin\/finance\/reconciliation(\?.*)?$/;
/** Lot 9 bis (B2, D-ver D1) : conseil exact d'un versement incertain sans identifiant SamirPay (seul « Marquer versé »). */
const ADVICE_UNCERTAIN_NO_ID = 'Vérifiez auprès du support SamirPay. Si le versement est parti, marquez-le versé avec sa référence.';
/**
 * Lot 9 bis (contrat 4.1, B1, B2 ; tableau « Renvoyer / Marquer versé » de la découverte D-ver) : réponse de
 * GET /api/admin/refunds?state=to_retry, du plus ancien au plus récent. Cinq versements, retrait compris :
 * « Renvoyer » sur 3 lignes (can_resend 'NOW' ou 'AFTER_CHECK'), « Marquer versé » sur les 5 (can_mark_paid).
 * Identifiants inconnus de la base : une action envoyée par erreur ne toucherait aucun versement réel.
 */
const CASHOUTS_TO_RESUME = {
    items: [
        {
            id: 'f7b8c4ba-28ef-43ab-9ed1-b0cfd23e4a4a', kind: 'TICKET_REFUND', kind_label: 'Remboursement d’un billet', state: 'ECHOUE', state_label: 'Envoi en échec',
            since: '2026-11-04T18:30:00.000Z', amount: 5250, beneficiary: '77 ••• •• 34', event_title: 'Croisière musicale vers Gorée',
            block_label: 'Refusé par l’opérateur Mobile Money', can_resend: 'NOW', can_mark_paid: true, can_mark_not_sent: false, advice: null,
        },
        {
            id: '19dae6dc-4a0b-45cd-9af3-d2e1f4506c6c', kind: 'WITHDRAWAL', kind_label: 'Retrait', state: 'BLOQUE', state_label: 'Bloqué',
            since: '2026-11-04T19:05:00.000Z', amount: 48500, beneficiary: '76 ••• •• 18', event_title: null,
            block_label: 'Solde SamirPay insuffisant', can_resend: 'NOW', can_mark_paid: true, can_mark_not_sent: false, advice: null,
        },
        {
            id: '3bfc08fe-6c2d-47ef-9c15-f40316728e8e', kind: 'EVENT_CANCELLATION_REFUND', kind_label: 'Annulation d’événement', state: 'INCERTAIN', state_label: 'Issue incertaine',
            since: '2026-11-04T20:40:00.000Z', amount: 3150, beneficiary: '78 ••• •• 52', event_title: 'Festival Jazz sur le Fleuve',
            block_label: null, can_resend: false, can_mark_paid: true, can_mark_not_sent: true, advice: ADVICE_UNCERTAIN_NO_ID,
        },
        {
            id: '4c0d19ef-7d3e-48fa-8d26-a51827839f9f', kind: 'REFUND', kind_label: 'Remboursement d’un paiement', state: 'ENVOYE_NON_CONFIRME', state_label: 'Envoyé, non confirmé',
            since: '2026-11-04T21:10:00.000Z', amount: 10500, beneficiary: '70 ••• •• 61', event_title: 'Nuit du Sabar — édition d’automne',
            block_label: null, can_resend: 'AFTER_CHECK', can_mark_paid: true, can_mark_not_sent: false, advice: null,
        },
        {
            id: '5d1e2a0f-8e4f-49ab-9e37-b62938940aa0', kind: 'TICKET_REFUND', kind_label: 'Remboursement d’un billet', state: 'BLOQUE', state_label: 'Bloqué',
            since: '2026-11-04T21:45:00.000Z', amount: 7350, beneficiary: '77 ••• •• 09', event_title: 'Croisière musicale vers Gorée',
            block_label: 'Opérateur Mobile Money inconnu', can_resend: false, can_mark_paid: true, can_mark_not_sent: false, advice: null,
        },
    ],
    total: 5,
};
const CASHOUTS_RESENDABLE = CASHOUTS_TO_RESUME.items.filter((i) => i.can_resend !== false).length;
const CASHOUTS_MARKABLE = CASHOUTS_TO_RESUME.items.filter((i) => i.can_mark_paid).length;
/** Lot 9 ter (A.2.3, A.2.6) : « Constater non versé » sur la seule ligne INCERTAIN sans identifiant SamirPay (SUPERADMIN). */
const CASHOUTS_NOT_SENT = CASHOUTS_TO_RESUME.items.filter((i) => i.can_mark_not_sent).length;
const EMPTY_RECONCILIATION = {
    summary: {
        period: 'Tout', totalTransactionsCount: 0, totalGrossVolume: 0, totalServiceFees: 0, totalAggregatorFees: 0, totalPlatformNetRevenue: 0,
        totalPartnerPayouts: 0, totalReferralCommissions: 0, totalWithdrawalsPaid: 0, totalRefunds: 0, platformNetBalance: 0, discrepanciesCount: 0,
    },
    items: [],
    // Lot 9 bis (H6, contrat 4.1), relecture des captures du run 121 : sans ces champs, readCashoutFees (app/admin/finance/page.tsx)
    // affichait « Frais SamirPay non disponibles » sur la capture. Forme de cashoutFeeReconciliation (lib/admin/finance-reconciliation.ts) ;
    // cashinNote recopie CASHIN_FEES_NOTE. Aucun versement à la page : 12 versements aux frais connus, 280 000 F CFA au taux de 1,5 %.
    cashoutFeesReal: 4290,
    cashoutFeesEstimated: 4200,
    gap: 90,
    cashoutFeeRate: 1.5,
    cashoutCount: 12,
    cashinFeesReal: null,
    cashinNote: 'Frais réels non fournis par SamirPay pour ce mode d’encaissement : comparez avec votre tableau de bord SamirPay.',
};
/** Lot 9 bis : réponses imposées des deux écrans « Versements à reprendre » (fumee-superadmin, B114). */
const CASHOUTS_STUBS: StubResponse[] = [
    { url: RECONCILIATION_URL, method: 'GET', status: 200, body: EMPTY_RECONCILIATION },
    { url: REFUNDS_URL, method: 'GET', status: 200, body: CASHOUTS_TO_RESUME },
];

/**
 * Lot 9 bis : « Versements à reprendre » de /admin/finance (RefundsToRetry, contrat 5.1) chargé : titre exact, ligne
 * « Retrait » (retraits compris, R10), conseil exact d'un versement incertain sans identifiant (B2), puis un bouton
 * « Renvoyer » par ligne où can_resend n'est pas faux et un « Marquer versé » par ligne où can_mark_paid est vrai
 * (R51 : boutons conditionnés), et plus aucun « Relancer » (route retry supprimée, B4). Lot 9 ter (A.2.6) : un
 * « Constater non versé » par ligne où can_mark_not_sent est vrai (jamais grisé, absent ailleurs).
 */
async function cashoutsReady(page: Page): Promise<{ resend: Locator; markPaid: Locator; markNotSent: Locator }> {
    await expect(page.getByRole('heading', { name: /^versements à reprendre$/i })).toBeVisible();
    await expect(page.getByText(/^retrait$/i).filter({ visible: true }).first(), 'ligne « Retrait » (retraits compris, R10)').toBeVisible();
    await expect(page.getByText(ADVICE_UNCERTAIN_NO_ID).filter({ visible: true }).first(), 'conseil d’un versement incertain sans identifiant (B2)').toBeVisible();
    const resend = page.getByRole('button', { name: /^renvoyer/i }).filter({ visible: true });
    const markPaid = page.getByRole('button', { name: /^marquer versé/i }).filter({ visible: true });
    await expect(resend, 'un bouton « Renvoyer » par ligne où can_resend n’est pas faux').toHaveCount(CASHOUTS_RESENDABLE);
    await expect(markPaid, 'un bouton « Marquer versé » par ligne où can_mark_paid est vrai').toHaveCount(CASHOUTS_MARKABLE);
    await expect(page.getByRole('button', { name: /^relancer/i }), 'plus aucun « Relancer » (B4)').toHaveCount(0);
    const markNotSent = page.getByRole('button', { name: /^constater non versé/i }).filter({ visible: true });
    await expect(markNotSent, 'un bouton « Constater non versé » par ligne où can_mark_not_sent est vrai (lot 9 ter, A.2.4)').toHaveCount(CASHOUTS_NOT_SENT);
    return { resend, markPaid, markNotSent };
}

// ── Lot 9 : invitations, découverte, compte ─────────────────────────────────

/** Onglet « Invitations » du pilotage ouvert par ?tab=invitations (libellés figés, contrat 5.1). */
async function invitationsReady(page: Page): Promise<void> {
    await expect(page.getByRole('tab', { name: /^invitations/i })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: /^envoyer les invitations$/i })).toBeVisible();
}

/** Section « Près de chez vous » de l'accueil (contrat 5.2). */
function nearbySection(page: Page): Locator {
    return page.locator('section').filter({ has: page.getByRole('heading', { name: /^près de chez vous/i }) });
}

// ── Lot 9 bis : versements, droits, transferts, email (contrat 7.3) ─────────

const TRANSFER_URL = /\/api\/tickets\/[^/]+\/transfer$/;
/** Contrat 4.2 : refus d'une action sensible sans mot de passe saisi depuis moins de 10 minutes (R57). */
const PASSWORD_CONFIRMATION_REQUIRED = {
    error: 'Par sécurité, saisissez votre mot de passe pour continuer.', code: 'PASSWORD_CONFIRMATION_REQUIRED',
};
/** Aide exacte de PasswordChangeDialog (contrat 5.42). */
const PASSWORD_RULES_HELP = '8 caractères au moins, dont une majuscule, un chiffre et un caractère spécial.';
/** Jeton factice de /verify-email : la page ne valide rien au chargement (contrat 4.6), il n'est jamais envoyé. */
const VERIFY_EMAIL_TOKEN = 'e2e-jeton-factice-jamais-envoye-0123456789abcdef';
const VERIFY_EMAIL_API = '/api/account/email/verify';

/** Boîte de dialogue ouverte, modale simple ou de confirmation (ConfirmDialog). */
function anyDialog(page: Page, name?: RegExp): Locator {
    return name
        ? page.getByRole('dialog', { name }).or(page.getByRole('alertdialog', { name }))
        : page.getByRole('dialog').or(page.getByRole('alertdialog'));
}

/** Fiche partenaire d'un compte organisateur du seed de démonstration (erreur explicite si le seed ne l'a pas écrite). */
function partnerIdOf(i: DemoIds | null, key: DemoAccountKey): string {
    const id = ids(i).accounts[key].partnerId;
    if (!id) throw new Error(`[e2e] demo-ids.json : accounts.${key}.partnerId absent (fiche partenaire du seed de démonstration)`);
    return id;
}

/** Écran existant prolongé d'un contrôle après ses propres actions. */
function withExtraActions(screen: Screen, extra: (c: ScreenContext) => Promise<void>): Screen {
    return {
        ...screen,
        actions: async (c) => {
            if (screen.actions) await screen.actions(c);
            await extra(c);
        },
    };
}

/** Requêtes déjà parties vers un chemin d'API, lues dans le minutage des ressources de la page. */
async function requestsTo(page: Page, pathname: string): Promise<number> {
    return page.evaluate((p) => performance.getEntriesByType('resource').filter((e) => new URL(e.name).pathname === p).length, pathname);
}

// ── Lot 9 ter : zones, portes, liste des invités, stock, versements (contrat 7.1 à 7.4) ──

/** Clés de la graine v4 (D.3.2, fix(9t.seed), vague F), absentes de DemoIds jusque-là. */
type Lot9terEventKey = 'zones' | 'dernieresPlaces';

/** Événement de la graine v4 lu par sa clé ; erreur explicite tant que le seed ne l'a pas écrit (capture rouge). */
function seedEvent(i: DemoIds | null, key: Lot9terEventKey): DemoEvent {
    const events = ids(i).events as Partial<Record<string, DemoEvent>>;
    const event = events[key];
    if (!event?.id) throw new Error(`[e2e] demo-ids.json : events.${key} absent (graine v4 du lot 9 ter, fix(9t.seed))`);
    return event;
}

/** Plein écran du résultat (CombatFlashOverlay). */
function scanOverlay(page: Page): Locator {
    return page.locator('[data-scan-state="result"]');
}

/** Jeton scan-used du lot 9 ter (#991B1B, C.2.4), tel que getComputedStyle le rend. */
const SCAN_USED_RED = 'rgb(153, 27, 27)';

/** Zones et portes des réponses imposées du scanner : identifiants inconnus de la base (C.6). */
const ZONE_ENTREE_VIP = { id: '00000000-0000-4000-8000-000000000911', name: 'Entrée VIP', kind: 'ENTREE', implicit: false };
const ZONE_ENTREE_GENERALE = { id: '00000000-0000-4000-8000-000000000912', name: 'Entrée générale', kind: 'ENTREE', implicit: false };
const ZONE_CARRE_VIP = { id: '00000000-0000-4000-8000-000000000913', name: 'Carré VIP', kind: 'CONTROLE', implicit: false };
const GATE_VIP = { id: '00000000-0000-4000-8000-000000000921', name: 'Porte VIP' };
const GATE_NORD = { id: '00000000-0000-4000-8000-000000000922', name: 'Porte Nord' };
const GATE_ACCES_CARRE = { id: '00000000-0000-4000-8000-000000000923', name: 'Accès carré' };
const SCAN_TICKET_VIP = { ...SCAN_TICKET, category: 'VIP' };
/** Consigne d'entrée de la capture scanner-accepte-consigne (C.6, mot pour mot). */
const ENTRY_INSTRUCTION_VIP = 'Remettre bracelet doré — orienter vers le carré VVIP';

/** Texte exact de GATE_REQUIRED au scan (contrat 11.3). */
const GATE_REQUIRED_MESSAGE = 'Aucune porte ne vous est attribuée : demandez à l’organisateur de vous en attribuer une. Rien n’a été validé.';

/** Plein écran attendu : résultat, famille de couleur (data-scan-category) et textes exacts de C.2.4. */
async function expectScanLines(page: Page, category: string, lines: readonly string[]): Promise<void> {
    const overlay = scanOverlay(page);
    await expect(overlay, `famille du résultat (C.2.4) : ${category}`).toHaveAttribute('data-scan-category', category);
    for (const line of lines) {
        await expect(overlay.getByText(line, { exact: true }).first(), `texte exact du plein écran (C.2.4) : « ${line} »`).toBeVisible();
    }
}

const GUESTS_URL = /\/api\/controller\/scan\/guests$/;
/** Réponse imposée de POST /api/controller/scan/guests (C.6) : deux billets d'un même invité, identifiants inconnus de la base. */
const GUEST_SEARCH_STUB = {
    items: [{
        guest_name: 'Awa Diop', category: 'VIP', ticket_count: 2,
        ticket_ids: ['00000000-0000-4000-8000-000000000941', '00000000-0000-4000-8000-000000000942'],
    }],
    truncated: false,
};

/**
 * Liste des invités du scanner (C.3.5) : ouverture hors du groupe « Mode de contrôle », saisie des 4 derniers chiffres,
 * recherche envoyée avec `query` (corps de la route, C.3.4), carte de l'invité de la réponse imposée.
 */
async function searchGuestList(page: Page): Promise<void> {
    await page.getByRole('button', { name: /^liste des invités$/i }).click();
    await expect(page.getByRole('heading', { name: /^liste des invités$/i })).toBeVisible();
    await page.getByLabel(/^numéro de l.invité/i).fill('4567');
    const sent = page.waitForRequest((r) => GUESTS_URL.test(new URL(r.url()).pathname) && r.method() === 'POST');
    await page.getByRole('button', { name: /^rechercher$/i }).click();
    const body = (await sent).postDataJSON() as { query?: unknown } | null;
    expect(body?.query, 'recherche envoyée avec les 4 chiffres saisis (C.3.4)').toBe('4567');
    await expect(page.getByText('Awa Diop', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('2 billets', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^choisir/i }), 'un bouton « Choisir » par invité trouvé').toHaveCount(1);
}

/** Lot 9 ter (B.6) : retrait en cours depuis 2 h, marqué retardé par le serveur. */
const TWO_HOURS_AGO = new Date(Date.now() - 2 * 3_600_000).toISOString();

/** Réponse imposée de GET /api/finance/balance (B.6) : un retrait PROCESSING retardé, identifiant inconnu de la base. */
function delayedWithdrawalBalance(account: 'ORGANISATEUR' | 'PARRAINAGE'): Record<string, unknown> {
    return {
        account_kind: account, available: 4000, pending: 0, next_available_at: null, in_progress: 6000, debt: 0, frozen: 0,
        withdrawable: 4000, withdrawal_min_amount: 5000, withdrawal_fee_rate: 1, history: [],
        withdrawals: [{
            id: '00000000-0000-4000-8000-000000000901', gross_amount: 6000, fee_amount: 60, net_amount: 5940, status: 'PROCESSING',
            operator: 'WAVE', phone_number: '771234567', withdrawal_method: 'MOBILE_MONEY', created_at: TWO_HOURS_AGO, processed_at: null,
            rejection_reason: null, effective_status: 'PROCESSING', delayed: true,
        }],
    };
}

/** Badge « Retardé » et phrase des deux écrans de retraits (0.9). */
async function delayedWithdrawalReady(page: Page): Promise<void> {
    await expect(page.getByText('Retardé', { exact: true }).filter({ visible: true }).first(), 'badge « Retardé » (delayed servi par le serveur)').toBeVisible();
    const phrase = page.getByText('Retardé : l’équipe Event Village s’en occupe.', { exact: true }).filter({ visible: true }).first();
    await expect(phrase).toBeVisible();
    await revealCenter(phrase);
}

/**
 * Fiche admin imposée (B.6) au format d'AdminEventsService.getEventSheet : événement SUSPENDU dont la fin est passée,
 * seule action « Clore l’événement » avec motif. Identifiants inconnus de la base : une clôture envoyée par erreur ne
 * toucherait aucun événement réel.
 */
const CLOSING_SHEET = {
    event: {
        id: '00000000-0000-4000-8000-000000000931', title: 'Festival des Lumières de Saint-Louis', status: 'SUSPENDU',
        description: 'Trois scènes sur les quais, musiques mandingues et mbalax jusqu’à l’aube.', category: 'FESTIVAL', image_url: null,
        start_date: '2026-11-01', start_time: '20:00', end_date: '2026-11-02', end_time: '02:00', location: 'Quai Henri Jay', city: 'Saint-Louis',
        capacity: 800, program: [], practical_info: null, created_at: '2026-10-10T09:00:00.000Z', updated_at: '2026-11-01T18:00:00.000Z',
    },
    categories: [{
        id: '00000000-0000-4000-8000-000000000932', name: 'Standard', description: null, price: 5000, total_quantity: 600,
        sale_start: null, sale_end: null, max_per_order: 10, sale_online: true, sale_counter: true, is_active: true,
    }],
    organizer: {
        id: '00000000-0000-4000-8000-000000000933', company_name: 'Ndar Événements', commercial_name: null, phone: '+221771234567', email: null,
        city: 'Saint-Louis', status: 'VALIDE', contact_name: 'Mariama Sall', contact_phone: '+221771234567', contact_email: null,
    },
    history: [
        {
            id: '00000000-0000-4000-8000-000000000934', old_status: 'PUBLIE', new_status: 'SUSPENDU', actor_role: 'ADMIN', actor_name: 'Ousmane Diallo',
            reason: 'Lieu fermé par arrêté préfectoral : en attente d’une nouvelle date.', channel: 'TRANSITION', created_at: '2026-11-01T18:00:00.000Z',
        },
        {
            id: '00000000-0000-4000-8000-000000000935', old_status: null, new_status: 'BROUILLON', actor_role: 'PARTENAIRE', actor_name: 'Mariama Sall',
            reason: null, channel: 'CREATION', created_at: '2026-10-10T09:00:00.000Z',
        },
    ],
    actions: {
        status: 'SUSPENDU', actions: [{ to: 'TERMINE', label: 'Clore l’événement', reason_required: true }], can_edit: false, can_cancel: false,
        last_reason: { kind: 'SUSPENSION', reason: 'Lieu fermé par arrêté préfectoral : en attente d’une nouvelle date.', at: '2026-11-01T18:00:00.000Z' },
    },
    cancellation: null,
};

const ENTRIES_URL = /\/api\/partner\/events\/[^/]+\/pilotage\/entries$/;
const ENTRIES_GATE_NORD = '00000000-0000-4000-8000-000000000951';
const ENTRIES_GATE_SUD = '00000000-0000-4000-8000-000000000952';
const ENTRIES_GATE_CARRE = '00000000-0000-4000-8000-000000000953';
const ENTRIES_ZONE_GENERALE = '00000000-0000-4000-8000-000000000954';
const ENTRIES_ZONE_CARRE = '00000000-0000-4000-8000-000000000955';
/** 30 minutes de débit (heure de Dakar), les 5 dernières à 11 entrées : 2,2 par minute. */
const ENTRIES_BY_MINUTE = Array.from({ length: 30 }, (_, k) => ({
    start: `2026-11-07T20:${String(30 + k).padStart(2, '0')}:00`,
    accepted: k >= 25 ? [2, 3, 2, 2, 2][k - 25] : (k * 3) % 5,
}));
/**
 * PilotageEntries complet d'un événement à zones (D.3.1) : réponse imposée de GET …/pilotage/entries, toutes les clés
 * actuelles gardées (pilotage_entries) et celles du lot 9 ter (F46, D.1.3). Totaux cohérents : 112 entrées (Porte Nord 64,
 * Porte Sud 48), 17 refus (zones 14 + 3, motifs 8 + 4 + 3 + 2), 180 attendus (catégories et origines).
 */
const ENTRIES_ZONES_STUB = {
    ok: true, event_id: '00000000-0000-4000-8000-000000000950',
    total: 112, counter: 4, refused: 17, cash_pending: 0,
    by_scanner: [
        { scanner_id: '00000000-0000-4000-8000-000000000961', name: 'Moussa Ndiaye', role: 'CONTROLEUR', entry_point: null, gate: 'Porte Nord', assigned: true, active: true, accepted: 64, refused: 2, incidents: 0, last_activity_at: '2026-11-07T20:58:00.000Z', last_incident_at: null },
        { scanner_id: '00000000-0000-4000-8000-000000000962', name: 'Aminata Sow', role: 'CONTROLEUR', entry_point: null, gate: 'Porte Sud', assigned: true, active: true, accepted: 48, refused: 12, incidents: 0, last_activity_at: '2026-11-07T20:59:00.000Z', last_incident_at: null },
        { scanner_id: '00000000-0000-4000-8000-000000000963', name: 'Khady Diouf', role: 'CONTROLEUR', entry_point: null, gate: 'Accès carré', assigned: true, active: true, accepted: 0, refused: 3, incidents: 0, last_activity_at: '2026-11-07T20:57:00.000Z', last_incident_at: null },
        { scanner_id: '00000000-0000-4000-8000-000000000964', name: 'Cheikh Fall', role: 'CONTROLEUR', entry_point: null, gate: 'Porte Sud', assigned: true, active: false, accepted: 0, refused: 0, incidents: 0, last_activity_at: null, last_incident_at: null },
    ],
    by_entry_point: [
        { entry_point: 'Porte Nord', accepted: 64, refused: 2 },
        { entry_point: 'Porte Sud', accepted: 48, refused: 12 },
        { entry_point: 'Accès carré', accepted: 0, refused: 3 },
    ],
    by_category: [
        { category_id: '00000000-0000-4000-8000-000000000971', name: 'SIMPLE', expected: 120, accepted: 70 },
        { category_id: '00000000-0000-4000-8000-000000000972', name: 'VIP', expected: 45, accepted: 30 },
        { category_id: '00000000-0000-4000-8000-000000000973', name: 'VVIP', expected: 15, accepted: 12 },
    ],
    by_quarter: [
        { start: '2026-11-07T20:00:00', accepted: 30, refused: 3 },
        { start: '2026-11-07T20:15:00', accepted: 38, refused: 5 },
        { start: '2026-11-07T20:30:00', accepted: 26, refused: 6 },
        { start: '2026-11-07T20:45:00', accepted: 18, refused: 3 },
    ],
    refusals_by_reason: [
        { result: 'invalid', label: 'Billet invalide', count: 8 },
        { result: 'already_used', label: 'Billet déjà utilisé', count: 4 },
        { result: 'wrong_zone', label: 'Mauvaise zone', count: 3 },
        { result: 'not_entered', label: 'Pas encore entré', count: 2 },
    ],
    repeated_attempts: [],
    incidents: [],
    configured: true,
    zone_checks: 21,
    by_zone: [
        { zone_id: ENTRIES_ZONE_GENERALE, name: 'Entrée générale', kind: 'ENTREE', implicit: false, expected: 180, entered: 112, checked: null, refused: 14 },
        { zone_id: ENTRIES_ZONE_CARRE, name: 'Carré VIP', kind: 'CONTROLE', implicit: false, expected: 30, entered: null, checked: 21, refused: 3 },
    ],
    by_gate: [
        { gate_key: ENTRIES_GATE_NORD, gate_id: ENTRIES_GATE_NORD, name: 'Porte Nord', zone_id: ENTRIES_ZONE_GENERALE, zone_name: 'Entrée générale', accepted: 64, refused: 2, controllers_assigned: 1, rate_per_minute: 1.4, controllers_active: 1 },
        { gate_key: ENTRIES_GATE_SUD, gate_id: ENTRIES_GATE_SUD, name: 'Porte Sud', zone_id: ENTRIES_ZONE_GENERALE, zone_name: 'Entrée générale', accepted: 48, refused: 12, controllers_assigned: 2, rate_per_minute: 0.8, controllers_active: 1 },
        { gate_key: ENTRIES_GATE_CARRE, gate_id: ENTRIES_GATE_CARRE, name: 'Accès carré', zone_id: ENTRIES_ZONE_CARRE, zone_name: 'Carré VIP', accepted: 0, refused: 3, controllers_assigned: 1, rate_per_minute: 0, controllers_active: 1 },
    ],
    by_origin: [
        { origin: 'ONLINE', label: 'En ligne', expected: 160, entered: 98 },
        { origin: 'COUNTER', label: 'Guichet', expected: 6, entered: 4 },
        { origin: 'FREE', label: 'Gratuit', expected: 4, entered: 0 },
        { origin: 'INVITATION', label: 'Invitation', expected: 10, entered: 10 },
    ],
    guest_list: {
        count: 1,
        items: [{
            scan_id: '00000000-0000-4000-8000-000000000981', at: '2026-11-07T20:12:00.000Z', category: 'VIP', gate: 'Porte Nord',
            zone: 'Entrée générale', controller: 'Moussa Ndiaye', guest_name: 'Awa Diop',
        }],
    },
    rate: { window_minutes: 5, per_minute: 2.2, by_minute: ENTRIES_BY_MINUTE },
    controllers: { window_minutes: 10, assigned: 4, active: 3 },
    alert_settings: { threshold: 10, minutes: 5 },
    alerts: [{ gate_key: 'porte-sud', name: 'Porte Sud', zone_name: 'Entrée générale', refused: 12, window_minutes: 5, threshold: 10 }],
    computed_at: '2026-11-07T21:00:00.000Z',
};

/** Onglet Équipe de l'événement à zones de la graine v4 (organisateur ; C.1.4, ZonesEditor au-dessus des contrôleurs). */
function zonesTeamPath(i: DemoIds | null): string {
    return `/partner/events/${seedEvent(i, 'zones').id}?tab=equipe`;
}

/** Éditeur des zones chargé avec les deux zones et les trois portes de la graine v4 (D.3.2). */
async function zonesEditorReady(page: Page): Promise<Locator> {
    await expect(page.getByRole('tab', { name: /^équipe/i })).toHaveAttribute('aria-selected', 'true');
    const heading = page.getByRole('heading', { name: /^zones et portes$/i });
    await expect(heading, 'section « Zones et portes » de l’onglet Équipe (C.1.4)').toBeVisible({ timeout: 30_000 });
    const zoneNames = page.getByLabel(/^nom de la zone/i);
    await expect(zoneNames, 'deux zones de la graine v4').toHaveCount(2);
    await expect(zoneNames.nth(0)).toHaveValue('Entrée générale');
    await expect(zoneNames.nth(1)).toHaveValue('Carré VIP');
    await expect(page.getByLabel(/^nom de la porte/i), 'trois portes de la graine v4').toHaveCount(3);
    return heading;
}

function tabScreen(id: string, titre: string, tab: RegExp): Screen {
    return {
        id, titre, role: 'organisateur', needsIds: true, path: pilotage('ceSoir'),
        actions: async ({ page }) => openTab(page, tab),
    };
}

export const SCREENS: readonly Screen[] = [
    // ── Public ──────────────────────────────────────────────────────────────
    {
        id: 'accueil', titre: 'Accueil', role: 'anonyme', needsIds: false, path: () => '/',
        // Lot 9 : section sous « À l'affiche », chargée après la page ; le seed y place des ventes récentes (spreadPurchases)
        ready: async ({ page }) => { await expect(page.getByRole('region', { name: /^populaires/i }).getByRole('link').first()).toBeVisible({ timeout: 30_000 }); },
    },
    { id: 'catalogue', titre: 'Catalogue des événements', role: 'anonyme', needsIds: false, path: () => '/explore' },
    { id: 'evenement-publie', titre: 'Page publique — événement publié (ce soir)', role: 'anonyme', needsIds: true, path: (i) => `/events/${ids(i).events.ceSoir.id}`, expectStatus: 200 },
    {
        id: 'evenement-suspendu', titre: 'Page publique — événement suspendu (bandeau, sans achat)', role: 'anonyme', needsIds: true,
        path: (i) => `/events/${ids(i).events.suspendu.id}`, expectStatus: 200,
        ready: async ({ page }) => { await expect(page.getByText(/suspendu/i).first()).toBeVisible(); },
    },
    {
        id: 'evenement-annule', titre: 'Page publique — événement annulé (avis public, remboursement)', role: 'anonyme', needsIds: true,
        path: (i) => `/events/${ids(i).events.annule.id}`, expectStatus: 200,
        ready: async ({ page }) => { await expect(page.getByText(/annulé/i).first()).toBeVisible(); },
    },
    {
        id: 'evenement-termine', titre: 'Page publique — événement terminé (archive)', role: 'anonyme', needsIds: true,
        path: (i) => `/events/${ids(i).events.termine.id}`, expectStatus: 200,
        ready: async ({ page }) => { await expect(page.getByText(/terminé/i).first()).toBeVisible(); },
    },
    {
        id: 'evenement-non-public', titre: 'URL d’un brouillon : page introuvable propre', role: 'anonyme', needsIds: true,
        path: (i) => `/events/${ids(i).events.brouillon.id}`,
        expectStatus: 404, allowFailures: EVENT_404_FAILURES,
        ready: async ({ page }) => { await expectHeading(page, /^page introuvable$/i); },
    },
    {
        id: 'evenement-introuvable', titre: 'URL d’un événement inconnu : vrai 404, page introuvable propre', role: 'anonyme', needsIds: false,
        path: () => `/events/${UNKNOWN_EVENT_ID}`, expectStatus: 404, allowFailures: EVENT_404_FAILURES,
        ready: async ({ page }) => { await expectHeading(page, /^page introuvable$/i); },
    },
    {
        id: 'evenement-identifiant-invalide', titre: 'URL d’un identifiant qui n’est pas un UUID : vrai 404', role: 'anonyme', needsIds: false,
        path: () => `/events/${NOT_AN_EVENT_ID}`, views: ['mobile-clair'], expectStatus: 404,
        allowFailures: [new RegExp(`/api/events/${NOT_AN_EVENT_ID}(\\?.*)?$`), new RegExp(`/events/${NOT_AN_EVENT_ID}$`)],
        ready: async ({ page }) => { await expectHeading(page, /^page introuvable$/i); },
    },
    {
        id: 'fiche-barre-achat', titre: 'Fiche d’un événement — barre d’achat fixe, panier non vide, page défilée', role: 'client', needsIds: true,
        path: (i) => `/events/${ids(i).events.ceSoir.id}`, views: MOBILE_VIEWS,
        actions: async ({ page }) => {
            await page.getByRole('button', { name: /^ajouter un billet standard/i }).click();
            await expectBuyBarAnchored(page, 'fiche de « ce soir »'); // finit à mi-page : c'est l'état capturé
        },
    },
    {
        id: 'accueil-acces-refuse', titre: 'Accueil après un accès refusé (message de la redirection)', role: 'client', needsIds: true,
        path: () => '/?error=unauthorized_admin',
        ready: async ({ page }) => { await expect(page.getByRole('alert').filter({ hasText: 'Cet espace est réservé aux administrateurs.' })).toBeVisible(); },
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
        id: 'mes-billets', titre: 'Mes billets (QR masqué)', role: 'client', needsIds: true, path: () => '/tickets?tab=a-venir', // A10 : sans onglet, « Reçus » d'office (transfert entrant du seed)
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
    {
        id: 'partenaire-categorie-canaux', titre: 'Catégorie « Carré presse » : deux canaux, sur place uniquement', role: 'organisateur', needsIds: true,
        path: (i) => `/partner/events/${ids(i).events.ceSoir.id}/edit`,
        actions: async ({ page }) => {
            await openTicketingStep(page);
            const card = categorySections(page).filter({ has: page.getByRole('heading', { name: 'Carré presse', exact: true }) });
            await expect(card.getByRole('checkbox', { name: ONLINE_BOX })).not.toBeChecked();
            await expect(card.getByRole('checkbox', { name: COUNTER_BOX })).toBeChecked();
            await expect(card.getByText('Sur place uniquement').first()).toBeVisible();
            await revealCenter(card.getByRole('checkbox', { name: ONLINE_BOX }));
        },
    },
    {
        id: 'partenaire-categorie-invitations', titre: 'Catégorie sans aucun canal : aide factuelle, aucune distribution', role: 'organisateur', needsIds: true,
        path: (i) => `/partner/events/${ids(i).events.ceSoir.id}/edit`,
        actions: async ({ page }) => {
            await openTicketingStep(page);
            // Ligne ajoutée au seed par fix(8.0-seed) (L80) : son nom n'est pas fixé par le contrat, seul son résumé l'est
            const card = categorySections(page).filter({ hasText: 'Invitations seulement' });
            await expect(card.getByRole('checkbox', { name: ONLINE_BOX })).not.toBeChecked();
            await expect(card.getByRole('checkbox', { name: COUNTER_BOX })).not.toBeChecked();
            await expect(card.getByText('Cette catégorie n’est vendue ni en ligne ni au guichet. Distribuez ses billets depuis l’onglet Invitations du pilotage.')).toBeVisible();
            await revealCenter(card.getByRole('checkbox', { name: ONLINE_BOX }));
        },
    },
    {
        id: 'partenaire-rapport-cloture', titre: 'Rapport de clôture d’un événement terminé (modale du tableau de bord)', role: 'organisateur', needsIds: true,
        path: () => '/partner/dashboard', references: [/^CLOTURE-[0-9A-F]{8}-\d{8}$/],
        actions: async (c) => {
            const { title } = ids(c.ids).events.termine;
            const button = c.page.locator('tr, li, article')
                .filter({ hasText: title })
                .getByRole('button', { name: /^clôture$/i })
                .filter({ visible: true })
                .first();
            const loaded = c.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/partner/reports/closing');
            await button.click();
            const report = await loaded;
            expect(report.status(), `rapport de clôture de « ${title} »`).toBe(200);
            const dialog = c.page.getByRole('dialog', { name: /^rapport de clôture$/i });
            await expect(dialog).toBeVisible();
            await expect(dialog.getByText(title).first()).toBeVisible();
            await expect(dialog.getByText(/^généré le/i)).toBeVisible();
            await expect(dialog.getByText('Entrées (dont guichet)', { exact: true }).filter({ visible: true }).first(), 'un seul rapport (lot 9 ter, R106 b)').toBeVisible();
            await expect(dialog.getByRole('button', { name: /^télécharger le pdf$/i })).toBeVisible();
            await c.page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        },
    },
    tabScreen('pilotage-apercu', 'Pilotage — Aperçu', /^aperçu/i),
    tabScreen('pilotage-ventes', 'Pilotage — Ventes', /^ventes/i),
    {
        id: 'pilotage-rembourser-billet', titre: 'Pilotage — Ventes : fiche d’un billet à rembourser', role: 'organisateur', needsIds: true, path: pilotage('ceSoir'),
        actions: async (c) => {
            const { number } = ids(c.ids).tickets.manualLookup;
            await openTab(c.page, /^ventes/i);
            await c.page.getByLabel(/^numéro du billet/i).fill(number);
            const found = c.page.waitForResponse((r) => new URL(r.url()).pathname.endsWith('/tickets/lookup'));
            await c.page.getByRole('button', { name: /^rechercher le billet$/i }).click();
            expect((await found).status(), `recherche du billet ${number}`).toBe(200);
            const refund = c.page.getByRole('button', { name: /^rembourser ce billet$/i });
            await expect(refund).toBeVisible();
            await expect(c.page.getByRole('button', { name: /^annuler ce billet gratuit$/i }), 'billet payant : jamais l’action du billet gratuit').toHaveCount(0);
            // Le motif se quitte sans rien envoyer : capture de la fiche, pas d'un remboursement
            await refund.click();
            const reason = c.page.getByRole('dialog', { name: /^motif du remboursement$/i });
            await reason.getByRole('button', { name: /^revenir à la fiche$/i }).click();
            await expect(reason).toBeHidden();
            await revealCenter(refund);
        },
    },
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
        actions: expectFrenchDateField,
    },
    {
        id: 'admin-notifications-detail', titre: 'Administration — détail d’une notification en échec (Relancer)', role: 'admin', needsIds: true,
        path: (i) => `/admin/notifications/${ids(i).notifications.failedId}`,
        ready: async ({ page }) => { await expect(page.getByRole('button', { name: /^relancer$/i })).toBeVisible(); },
    },
    {
        id: 'admin-notifications-erreur', titre: 'Administration — supervision des notifications, état d’erreur', role: 'admin', needsIds: true,
        path: () => '/admin/notifications',
        injectError: /\/api\/admin\/notifications(\?.*)?$/,
        // L'état d'erreur est sous les compteurs et les filtres : à 390 px, il était hors de l'image (run 77)
        ready: async (c) => {
            await expectRetry(c);
            await revealCenter(c.page.getByRole('button', { name: /réessayer/i }));
        },
    },
    {
        id: 'admin-services-desactive', titre: 'Administration — services : mention « Service désactivé » (interrupteur fermé)', role: 'admin', needsIds: true,
        path: () => '/admin/services?tab=salles',
        ready: async ({ page }) => {
            await expect(page.getByRole('tab', { name: /^salles de fête/i })).toHaveAttribute('aria-selected', 'true');
            await expect(page.getByText('Service désactivé', { exact: true })).toBeVisible();
            await expect(page.getByText('Ce service est fermé par son interrupteur : il est masqué au public. Les données restent consultables ici.')).toBeVisible();
        },
    },
    {
        // Lot 9 bis (7.3, B114) : sous fumee-superadmin, réponse au format du contrat 4.1 ; voir l'en-tête du fichier
        id: 'admin-remboursements-a-reprendre', titre: 'Administration — finances : versements à reprendre (Renvoyer, Marquer versé ; réponses imposées)',
        role: 'fumee-superadmin', needsIds: false, path: () => '/admin/finance',
        stubResponses: CASHOUTS_STUBS,
        ready: async ({ page }) => {
            const { resend } = await cashoutsReady(page);
            await revealCenter(resend.first());
        },
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
        path: () => '/tickets?tab=a-venir', serviceWorkers: 'allow', // A10 (R45) : onglet des billets demandé, sinon « Reçus » d'office
        ready: async ({ page }) => {
            const state = page.locator('[data-ev-offline-state="available"]').first();
            await expect(state).toBeVisible({ timeout: 45_000 });
            // L'indicateur est sous l'affiche et le QR : sans défilement, aucune image ne le montrait (run 77)
            await revealCenter(state);
        },
        masks: (page) => [page.getByRole('img', { name: /QR/i })],
    },
    {
        id: 'billet-hors-ligne-a-telecharger', titre: 'Mes billets — billet pas encore enregistré sur le téléphone (téléchargement en cours)', role: 'client', needsIds: true,
        path: () => '/tickets?tab=a-venir', holdRequests: [{ url: OFFLINE_CODES_URL, method: 'GET' }], // A10 (R45)
        ready: async ({ page }) => {
            const state = page.locator('[data-ev-offline-state="missing"]').first();
            await expect(state).toBeVisible({ timeout: 30_000 });
            await revealCenter(state); // même raison que billet-hors-ligne-disponible
        },
        masks: (page) => [page.getByRole('img', { name: /QR/i })],
    },
    {
        id: 'billet-hors-ligne-qr', titre: 'Billet hors ligne — QR affiché sans réseau (page servie par le service worker)', role: 'client', needsIds: true,
        path: () => '/tickets?tab=a-venir', serviceWorkers: 'allow', // A10 (R45)
        // Billet de « ce soir » (contrôle déjà ouvert), pas celui de « la veille » : le seed ne modifie pas
        // access.scan_window_before_hours, donc le lot téléchargé la veille commence à l'ouverture du contrôle
        // (début − before_hours, D31) et la page affiche à juste titre « Le code d'entrée s'affichera ici à partir
        // du … » sans QR (run 77). Le billet de « la veille » reste celui de billet-hors-ligne-sans-codes.
        ready: async (c) => {
            await expect(offlineLink(c.page, ids(c.ids).tickets.clientValide)).toBeVisible({ timeout: 45_000 });
        },
        actions: async (c) => {
            const id = ids(c.ids).tickets.clientValide;
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
    // Lot 9 ter (consigne 2, C.4, X5) : porte d'entrée servie ; ligne « Déjà utilisé à {HH:MM}, {porte} » et rouge #991B1B
    withExtraActions(
        scanResultScreen('scanner-deja-utilise', 'Scanner — billet déjà utilisé (plein écran, heure d’entrée)', {
            result: 'already_used', scan_id: '6e3d8b21-9f5c-4a72-8b4e-2d3c4f5a6b71',
            ticket: { ...SCAN_TICKET, checked_in_at: '2026-11-04T19:42:00.000Z', checked_in_by_me: false, checked_in_gate: 'Porte Nord' },
        }),
        async ({ page }) => {
            const overlay = scanOverlay(page);
            await expect(overlay.getByText('Déjà utilisé à 19:42, Porte Nord', { exact: true }), 'heure et porte de la première entrée (C.2.4, X5)').toBeVisible();
            await expect(overlay, 'fond du jeton scan-used : rouge #991B1B (C.2.4)').toHaveCSS('background-color', SCAN_USED_RED);
        },
    ),
    scanResultScreen('scanner-refuse', 'Scanner — entrée refusée (plein écran, QR expiré)', { result: 'qr_expired', scan_id: '7f4e9c32-a06d-4b83-9c5f-3e4d5a6b7c82', ticket: SCAN_TICKET }),
    scanResultScreen('scanner-hors-fenetre', 'Scanner — contrôle pas encore ouvert (plein écran)', { result: 'event_not_open', scan_id: '91b6be54-c28f-4da5-9e7b-5a6f7c8d9ea4' }),
    scanResultScreen('scanner-evenement-annule', 'Scanner — événement annulé (plein écran)', { result: 'event_cancelled', scan_id: 'a2c7cf65-d39a-4eb6-8f8c-6b7a8d9eafb5' }),
    // Lot 8 (8.2 e, contrat 3.5) : réponse d'un renvoi sans ligne, ni scan_id ni ticket ; le parcours réel est au projet terrain
    scanResultScreen('scanner-non-traite', 'Scanner — scan non traité après un renvoi (plein écran)', {
        result: 'not_processed', code: 'REPLAY_NOT_FOUND', message: 'Scan non traité : aucune entrée enregistrée. Scannez le billet de nouveau.',
    }),
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
            // Lot 8 (T23) : catégorie vendue au guichet seulement, reconnue d'un coup d'œil
            const press = page.getByRole('list', { name: /^catégories en vente$/i }).getByRole('listitem').filter({ hasText: 'Carré presse' });
            const mention = press.getByText('Sur place uniquement', { exact: true });
            await expect(mention).toBeVisible();
            expect(await fontSizePx(mention), 'taille de la mention « Sur place uniquement », en pixels').toBeGreaterThanOrEqual(14);
            await revealCenter(mention);
        },
    },
    {
        id: 'caisse-ouverture', titre: 'Caisse — ouverture (fonds de caisse, PIN obligatoire)', role: 'controleur', needsIds: true,
        path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
        stubResponses: [{ url: /\/api\/controller\/shifts\/active(\?.*)?$/, method: 'GET', status: 200, body: { success: true, shift: null, expected_cash_in_drawer: null } }],
        ready: async ({ page }) => startScanner(page),
        actions: async ({ page }) => {
            await openTab(page, /^caisse$/i);
            await page.getByRole('button', { name: /^ouvrir ma caisse$/i }).click();
            const dialog = page.getByRole('dialog', { name: /^ouvrir ma caisse$/i });
            await expect(dialog).toBeVisible();
            // Lot 9 bis (R42, A11, contrat 4.3 PIN_REQUIRED) : le PIN du régisseur est obligatoire à l'ouverture
            await expect(dialog.getByLabel(/^code pin du régisseur/i), 'PIN du régisseur obligatoire à l’ouverture (R42)').toHaveAttribute('aria-required', 'true');
            await expect(dialog.getByText(/facultatif/i), 'plus aucune mention « facultatif » du PIN (R42)').toHaveCount(0);
        },
    },
    {
        id: 'caisse-cloture-ecart', titre: 'Caisse — clôture avec écart constaté par le serveur (justification, PIN)', role: 'controleur', needsIds: true,
        path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
        stubResponses: [{
            url: /\/api\/controller\/shifts\/close$/, method: 'POST', status: 400,
            body: { success: false, code: 'JUSTIFICATION_REQUIRED', discrepancy: -2000, error: 'Écart constaté : justification et code PIN du régisseur requis.' },
        }],
        allowFailures: [/\/api\/controller\/shifts\/close$/],
        ready: async ({ page }) => startScanner(page),
        actions: async ({ page }) => {
            await openTab(page, /^caisse$/i);
            await page.getByRole('button', { name: /^clôturer ma caisse$/i }).click();
            const dialog = page.getByRole('dialog', { name: /^clôturer ma caisse$/i });
            await expect(dialog).toBeVisible();
            // 2 000 de moins que le montant enregistré à l'écran : l'écart affiché (-2 000, réponse figée ci-dessus) tombe juste
            const recorded = Number((await dialog.locator('dd').nth(1).innerText()).replace(/\D/g, ''));
            await dialog.getByLabel(/^espèces encaissées comptées/i).fill(String(recorded - 2000));
            await dialog.getByRole('button', { name: /^clôturer la caisse$/i }).click();
            await expect(dialog.getByText(/^écart constaté$/i)).toBeVisible();
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
            // Bouton du panneau de billetterie (« Acheter 1 billet (…) ») : à 390 px la barre d'achat fixe du bas
            // (lg:hidden) porte aussi « Acheter (…) », même action ; /^acheter/ visait les deux (run 77, mode strict).
            await page.getByRole('button', { name: /^acheter \d+ billets? \(/i }).click();
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
    // ── Lot 9 : invitations, découverte, compte (contrat section 7) ─────────
    {
        id: 'invitations-onglet', titre: 'Pilotage — Invitations (catégorie, numéros, liste)', role: 'organisateur', needsIds: true,
        path: (i) => `/partner/events/${ids(i).events.ceSoir.id}?tab=invitations`,
        ready: async ({ page }) => invitationsReady(page),
    },
    {
        id: 'invitations-confirmation', titre: 'Pilotage — Invitations : confirmation de l’envoi', role: 'organisateur', needsIds: true,
        path: (i) => `/partner/events/${ids(i).events.ceSoir.id}?tab=invitations`,
        ready: async ({ page }) => invitationsReady(page),
        actions: async ({ page }) => {
            const category = page.getByRole('tabpanel').getByLabel(/^catégorie/i);
            const value = await category.locator('option:not([value=""]):not([disabled])').first().getAttribute('value');
            if (!value) throw new Error('[e2e] aucune catégorie proposée dans le champ Catégorie des invitations');
            await category.selectOption(value);
            await page.getByLabel(/^numéro 1(?!\d)/i).fill('771234567'); // lot 9 ter (9t.17) : lignes numéro et nom
            await page.getByRole('button', { name: /^envoyer les invitations$/i }).click();
            await expect(page.getByRole('alertdialog', { name: /^confirmer l.envoi/i })).toBeVisible();
        },
    },
    {
        id: 'mes-paiements', titre: 'Mes paiements (date, événement, montant, opérateur, statut, totaux)', role: 'client', needsIds: true,
        path: () => '/profile/payments', expectStatus: 200,
        ready: async ({ page }) => {
            await expectHeading(page, /^mes paiements$/i);
            await expect(page.locator('a[href^="/paiement/"]').first()).toBeVisible();
        },
    },
    {
        id: 'profil', titre: 'Profil du client (identité, photo, numéro)', role: 'client', needsIds: true, path: () => '/profile',
        ready: async ({ page }) => {
            await expect(page.getByRole('button', { name: /^enregistrer le profil$/i })).toBeVisible();
            await expect(page.getByRole('button', { name: /^changer de numéro$/i })).toBeVisible();
            await expect(page.getByRole('button', { name: /^choisir une photo$/i })).toBeVisible();
        },
    },
    {
        id: 'changement-numero', titre: 'Profil du client — changement de numéro (boîte ouverte)', role: 'client', needsIds: true, path: () => '/profile',
        actions: async ({ page }) => {
            await page.getByRole('button', { name: /^changer de numéro$/i }).click();
            await expect(page.getByRole('dialog')).toBeVisible();
        },
    },
    {
        id: 'accueil-ville', titre: 'Accueil — Près de chez vous, ville gardée sur l’appareil', role: 'anonyme', needsIds: false, path: () => '/',
        initStorage: { 'ev-city': 'DAKAR' },
        ready: async ({ page }) => {
            await expect(nearbySection(page).getByRole('combobox'), 'ville du visiteur relue sur l’appareil').toHaveValue('DAKAR', { timeout: 30_000 });
            await revealCenter(nearbySection(page).getByRole('combobox'));
        },
    },
    {
        id: 'accueil-populaires-erreur', titre: 'Accueil — Populaires, état d’erreur (Réessayer)', role: 'anonyme', needsIds: false, path: () => '/',
        injectError: /\/api\/events\/popular/,
        injectErrorMessage: 'Populaires momentanément indisponibles.',
        // Section sous « À l'affiche » : hors de l'image sans défilement
        ready: async (c) => {
            await expectRetry(c);
            await revealCenter(c.page.getByRole('button', { name: /réessayer/i }));
        },
    },
    // ── Lot 9 bis : versements, droits, transferts, email (contrat 7.3, T9) ──
    // Rouges jusqu'à leurs écrans (vague E) et aux données du seed (fix(9b.seed)) ; aucune boîte n'est confirmée.
    {
        id: 'admin-versements-marquer-verse', titre: 'Administration — versements à reprendre : boîte « Marquer versé » (justification, référence ; réponses imposées)',
        role: 'fumee-superadmin', needsIds: false, path: () => '/admin/finance',
        stubResponses: CASHOUTS_STUBS,
        ready: async ({ page }) => { await cashoutsReady(page); },
        actions: async ({ page }) => {
            // Ligne incertaine sans identifiant SamirPay : « Marquer versé » seul, avec la référence (B2)
            const row = page.locator('tr, li, article').filter({ hasText: 'Festival Jazz sur le Fleuve' });
            await row.getByRole('button', { name: /^marquer versé/i }).filter({ visible: true }).first().click();
            const dialog = anyDialog(page, /marquer/i);
            await expect(dialog).toBeVisible();
            await expect(dialog.getByLabel(/justification/i), 'justification obligatoire (contrat 5.1)').toBeVisible();
            await expect(dialog.getByLabel(/référence/i), 'référence SamirPay du versement (contrat 4.1, REFERENCE_REQUIRED)').toBeVisible();
        },
    },
    {
        id: 'pilotage-especes-a-rembourser', titre: 'Événement annulé — espèces à rembourser par l’organisateur (ventes au guichet)', role: 'organisateur', needsIds: true,
        path: pilotage('annule'),
        ready: async ({ page }) => {
            const heading = page.getByRole('heading', { name: /^espèces à rembourser par l[’']organisateur/i });
            await expect(heading, 'section des ventes au guichet d’un événement annulé (R20)').toBeVisible({ timeout: 30_000 });
            await expect(page.getByRole('checkbox', { name: /remboursé/i }).first(), 'case « Remboursé » d’une vente au guichet du seed').toBeVisible();
            await revealCenter(heading);
        },
    },
    {
        id: 'admin-fiche-partenaire-suspendre', titre: 'Administration — fiche d’un partenaire validé : boîte « Suspendre » (motif)', role: 'fumee-superadmin', needsIds: true,
        path: (i) => `/admin/dashboard?partenaires=ALL&dossier=${encodeURIComponent(partnerIdOf(i, 'organisateur'))}`,
        ready: async ({ page }) => {
            await expect(page.getByRole('dialog', { name: /^dossier du partenaire/i }), 'fiche ouverte par le lien profond ?dossier= (R6)').toBeVisible({ timeout: 30_000 });
        },
        actions: async ({ page }) => {
            const dossier = page.getByRole('dialog', { name: /^dossier du partenaire/i });
            // Partenaire VALIDE : « Valider » et « Refuser » réservés à un dossier en attente, « Réactiver » à un suspendu (5.15)
            await expect(dossier.getByRole('button', { name: /^valider/i }), '« Valider » sur un partenaire validé').toHaveCount(0);
            await expect(dossier.getByRole('button', { name: /^refuser/i }), '« Refuser » sur un partenaire validé').toHaveCount(0);
            await expect(dossier.getByRole('button', { name: /^réactiver/i }), '« Réactiver » sur un partenaire validé').toHaveCount(0);
            await dossier.getByRole('button', { name: /^suspendre/i }).click();
            const box = anyDialog(page, /^suspendre/i);
            await expect(box).toBeVisible();
            await expect(box.getByLabel(/^motif/i), 'motif obligatoire de la suspension (R55)').toBeVisible();
        },
    },
    {
        id: 'profil-email-non-verifie', titre: 'Profil du client — adresse email en attente de vérification (Renvoyer le lien)', role: 'client', needsIds: true, path: () => '/profile',
        ready: async ({ page }) => {
            await expect(page.getByText('Email non vérifié', { exact: true }).first(), 'adresse en attente du client du seed (email_pending, R87)').toBeVisible();
            const resend = page.getByRole('button', { name: /^renvoyer le lien$/i });
            await expect(resend).toBeVisible();
            await revealCenter(resend);
        },
    },
    {
        id: 'profil-mot-de-passe', titre: 'Profil du client — « Changer de mot de passe » ouvert (trois champs, règle)', role: 'client', needsIds: true, path: () => '/profile',
        ready: async ({ page }) => {
            await expect(page.getByText('Les autres appareils seront déconnectés.', { exact: true }), 'bloc « Mot de passe » du profil (5.42)').toBeVisible();
        },
        actions: async ({ page }) => {
            await page.getByRole('button', { name: /^changer de mot de passe$/i }).click();
            const dialog = anyDialog(page, /mot de passe/i);
            await expect(dialog).toBeVisible();
            await expect(dialog.locator('input[type="password"]'), 'mot de passe actuel, nouveau et confirmation (R85)').toHaveCount(3);
            await expect(dialog.getByText(PASSWORD_RULES_HELP, { exact: true })).toBeVisible();
        },
    },
    {
        id: 'confirmation-mot-de-passe', titre: 'Mes billets — transfert : boîte « mot de passe » avant l’envoi (réponse imposée, rien ne part)', role: 'client', needsIds: true,
        path: () => '/tickets?tab=a-venir', // A10 (R45) : la carte et son bouton « Transférer » sont dans « À venir »
        // Le transfert ne part jamais au serveur : réponse 403 du contrat 4.2 imposée (le seed reste intact)
        stubResponses: [{ url: TRANSFER_URL, method: 'POST', status: 403, body: PASSWORD_CONFIRMATION_REQUIRED }],
        allowFailures: [TRANSFER_URL],
        actions: async ({ page }) => {
            await page.getByRole('button', { name: /^transférer$/i }).filter({ visible: true }).first().click();
            const transfer = page.getByRole('dialog', { name: /^transférer ce billet$/i });
            await expect(transfer).toBeVisible();
            await transfer.getByLabel(/^numéro de téléphone du destinataire/i).fill('771234567');
            await transfer.getByRole('button', { name: /^envoyer le billet$/i }).click();
            const confirm = anyDialog(page, /mot de passe/i);
            await expect(confirm, 'boîte « mot de passe » ouverte par PASSWORD_CONFIRMATION_REQUIRED (R57)').toBeVisible();
            await expect(confirm.locator('input[type="password"]'), 'un seul champ : le mot de passe du compte').toHaveCount(1);
        },
        masks: (page) => [page.getByRole('img', { name: /QR/i })],
    },
    {
        id: 'invitation-controleur', titre: 'Invitations — invitation de contrôleur en attente (Accepter, Refuser)', role: 'client', needsIds: true,
        path: () => '/invitations', expectStatus: 200,
        ready: async ({ page }) => {
            await expectPageTitle(page);
            await expect(page.getByRole('button', { name: /^accepter/i }).first(), 'invitation en attente du seed (R37)').toBeVisible();
            await expect(page.getByRole('button', { name: /^refuser/i }).first()).toBeVisible();
        },
    },
    {
        id: 'mes-billets-recus-refuser', titre: 'Mes billets — Reçus : confirmation « Refuser » d’un transfert entrant', role: 'client', needsIds: true,
        path: () => '/tickets?tab=recus',
        ready: async ({ page }) => {
            await expect(page.getByRole('tab', { name: /^reçus/i })).toHaveAttribute('aria-selected', 'true');
            await expect(page.getByRole('button', { name: /^accepter le billet$/i }).first()).toBeVisible();
        },
        actions: async ({ page }) => {
            await page.getByRole('button', { name: /^refuser/i }).filter({ visible: true }).first().click();
            const confirm = anyDialog(page);
            await expect(confirm, 'confirmation du refus (R46)').toBeVisible();
            await expect(confirm.getByRole('button', { name: /^refuser/i })).toBeVisible();
        },
    },
    withExtraActions(
        scanResultScreen('scanner-transfert-en-cours', 'Scanner — billet en cours de transfert (plein écran « Transfert en cours »)', {
            result: 'transfer_pending', scan_id: 'c6e1f2a3-b4c5-4d6e-8f70-81a2b3c4d5e6', ticket: SCAN_TICKET,
        }),
        async ({ page }) => {
            await expect(page.locator('[data-scan-state="result"]').getByText(/^transfert en cours/i).first(), 'libellé du résultat transfer_pending (R19)').toBeVisible();
        },
    ),
    {
        id: 'verification-email', titre: 'Vérification d’une adresse email — « Confirmer mon adresse » (rien n’est validé au chargement)', role: 'anonyme', needsIds: false,
        path: () => `/verify-email?t=${VERIFY_EMAIL_TOKEN}`, expectStatus: 200,
        ready: async ({ page }) => {
            await expectHeading(page, /^vérifier mon adresse email$/i);
            await expect(page.getByRole('button', { name: /^confirmer mon adresse$/i })).toBeVisible();
        },
        actions: async ({ page }) => {
            await expect.poll(() => new URL(page.url()).searchParams.has('t'), { message: 'jeton effacé de l’adresse (history.replaceState, contrat 4.6)' }).toBe(false);
            const referrers = await page.evaluate(() => Array.from(document.querySelectorAll('meta[name="referrer"]'), (m) => m.getAttribute('content')));
            expect(referrers, 'politique de référent de la page (contrat 4.6)').toEqual(['no-referrer']);
            expect(await requestsTo(page, VERIFY_EMAIL_API), `aucun appel à ${VERIFY_EMAIL_API} au chargement (contrat 4.6)`).toBe(0);
        },
    },
    // ── Lot 9 ter : zones, portes, liste des invités (C.6) ───────────────────
    // Rouges jusqu'aux écrans d'E-C (fix(9t.15e), fix(9t.16e), fix(9t.17e)) ; partenaire-zones et partenaire-equipe-portes
    // aussi jusqu'à la graine v4 (événement à zones VALIDE, fix(9t.seed)).
    withExtraActions(
        scanResultScreen('scanner-accepte-consigne', 'Scanner — entrée validée : bande de catégorie, consigne, zone et porte, badge Invitation', {
            result: 'valid', scan_id: 'd3f8a1b2-4c5d-4e6f-8a7b-9c0d1e2f3a41',
            ticket: { ...SCAN_TICKET_VIP, category_color: 'OR', entry_instruction: ENTRY_INSTRUCTION_VIP, origin: 'INVITATION' },
            zone: ZONE_ENTREE_VIP, gate: GATE_VIP,
        }),
        async ({ page }) => expectScanLines(page, 'accepte', ['Entrée validée', ENTRY_INSTRUCTION_VIP, 'Zone : Entrée VIP · Porte VIP', 'Invitation']),
    ),
    withExtraActions(
        scanResultScreen('scanner-mauvaise-zone', 'Scanner — mauvaise zone (plein écran orange, zone où se présenter)', {
            result: 'wrong_zone', scan_id: 'd3f8a1b2-4c5d-4e6f-8a7b-9c0d1e2f3a42', message: 'Accès refusé : billet VIP',
            ticket: SCAN_TICKET_VIP, redirect_zones: ['Entrée VIP'], zone: ZONE_ENTREE_GENERALE, gate: GATE_NORD,
        }),
        async ({ page }) => expectScanLines(page, 'oriente', ['Accès refusé : billet VIP', 'Présentez-vous à : Entrée VIP']),
    ),
    withExtraActions(
        scanResultScreen('scanner-pas-encore-entre', 'Scanner — pas encore entré (contrôle de zone, plein écran orange)', {
            result: 'not_entered', scan_id: 'd3f8a1b2-4c5d-4e6f-8a7b-9c0d1e2f3a43',
            ticket: SCAN_TICKET_VIP, redirect_zones: ['Entrée VIP'], zone: ZONE_CARRE_VIP, gate: GATE_ACCES_CARRE,
        }),
        async ({ page }) => expectScanLines(page, 'oriente', ['Pas encore entré', 'Passez d’abord par : Entrée VIP']),
    ),
    withExtraActions(
        scanResultScreen('scanner-zone-ok', 'Scanner — contrôle de zone accepté (heure et porte de l’entrée)', {
            result: 'zone_ok', scan_id: 'd3f8a1b2-4c5d-4e6f-8a7b-9c0d1e2f3a44',
            ticket: { ...SCAN_TICKET_VIP, category_color: 'VIOLET', checked_in_at: '2026-11-04T19:42:00.000Z', checked_in_gate: 'Porte VIP' },
            zone: ZONE_CARRE_VIP, gate: GATE_ACCES_CARRE,
        }),
        async ({ page }) => expectScanLines(page, 'accepte', ['Accès autorisé', 'Zone : Carré VIP', 'Entré à 19:42, Porte VIP']),
    ),
    {
        // 409 GATE_REQUIRED : incident technique (scan-client.ts, échec 'gate'), jamais un refus du billet
        id: 'scanner-porte-absente', titre: 'Scanner — aucune porte affectée (incident technique, rien n’est validé)', role: 'controleur', needsIds: true,
        path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: 'barcode-detector', initStorage: SCANNER_STORAGE, slowTimers: SCANNER_TIMERS,
        stubResponses: [{ url: SCAN_URL, method: 'POST', status: 409, body: { error: GATE_REQUIRED_MESSAGE, code: 'GATE_REQUIRED' } }],
        allowFailures: [SCAN_URL],
        ready: async ({ page }) => startScanner(page),
        actions: async (c) => {
            await presentToFakeDetector(c.page, demoPayload(c));
            await expectScanResult(c.page, 'server_error');
            await expectScanLines(c.page, 'technique', ['Aucune porte affectée', 'Demandez à l’organisateur de vous attribuer une porte. Rien n’a été validé.']);
        },
    },
    {
        id: 'scanner-liste-invites', titre: 'Scanner — liste des invités : recherche par les 4 derniers chiffres (réponse imposée)', role: 'controleur', needsIds: true,
        path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
        stubResponses: [{ url: GUESTS_URL, method: 'POST', status: 200, body: GUEST_SEARCH_STUB }],
        ready: async ({ page }) => startScanner(page),
        actions: async ({ page }) => searchGuestList(page),
    },
    {
        id: 'scanner-liste-invites-resultat', titre: 'Scanner — liste des invités : invité choisi, pièce d’identité à vérifier (rien n’est validé)', role: 'controleur', needsIds: true,
        path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
        stubResponses: [{ url: GUESTS_URL, method: 'POST', status: 200, body: GUEST_SEARCH_STUB }],
        ready: async ({ page }) => startScanner(page),
        actions: async ({ page }) => {
            await searchGuestList(page);
            await page.getByRole('button', { name: /^choisir/i }).click();
            await expect(page.getByText('Vérifiez la pièce d’identité', { exact: true }), 'bandeau de vérification de l’identité (C.3.5)').toBeVisible();
            const verified = page.getByRole('checkbox', { name: /^j.ai vérifié la pièce d.identité/i });
            await expect(verified, 'case décochée à chaque personne (C.3.5)').not.toBeChecked();
            // Jamais cliqué : la capture montre la confirmation, aucune entrée n'est validée
            const validate = page.getByRole('button', { name: /^valider l.entrée d.une personne$/i });
            await expect(validate, '« Valider » désactivé tant que la pièce n’est pas vérifiée (C.3.5)').toBeDisabled();
            await revealCenter(verified);
        },
    },
    {
        id: 'partenaire-zones', titre: 'Pilotage — Équipe : zones et portes de l’événement (éditeur)', role: 'organisateur', needsIds: true,
        path: zonesTeamPath,
        ready: async ({ page }) => { await revealCenter(await zonesEditorReady(page)); },
    },
    {
        id: 'partenaire-equipe-portes', titre: 'Pilotage — Équipe : porte d’un contrôleur et droit de changer de porte', role: 'organisateur', needsIds: true,
        path: zonesTeamPath,
        ready: async ({ page }) => { await zonesEditorReady(page); },
        actions: async ({ page }) => {
            const gate = page.getByLabel(/^porte(?: \(obligatoire\))?$/i).first();
            await expect(gate, 'champ « Porte » de la ligne du contrôleur (C.1.4)').toBeVisible();
            await expect(gate.locator('option:checked'), 'porte posée par la graine v4').toHaveText('Porte Nord — Entrée générale');
            const canChange = page.getByRole('switch', { name: /^peut changer de porte/i }).first();
            await expect(canChange, 'interrupteur « Peut changer de porte », fermé dans la graine v4').toHaveAttribute('aria-checked', 'false');
            await revealCenter(gate);
        },
    },
    // ── Lot 9 ter : pilotage et stock (D.3.1) ───────────────────────────────
    {
        id: 'pilotage-entrees-zones', titre: 'Pilotage — Entrées par zone et par porte, alerte de refus', role: 'organisateur', needsIds: true,
        path: (i) => `/partner/events/${seedEvent(i, 'zones').id}?tab=entrees`,
        stubResponses: [{ url: ENTRIES_URL, method: 'GET', status: 200, body: ENTRIES_ZONES_STUB }],
        ready: async ({ page }) => {
            const alert = page.getByText('Beaucoup de refus à Porte Sud', { exact: true });
            await expect(alert, 'alerte de refus de la porte Sud (D.1.4)').toBeVisible({ timeout: 30_000 });
            await expect(page.getByRole('heading', { name: 'Par zone', exact: true })).toBeVisible();
            await expect(page.getByRole('heading', { name: 'Validations par la liste des invités', exact: true })).toBeVisible();
            await revealCenter(alert);
        },
    },
    {
        id: 'accueil-dernieres-places', titre: 'Accueil — badge « Dernières places » d’un événement presque complet', role: 'anonyme', needsIds: true,
        path: () => '/',
        ready: async (c) => {
            const { title } = seedEvent(c.ids, 'dernieresPlaces');
            const card = c.page.locator('article').filter({ has: c.page.getByRole('heading', { name: title, exact: true }) }).first();
            await expect(card, `carte de « ${title} » à l’accueil`).toBeVisible({ timeout: 30_000 });
            await expect(card.getByText('Dernières places', { exact: true }), 'badge de stock bas (D.2.4)').toBeVisible();
            await revealCenter(card);
        },
    },
    // ── Lot 9 ter : versements, retraits retardés, clôture, édition (A.2.6, B.6) ──
    {
        id: 'admin-versements-constater-non-verse', titre: 'Administration — versements à reprendre : boîte « Constater non versé » (référence, motif ; réponses imposées)',
        role: 'fumee-superadmin', needsIds: false, path: () => '/admin/finance',
        stubResponses: CASHOUTS_STUBS,
        ready: async ({ page }) => { await cashoutsReady(page); },
        actions: async ({ page }) => {
            // Ligne incertaine sans identifiant SamirPay : seule ligne où can_mark_not_sent est vrai (A.2.3)
            const row = page.locator('tr, li, article').filter({ hasText: 'Festival Jazz sur le Fleuve' });
            await row.getByRole('button', { name: /^constater non versé/i }).filter({ visible: true }).first().click();
            const dialog = anyDialog(page, /^constater que ce versement n.est pas parti/i);
            await expect(dialog).toBeVisible();
            await expect(dialog.getByLabel(/^référence du support samirpay/i), 'référence du support, 100 caractères au plus (A.2.4)').toHaveAttribute('maxlength', '100');
            await expect(dialog.getByLabel(/^motif/i).first(), 'motif obligatoire (A.2.4)').toBeVisible();
            // Jamais confirmé : bouton désactivé tant que le motif et la référence manquent
            await expect(dialog.getByRole('button', { name: /^constater non versé$/i }), 'confirmation désactivée sans motif ni référence (A.2.4)').toBeDisabled();
        },
    },
    {
        id: 'partenaire-finances-retrait-retarde', titre: 'Partenaire — finances : retrait retardé (badge « Retardé » ; réponse imposée)', role: 'organisateur', needsIds: true,
        path: () => '/partner/finance',
        stubResponse: { url: /\/api\/finance\/balance\?account=ORGANISATEUR$/, status: 200, body: delayedWithdrawalBalance('ORGANISATEUR') },
        ready: async ({ page }) => delayedWithdrawalReady(page),
    },
    {
        id: 'portefeuille-retrait-retarde', titre: 'Portefeuille du client : retrait retardé (badge « Retardé » ; réponse imposée)', role: 'client', needsIds: true,
        path: () => '/wallet',
        stubResponse: { url: /\/api\/finance\/balance\?account=PARRAINAGE$/, status: 200, body: delayedWithdrawalBalance('PARRAINAGE') },
        ready: async ({ page }) => delayedWithdrawalReady(page),
    },
    {
        id: 'admin-cloture-motif', titre: 'Administration — clôture d’un événement suspendu : champ « Motif de la clôture » (fiche imposée, rien n’est envoyé)',
        role: 'fumee-superadmin', needsIds: true, path: (i) => `/admin/events/${ids(i).events.termine.id}`,
        stubResponses: [{ url: new RegExp(`/api/admin/events/${UUID}$`), method: 'GET', status: 200, body: CLOSING_SHEET }],
        ready: async ({ page }) => { await expectHeading(page, /^festival des lumières de saint-louis$/i); },
        actions: async ({ page }) => {
            await page.getByRole('button', { name: /^clore l.événement$/i }).click();
            const dialog = anyDialog(page);
            await expect(dialog).toBeVisible();
            await expect(dialog.getByLabel(/^motif de la clôture/i), 'libellé du motif à la clôture (0.9, B-D24)').toBeVisible();
        },
    },
    {
        id: 'edition-quitter-sans-enregistrer', titre: 'Édition d’un événement — quitter sans enregistrer (fenêtre de confirmation)', role: 'organisateur', needsIds: true,
        path: (i) => `/partner/events/${ids(i).events.publie.id}/edit`,
        actions: async ({ page }) => {
            await openTicketingStep(page);
            const quantity = page.getByLabel(/^quantité mise en vente/i).first();
            await expect(quantity, 'quantité d’une catégorie modifiable').toBeEditable();
            const current = Number(await quantity.inputValue());
            if (!Number.isInteger(current)) throw new Error(`[e2e] quantité mise en vente illisible : « ${await quantity.inputValue()} »`);
            await quantity.fill(String(current + 1)); // jamais enregistrée
            await page.getByRole('link', { name: /^retour à mes événements$/i }).click();
            const dialog = anyDialog(page, /^quitter sans enregistrer/i);
            await expect(dialog, 'garde avant de quitter avec des modifications (R93)').toBeVisible();
            await expect(dialog.getByRole('button', { name: /^rester sur la page$/i })).toBeVisible();
        },
    },
];
