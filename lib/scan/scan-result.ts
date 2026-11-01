/**
 * Lot 4.9 — résultat d'un scan, type unique partagé par l'API (/api/controller/scan) et les écrans de
 * scan (contrôleur et partenaire). Les résultats « métier » viennent du serveur (HTTP 200) ; les
 * erreurs techniques (401, 403, 429, 5xx, réseau) ont leurs propres valeurs et ne sont jamais
 * présentées comme un billet invalide : ni voix, ni compteur de refus.
 */

export const SCAN_RESULTS = [
    'valid',
    'already_used',
    'invalid',
    'cancelled',
    'refunded',
    'wrong_event',
    'event_cancelled',
    'event_ended',
    'event_suspended',
    'event_not_open',
    'payment_required',
    'cash_required',
    'qr_expired',
    'dynamic_qr_required',
    'manual_entry_refused',
    'rate_limited',
    'network_error',
    'server_error',
] as const;

export type ScanResult = (typeof SCAN_RESULTS)[number];

/** Résultats techniques : jamais un verdict sur le billet. */
export const TECHNICAL_SCAN_RESULTS: readonly ScanResult[] = ['rate_limited', 'network_error', 'server_error'];

export function isScanResult(value: unknown): value is ScanResult {
    return typeof value === 'string' && (SCAN_RESULTS as readonly string[]).includes(value);
}

export function isTechnicalScanResult(result: ScanResult): boolean {
    return TECHNICAL_SCAN_RESULTS.includes(result);
}

/** Libellé affiché à l'écran pour chaque résultat (aucune donnée de billet). */
export const SCAN_RESULT_LABELS: Record<ScanResult, string> = {
    valid: 'Entrée validée',
    already_used: 'Billet déjà utilisé',
    invalid: 'Billet invalide',
    cancelled: 'Billet annulé',
    refunded: 'Billet remboursé',
    wrong_event: 'Billet d’un autre événement',
    event_cancelled: 'Événement annulé',
    event_ended: 'Événement terminé',
    event_suspended: 'Événement suspendu',
    event_not_open: 'Contrôle pas encore ouvert',
    payment_required: 'Paiement requis',
    cash_required: 'Encaissement requis',
    qr_expired: 'QR expiré : demandez au client de rafraîchir son billet',
    dynamic_qr_required: 'QR dynamique requis (billet ouvert dans l’application)',
    manual_entry_refused: 'Saisie manuelle refusée',
    rate_limited: 'Trop de scans : patientez quelques secondes',
    network_error: 'Erreur réseau : réessayez',
    server_error: 'Erreur serveur : réessayez',
};

// ── Lot 5 (contrat B) — refus « forbidden » et méthodes de scan ────────────

/**
 * Motif d'une tentative refusée parce que le scanneur n'est pas autorisé sur l'événement (403 du lot 4).
 * Ce n'est pas un résultat renvoyé au scanneur (ScanResult reste l'union du contrat du lot 4) : il
 * n'apparaît que dans le journal et le pilotage (refus par motif).
 */
export const FORBIDDEN_SCAN_REASON = 'forbidden' as const;
export type ScanRefusalReason = ScanResult | typeof FORBIDDEN_SCAN_REASON;

/**
 * Libellés des motifs du journal des scans (pilotage, onglet Entrées), forbidden compris. Miroir de la
 * fonction SQL public.pilotage_scan_result_label (supabase/migrations/20261102000005_lot5_pilotage.sql).
 */
export const SCAN_REFUSAL_LABELS: Record<ScanRefusalReason, string> = {
    ...SCAN_RESULT_LABELS,
    forbidden: 'Scanneur non autorisé sur cet événement',
};

/** Libellé d'un résultat ou d'un motif du journal ; valeur inconnue → « Autre refus », jamais l'enum brut. */
export function scanReasonLabel(reason: unknown): string {
    return typeof reason === 'string' && Object.prototype.hasOwnProperty.call(SCAN_REFUSAL_LABELS, reason)
        ? SCAN_REFUSAL_LABELS[reason as ScanRefusalReason]
        : 'Autre refus';
}

/** Méthodes de `ticket_scans.method` : caméra, numéro saisi, vente au guichet (contrat C7). */
export const SCAN_METHODS = ['QR', 'MANUAL', 'COUNTER'] as const;
export type ScanMethod = (typeof SCAN_METHODS)[number];

export const SCAN_METHOD_LABELS: Record<ScanMethod, string> = {
    QR: 'QR',
    MANUAL: 'Saisie manuelle',
    COUNTER: 'Guichet',
};

export function isScanMethod(value: unknown): value is ScanMethod {
    return typeof value === 'string' && (SCAN_METHODS as readonly string[]).includes(value);
}

/** Libellé d'une méthode de scan ; valeur inconnue → « Autre méthode ». */
export function scanMethodLabel(method: unknown): string {
    return isScanMethod(method) ? SCAN_METHOD_LABELS[method] : 'Autre méthode';
}
