/**
 * Appel de la voie unique de contrôle (/api/controller/scan) depuis les écrans de scan (scanner contrôleur
 * et scan partenaire) et lecture de la réponse HTTP.
 *
 * Règle du lot 4 : seul un résultat métier renvoyé en 200 ou en 409 est un
 * verdict sur le billet. 401 (session expirée), 403 (contrôle non autorisé), 429 (cadence), 4xx inattendu,
 * 5xx, délai dépassé, hors ligne et coupure réseau sont des incidents techniques : jamais présentés comme
 * un billet invalide, sans vibration ni compteur de refus.
 *
 * Lot 7 (7.2, D39, contrat 6.1 test 4) :
 *  - une clé `crypto.randomUUID()` par lecture, envoyée dans l'en-tête Idempotency-Key ; une relance garde
 *    la même clé (le serveur rend le verdict d'origine, sans nouvelle entrée) ;
 *  - délai maximal par essai (AbortController) de 4, 6 puis 8 s ; trois essais au plus ;
 *  - relance automatique sur coupure réseau, délai dépassé et 5xx seulement, jamais sur une réponse 4xx ;
 *    l'en-tête Retry-After d'une réponse 5xx est respecté ;
 *  - appareil hors ligne (navigator.onLine faux) : aucun envoi, incident technique « hors ligne ».
 * Lot 8 (8.2 e, contrat 3.5 et 7.1, L45) : un scan repris au retour dans l'application part avec `replayOnly`, sous la
 * forme { eventId, replayOnly: true } à chaque essai, sans code ni numéro de billet. Le serveur rend le verdict de la
 * ligne de cette clé, ou `not_processed` s'il n'y en a pas ; il ne composte jamais. Un scan repris ne fait donc jamais
 * entrer un spectateur qui n'est plus devant le contrôleur.
 * Aucun son (D52).
 */
import {
    isScanResult, isTechnicalScanResult, SCAN_RESULT_LABELS, scanCategoryOf,
    type ScanCategory, type ScanResult,
} from '@/lib/scan/scan-result';

export const SCAN_ENDPOINT = '/api/controller/scan';
export const SCAN_LOOKUP_ENDPOINT = '/api/controller/scan/lookup';
export const SCAN_INCIDENTS_ENDPOINT = '/api/controller/scan/incidents';

/** Délai maximal de chaque essai (ms) ; leur nombre fixe le nombre d'essais. */
export const SCAN_ATTEMPT_TIMEOUTS_MS: readonly number[] = [4000, 6000, 8000];
/** Pause avant une relance sans Retry-After (ms, multipliée par le numéro de l'essai). */
const RETRY_BASE_DELAY_MS = 250;
/** Retry-After plafonné : au-delà, le contrôleur voit l'incident plutôt qu'une attente muette. */
const RETRY_AFTER_MAX_MS = 10_000;

/** Données du billet renvoyées à un scanneur autorisé (jamais pour un refus de droit). */
export interface ScanTicketInfo {
    ticket_number?: string;
    category?: string;
    holder?: string;
    is_manual_entry?: boolean;
    checked_in_at?: string | null;
    /** Billet composté par le scanneur courant (already_used, D41). */
    checked_in_by_me?: boolean;
}

/** Incident technique ou de droit : la réponse ne dit rien du billet. */
export type ScanFailure = 'auth' | 'forbidden' | 'rate_limited' | 'server' | 'network' | 'timeout' | 'offline' | 'bad_request';

export interface ScanOutcome {
    result: ScanResult;
    message: string;
    /** Statut HTTP de la réponse, null en cas de coupure réseau, de délai dépassé ou hors ligne. */
    httpStatus: number | null;
    failure?: ScanFailure;
    scanId?: string;
    ticket?: ScanTicketInfo;
    code?: string;
    /** Verdict d'origine rendu pour une clé déjà traitée (D40). */
    replayed?: boolean;
    /** Nombre d'essais envoyés pour cette lecture (1 à 3 ; 0 hors ligne). */
    attempts?: number;
}

export type ScanRequest =
    | { eventId: string; payload: string }
    | { eventId: string; manualTicketNumber: string; identityVerified: boolean };

export interface SendOptions {
    /** Clé d'idempotence imposée (saisie manuelle : la clé de la vérification est reprise pour la validation). */
    key?: string;
    /** Appelé avant chaque essai (1, 2, 3) : l'écran affiche « nouvel essai automatique ». */
    onAttempt?: (attempt: number) => void;
    /** Scan repris (L45) : demande seulement le verdict d'une ligne existante, avec la clé d'origine dans `key`. */
    replayOnly?: boolean;
}

