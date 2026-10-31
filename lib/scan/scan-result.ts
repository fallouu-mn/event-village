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
