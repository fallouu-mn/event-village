/**
 * Lot 4 — appel de la voie unique de contrôle (/api/controller/scan) depuis les écrans de scan
 * (scanner contrôleur et scan partenaire) et lecture de la réponse HTTP.
 *
 * Règle : seul un résultat métier renvoyé en 200 (ou 409 pour un refus d'encaissement) est un
 * verdict sur le billet. 401 (session expirée), 403 (contrôle non autorisé), 429 (cadence), 4xx
 * inattendu, 5xx et coupure réseau sont des incidents techniques : jamais présentés comme un billet
 * invalide, sans voix ni compteur de refus.
 */
import type { CombatFeedbackType } from '@/lib/hardware/feedback';
import type { WolofAudioType } from '@/lib/hardware/wolof-audio';
import { isScanResult, isTechnicalScanResult, SCAN_RESULT_LABELS, type ScanResult } from '@/lib/scan/scan-result';

export const SCAN_ENDPOINT = '/api/controller/scan';

/** Données du billet renvoyées à un scanneur autorisé (jamais pour un refus de droit). */
export interface ScanTicketInfo {
    ticket_number?: string;
    category?: string;
    holder?: string;
    is_manual_entry?: boolean;
    checked_in_at?: string | null;
}

/** Incident technique ou de droit : la réponse ne dit rien du billet. */
export type ScanFailure = 'auth' | 'forbidden' | 'rate_limited' | 'server' | 'network' | 'bad_request';

export interface ScanOutcome {
    result: ScanResult;
    message: string;
    /** Statut HTTP de la réponse, null en cas de coupure réseau. */
    httpStatus: number | null;
    failure?: ScanFailure;
    scanId?: string;
    ticket?: ScanTicketInfo;
    /** Montant à encaisser (cash_required). */
    amountDue?: number;
    /** Montant encaissé (encaissement confirmé). */
    amount?: number;
    code?: string;
}

export type ScanRequest =
    | { eventId: string; payload: string }
    | { eventId: string; manualTicketNumber: string; identityVerified: boolean };

function text(v: unknown): string | undefined {
    return typeof v === 'string' && v.trim() !== '' ? v : undefined;
}

function amountOf(v: unknown): number | undefined {
    if (v === null || v === undefined || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
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
    };
}

/** Interprète une réponse de /api/controller/scan (POST ou PUT). */
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
            amountDue: amountOf(body.amount_due),
            amount: amountOf(body.amount),
            code: text(body.code),
        };
    }
    // 400 ou réponse hors contrat : incident technique, jamais un verdict sur le billet
    console.warn(`[scan] réponse inattendue HTTP ${res.status} :`, JSON.stringify(body).slice(0, 200));
    return {
        result: 'server_error', failure: res.status === 400 ? 'bad_request' : 'server', httpStatus: res.status,
        message: serverMessage ?? SCAN_RESULT_LABELS.server_error,
    };
}

async function send(method: 'POST' | 'PUT', body: Record<string, unknown>): Promise<ScanOutcome> {
    let res: Response;
    try {
        res = await fetch(SCAN_ENDPOINT, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            cache: 'no-store',
        });
    } catch (err) {
        console.warn(`[scan] ${method} ${SCAN_ENDPOINT} : réseau indisponible`, err instanceof Error ? err.message : String(err));
        return { result: 'network_error', failure: 'network', httpStatus: null, message: SCAN_RESULT_LABELS.network_error };
    }
    return readScanResponse(res);
}

/** Scan caméra ({ eventId, payload }) ou saisie manuelle ({ eventId, manualTicketNumber, identityVerified }). */
export function postScan(request: ScanRequest): Promise<ScanOutcome> {
    return send('POST', request);
}

/** Encaissement espèces d'un scan cash_required puis compostage (tout ou rien côté serveur). */
export function confirmCashCheckin(scanId: string, eventId: string): Promise<ScanOutcome> {
    return send('PUT', { scanId, eventId });
}

// ── Classement des résultats (affichage, voix, compteurs) ──────────────────

/** Incident technique ou de droit : ni voix, ni compteur de refus, jamais « billet invalide ». */
export function isTechnicalOutcome(outcome: ScanOutcome): boolean {
    return outcome.failure !== undefined || isTechnicalScanResult(outcome.result);
}

const TICKET_REFUSALS: ReadonlySet<ScanResult> = new Set<ScanResult>([
    'already_used', 'invalid', 'cancelled', 'refunded', 'wrong_event', 'qr_expired', 'dynamic_qr_required', 'payment_required',
]);

/**
 * Refus du billet présenté, compté dans « billets refusés ». Exclus : les incidents techniques
 * (rate_limited, server_error, network_error, 401, 403), les états de l'événement (event_*), la
 * saisie manuelle refusée (droit du scanneur) et l'encaissement en attente.
 */
export function isTicketRefusal(outcome: ScanOutcome): boolean {
    return !isTechnicalOutcome(outcome) && TICKET_REFUSALS.has(outcome.result);
}

/** Flash plein écran et retour sensoriel. */
export function combatTypeFor(outcome: ScanOutcome): CombatFeedbackType {
    if (isTechnicalOutcome(outcome)) return 'network_error';
    switch (outcome.result) {
        case 'valid':
            return 'valid';
        case 'already_used':
            return 'already_used';
        case 'invalid':
        case 'cancelled':
        case 'refunded':
            return 'invalid';
        case 'wrong_event':
            return 'wrong_event';
        case 'qr_expired':
            return 'qr_expired';
        case 'cash_required':
            return 'cash_required';
        default:
            return 'alert';
    }
}

/** Voix wolof adressée au spectateur : seulement pour un refus de son billet. */
export function wolofTypeFor(outcome: ScanOutcome): WolofAudioType | null {
    if (isTechnicalOutcome(outcome)) return null;
    switch (outcome.result) {
        case 'already_used':
            return 'ALREADY_USED';
        case 'invalid':
        case 'cancelled':
        case 'refunded':
            return 'INVALID';
        case 'wrong_event':
            return 'WRONG_EVENT';
        default:
            return null;
    }
}

export type ScanTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

export function toneFor(outcome: ScanOutcome): ScanTone {
    if (isTechnicalOutcome(outcome)) return 'neutral';
    switch (outcome.result) {
        case 'valid':
            return 'success';
        case 'cash_required':
            return 'info';
        case 'already_used':
        case 'invalid':
        case 'cancelled':
        case 'refunded':
        case 'wrong_event':
            return 'danger';
        default:
            return 'warning';
    }
}

/** Titre court du résultat (le libellé du contrat, ou l'incident technique). */
export function titleFor(outcome: ScanOutcome): string {
    switch (outcome.failure) {
        case 'auth':
            return 'Session expirée';
        case 'forbidden':
            return 'Contrôle non autorisé';
        case 'bad_request':
            return 'Requête refusée par le serveur';
        default:
            return SCAN_RESULT_LABELS[outcome.result];
    }
}

/** Montants : format partagé de lib/format (« 5 000 F CFA »), réexporté pour les écrans de scan. */
export { formatFcfa } from '@/lib/format';