function text(v: unknown): string | undefined {
    return typeof v === 'string' && v.trim() !== '' ? v : undefined;
}

function ticketOf(v: unknown): ScanTicketInfo | undefined {
    if (!v || typeof v !== 'object') return undefined;
    const t = v as Record<string, unknown>;
    return {
        ticket_number: text(t.ticket_number),
        category: text(t.category),
        holder: text(t.holder),
        is_manual_entry: t.is_manual_entry === true,
        checked_in_at: text(t.checked_in_at) ?? null,
        checked_in_by_me: t.checked_in_by_me === true,
    };
}

/** Clé d'idempotence d'une lecture : UUID v4 (crypto.randomUUID, repli sur getRandomValues hors contexte sûr). */
export function newIdempotencyKey(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Interprète une réponse de POST /api/controller/scan. */
export async function readScanResponse(res: Response): Promise<ScanOutcome> {
    let body: Record<string, unknown> = {};
    try {
        body = (await res.json()) as Record<string, unknown>;
    } catch (err) {
        console.warn(`[scan] réponse HTTP ${res.status} illisible :`, err instanceof Error ? err.message : String(err));
    }
    const serverMessage = text(body.message) ?? text(body.error);

    if (res.status === 401) {
        return { result: 'server_error', failure: 'auth', httpStatus: 401, message: 'Session expirée : reconnectez-vous pour continuer le contrôle.' };
    }
    if (res.status === 403) {
        return {
            result: 'server_error', failure: 'forbidden', httpStatus: 403, code: text(body.code),
            message: serverMessage ?? 'Vous n’êtes pas autorisé à contrôler cet événement.',
        };
    }
    if (res.status === 429) {
        return { result: 'rate_limited', failure: 'rate_limited', httpStatus: 429, message: serverMessage ?? SCAN_RESULT_LABELS.rate_limited };
    }
    if (res.status >= 500) {
        return { result: 'server_error', failure: 'server', httpStatus: res.status, message: serverMessage ?? SCAN_RESULT_LABELS.server_error };
    }
    if ((res.status === 200 || res.status === 409) && isScanResult(body.result)) {
        return {
            result: body.result,
            httpStatus: res.status,
            message: serverMessage ?? SCAN_RESULT_LABELS[body.result],
            scanId: text(body.scan_id),
            ticket: ticketOf(body.ticket),
            code: text(body.code),
            replayed: body.replayed === true,
        };
    }
    // 400 ou réponse hors contrat : incident technique, jamais un verdict sur le billet
    console.warn(`[scan] réponse inattendue HTTP ${res.status} :`, JSON.stringify(body).slice(0, 200));
    return {
        result: 'server_error', failure: res.status === 400 ? 'bad_request' : 'server', httpStatus: res.status,
        message: serverMessage ?? SCAN_RESULT_LABELS.server_error,
    };
}

/** Délai Retry-After en millisecondes (secondes ou date HTTP) ; null s'il est absent ou illisible. */
function retryAfterMs(res: Response): number | null {
    const raw = res.headers.get('retry-after');
    if (!raw) return null;
    const seconds = Number(raw.trim());
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, RETRY_AFTER_MAX_MS);
    const at = Date.parse(raw);
    if (Number.isFinite(at)) return Math.min(Math.max(0, at - Date.now()), RETRY_AFTER_MAX_MS);
    console.warn(`[scan] en-tête Retry-After illisible : « ${raw.slice(0, 40)} »`);
    return null;
}

function wait(ms: number): Promise<void> {
    return new Promise((resolve) => { setTimeout(resolve, ms); });
}

function isOffline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine === false;
}

const OFFLINE_OUTCOME: ScanOutcome = {
    result: 'network_error', failure: 'offline', httpStatus: null, attempts: 0,
    message: 'Hors ligne : rien n’est validé. Faites patienter le spectateur et reprenez au retour du réseau.',
};

/**
 * Envoi avec délai maximal par essai et relances (même clé). Réseau, délai et 5xx : relance ;
 * toute autre réponse : rendue telle quelle.
 */
