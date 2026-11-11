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
    'qr_expired',
    'dynamic_qr_required',
    'manual_entry_refused',
    // Lot 9 bis (R19, B52) : billet engagé dans un transfert en attente, refusé à l'entrée (rien de composté)
    'transfer_pending',
    'rate_limited',
    'network_error',
    'server_error',
    // Lot 8 (8.2 e, L42) : renvoi d'une lecture sans ligne en base. Rendu par ticket_scan, jamais écrit dans ticket_scans
    'not_processed',
] as const;

export type ScanResult = (typeof SCAN_RESULTS)[number];

/** Résultats techniques : jamais un verdict sur le billet. */
export const TECHNICAL_SCAN_RESULTS: readonly ScanResult[] = ['rate_limited', 'network_error', 'server_error', 'not_processed'];

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
    qr_expired: 'QR expiré : demandez au client de rafraîchir son billet',
    dynamic_qr_required: 'QR dynamique requis (billet ouvert dans l’application)',
    manual_entry_refused: 'Saisie manuelle refusée',
    transfer_pending: 'Transfert en cours',
    rate_limited: 'Trop de scans : patientez quelques secondes',
    network_error: 'Erreur réseau : réessayez',
    server_error: 'Erreur serveur : réessayez',
    not_processed: 'Scan non traité : scannez le billet de nouveau',
};

/**
 * Texte affiché sous le titre de `not_processed`. Le titre donne déjà la consigne ; la phrase complète de l'API la redisait
 * (trois fois avec la ligne « réessayez », relecture du run 98). Le message de la réponse (contrat 3.5) ne change pas.
 */
export const NOT_PROCESSED_DETAIL = 'Aucune entrée enregistrée.';

/** Lot 9 bis (R19, contrat 5.23) : texte affiché sous le titre « Transfert en cours ». */
export const TRANSFER_PENDING_DETAIL = 'Billet en cours de transfert : il doit être accepté ou le transfert annulé avant l’entrée.';

// ── Lot 7 (7.2, contrat 6.2) — catégories du résultat plein écran ─────────

/**
 * Catégorie d'affichage d'un résultat : fond plein écran (jetons --scan-*), titre et vibration (D50).
 * Un incident technique (« technique ») n'est jamais un verdict sur le billet : écran neutre, aucune
 * vibration, jamais compté comme refus (D47).
 */
export type ScanCategory = 'accepte' | 'deja_utilise' | 'refuse' | 'hors_fenetre' | 'evenement_annule' | 'technique';

export const SCAN_RESULT_CATEGORY: Record<ScanResult, ScanCategory> = {
    valid: 'accepte',
    already_used: 'deja_utilise',
    invalid: 'refuse',
    cancelled: 'refuse',
    refunded: 'refuse',
    wrong_event: 'refuse',
    dynamic_qr_required: 'refuse',
    manual_entry_refused: 'refuse',
    transfer_pending: 'refuse',
    payment_required: 'refuse',
    qr_expired: 'refuse',
    event_not_open: 'hors_fenetre',
    event_ended: 'hors_fenetre',
    event_cancelled: 'evenement_annule',
    event_suspended: 'evenement_annule',
    rate_limited: 'technique',
    network_error: 'technique',
    server_error: 'technique',
    not_processed: 'technique',
};

export function scanCategoryOf(result: ScanResult): ScanCategory {
    return SCAN_RESULT_CATEGORY[result];
}

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