async function sendWithRetry(body: Record<string, unknown>, key: string, opts: SendOptions = {}): Promise<ScanOutcome> {
    if (isOffline()) return { ...OFFLINE_OUTCOME };
    let last: ScanOutcome | null = null;
    for (let i = 0; i < SCAN_ATTEMPT_TIMEOUTS_MS.length; i++) {
        const attempt = i + 1;
        if (i > 0 && isOffline()) return { ...OFFLINE_OUTCOME, attempts: i };
        opts.onAttempt?.(attempt);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), SCAN_ATTEMPT_TIMEOUTS_MS[i]);
        let pause = RETRY_BASE_DELAY_MS * attempt;
        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Idempotency-Key': key };
            const res = await fetch(SCAN_ENDPOINT, { method: 'POST', headers, body: JSON.stringify(body), cache: 'no-store', signal: controller.signal });
            const outcome = { ...(await readScanResponse(res)), attempts: attempt };
            if (res.status < 500) return outcome;
            last = outcome;
            const after = retryAfterMs(res);
            if (after !== null) pause = Math.max(pause, after);
            console.warn(`[scan] POST ${SCAN_ENDPOINT} : HTTP ${res.status} à l'essai ${attempt}${attempt < SCAN_ATTEMPT_TIMEOUTS_MS.length ? ', nouvel essai avec la même clé' : ''}`);
        } catch (err) {
            const timedOut = controller.signal.aborted;
            console.warn(`[scan] POST ${SCAN_ENDPOINT} : ${timedOut ? `délai de ${SCAN_ATTEMPT_TIMEOUTS_MS[i]} ms dépassé` : 'réseau indisponible'} à l'essai ${attempt}`,
                err instanceof Error ? err.message : String(err));
            last = timedOut
                ? { result: 'network_error', failure: 'timeout', httpStatus: null, attempts: attempt, message: 'Réseau trop lent : résultat inconnu. Scannez de nouveau le même billet.' }
                : { result: 'network_error', failure: 'network', httpStatus: null, attempts: attempt, message: SCAN_RESULT_LABELS.network_error };
        } finally {
            clearTimeout(timer);
        }
        if (attempt < SCAN_ATTEMPT_TIMEOUTS_MS.length) await wait(pause);
    }
    return last ?? { result: 'network_error', failure: 'network', httpStatus: null, message: SCAN_RESULT_LABELS.network_error };
}

/**
 * Scan caméra ({ eventId, payload }) ou saisie manuelle ({ eventId, manualTicketNumber, identityVerified }).
 * Une clé neuve par appel, sauf `opts.key` (validation d'une saisie manuelle vérifiée, scan repris).
 * `opts.replayOnly` : le corps ne porte plus que l'événement et l'indicateur (L45), relances comprises.
 */
export function postScan(request: ScanRequest, opts: SendOptions = {}): Promise<ScanOutcome> {
    const body: Record<string, unknown> = opts.replayOnly === true ? { eventId: request.eventId, replayOnly: true } : request;
    return sendWithRetry(body, opts.key ?? newIdempotencyKey(), opts);
}

// ── Saisie manuelle, premier temps (D43) ───────────────────────────────────

export interface ManualLookupTicket {
    ticket_number: string;
    holder: string;
    category: string;
    status_label: string;
    preview: ScanResult;
    preview_label: string;
}

export type ManualLookup =
    | { kind: 'found'; ticket: ManualLookupTicket }
    | { kind: 'not_found' }
    | { kind: 'refused'; httpStatus: number | null; message: string };

/** Vérification d'un numéro de billet (lecture seule, aucune entrée) : titulaire et résultat prévu. */
export async function lookupManualTicket(eventId: string, manualTicketNumber: string): Promise<ManualLookup> {
    if (isOffline()) return { kind: 'refused', httpStatus: null, message: 'Hors ligne : la vérification reprendra au retour du réseau.' };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SCAN_ATTEMPT_TIMEOUTS_MS[SCAN_ATTEMPT_TIMEOUTS_MS.length - 1]);
    try {
        const res = await fetch(SCAN_LOOKUP_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId, manualTicketNumber }),
            cache: 'no-store',
            signal: controller.signal,
        });
        let body: Record<string, unknown> = {};
        try {
            body = (await res.json()) as Record<string, unknown>;
        } catch (err) {
            console.warn(`[scan] vérification : réponse HTTP ${res.status} illisible`, err instanceof Error ? err.message : String(err));
        }
        if (res.status === 200 && body.found === false) return { kind: 'not_found' };
        const t = body.ticket as Record<string, unknown> | undefined;
        if (res.status === 200 && body.found === true && t && isScanResult(t.preview)) {
            return {
                kind: 'found',
                ticket: {
                    ticket_number: String(t.ticket_number ?? ''),
                    holder: String(t.holder ?? ''),
                    category: String(t.category ?? ''),
                    status_label: String(t.status_label ?? ''),
                    preview: t.preview,
                    preview_label: text(t.preview_label) ?? SCAN_RESULT_LABELS[t.preview],
                },
            };
        }
        if (res.status === 401) return { kind: 'refused', httpStatus: 401, message: 'Session expirée : reconnectez-vous pour continuer le contrôle.' };
        if (res.status === 403) return { kind: 'refused', httpStatus: 403, message: text(body.error) ?? 'Vous n’êtes pas autorisé à vérifier un billet de cet événement.' };
        if (res.status === 429) return { kind: 'refused', httpStatus: 429, message: text(body.error) ?? 'Trop de vérifications : patientez quelques secondes.' };
        console.warn(`[scan] vérification : réponse inattendue HTTP ${res.status}`, JSON.stringify(body).slice(0, 200));
        return { kind: 'refused', httpStatus: res.status, message: text(body.error) ?? 'Vérification momentanément impossible : réessayez.' };
    } catch (err) {
        const timedOut = controller.signal.aborted;
        console.warn(`[scan] vérification : ${timedOut ? 'délai dépassé' : 'réseau indisponible'}`, err instanceof Error ? err.message : String(err));
        return { kind: 'refused', httpStatus: null, message: timedOut ? 'Réseau trop lent : réessayez la vérification.' : 'Réseau indisponible : réessayez la vérification.' };
    } finally {
        clearTimeout(timer);
    }
}

// ── Classement des résultats (affichage, vibration, compteurs) ─────────────

/** Incident technique ou de droit : ni vibration, ni compteur de refus, jamais « billet invalide ». */
export function isTechnicalOutcome(outcome: ScanOutcome): boolean {
    return outcome.failure !== undefined || isTechnicalScanResult(outcome.result);
}

/**
 * Heure de la ligne « Résultat retrouvé » d'un scan repris : null quand le renvoi n'a rendu aucun verdict sur le billet
 * (`not_processed`, contrat 7.1 ; panne, cadence ou droit refusé) : il n'y a alors rien de retrouvé à annoncer.
 */
export function recoveredTimeOf(outcome: ScanOutcome, recoveredAt: number | null): number | null {
    return isTechnicalOutcome(outcome) ? null : recoveredAt;
}

/** Catégorie du résultat plein écran (contrat 6.2) ; tout incident est « technique ». */
export function categoryFor(outcome: ScanOutcome): ScanCategory {
    return isTechnicalOutcome(outcome) ? 'technique' : scanCategoryOf(outcome.result);
}

const TICKET_REFUSALS: ReadonlySet<ScanResult> = new Set<ScanResult>([
    'already_used', 'invalid', 'cancelled', 'refunded', 'wrong_event', 'qr_expired', 'dynamic_qr_required', 'payment_required',
]);

/**
 * Refus du billet présenté. Exclus : les incidents techniques (rate_limited, server_error, network_error,
 * 401, 403), les états de l'événement (event_*) et la saisie manuelle refusée (droit du scanneur).
 */
export function isTicketRefusal(outcome: ScanOutcome): boolean {
    return !isTechnicalOutcome(outcome) && TICKET_REFUSALS.has(outcome.result);
}

export type ScanTone = 'success' | 'danger' | 'warning' | 'neutral';

export function toneFor(outcome: ScanOutcome): ScanTone {
    switch (categoryFor(outcome)) {
        case 'accepte':
            return 'success';
        case 'deja_utilise':
        case 'refuse':
        case 'evenement_annule':
            return 'danger';
        case 'hors_fenetre':
            return 'warning';
        default:
            return 'neutral';
    }
}

/** Titre court du résultat (le libellé du contrat, ou l'incident technique). */
export function titleFor(outcome: ScanOutcome): string {
    switch (outcome.failure) {
        case 'auth':
            return 'Session expirée';
        case 'forbidden':
            // Lot 9 bis (R107) : 403 du scan, le plus souvent une affectation retirée ; le scanner relit ses affectations
            return 'Vous ne contrôlez plus cet événement';
        case 'bad_request':
            return 'Requête refusée par le serveur';
        case 'offline':
            return 'Hors ligne : rien n’est validé';
        // Lot 9 bis (R100) : après un délai ou une coupure, le billet a pu être composté ; seul le hors-ligne (aucun envoi)
        // garantit qu'aucune entrée n'a été faite
        case 'timeout':
        case 'network':
            return 'Résultat inconnu : scannez de nouveau';
        default:
            return SCAN_RESULT_LABELS[outcome.result];
    }
}

/** Montants : format partagé de lib/format (« 5 000 F CFA »), réexporté pour les écrans de scan. */
export { formatFcfa } from '@/lib/format';
