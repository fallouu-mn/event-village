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
    // Lot 9 ter (9t.15, 9t.16) : verdicts de zone (ticket_scans.zone_result, jamais result) : mauvaise zone et pas encore
    // entré (orange : la personne est orientée, rien composté), accès autorisé à un contrôle de zone (vert, rien composté)
    'wrong_zone',
    'not_entered',
    'zone_ok',
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
    qr_expired: 'QR expiré : demandez au client d’ouvrir son billet dans l’application',
    dynamic_qr_required: 'QR dynamique requis (billet ouvert dans l’application)',
    manual_entry_refused: 'Saisie manuelle refusée',
    transfer_pending: 'Transfert en cours',
    wrong_zone: 'Mauvaise zone',
    not_entered: 'Pas encore entré',
    zone_ok: 'Accès autorisé',
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
export type ScanCategory = 'accepte' | 'deja_utilise' | 'refuse' | 'hors_fenetre' | 'evenement_annule' | 'technique' | 'oriente';

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
    // Lot 9 ter (9t.16, arbitrage 19) : orange, la personne est orientée vers une autre zone ; contrôle de zone réussi : vert
    wrong_zone: 'oriente',
    not_entered: 'oriente',
    zone_ok: 'accepte',
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

// ── Lot 9 ter (9t.15, contrat C.2.3, 11.3) — zones et portes ──────────────

/** Types de zone (event_zones.kind) et leurs libellés d'écran. */
export const ZONE_KIND_LABELS = { ENTREE: 'Entrée', CONTROLE: 'Contrôle de zone' } as const;
export type ZoneKind = keyof typeof ZONE_KIND_LABELS;

/** Problèmes de porte (409, jamais un verdict sur le billet : rien n'est écrit) et leurs textes exacts (contrat 11.3). */
export const GATE_PROBLEM_MESSAGES = {
    GATE_REQUIRED: 'Aucune porte ne vous est attribuée : demandez à l’organisateur de vous en attribuer une. Rien n’a été validé.',
    GATE_CHANGED: 'Votre porte a changé : le contrôle reprend avec votre nouvelle porte. Scannez de nouveau.',
    GATE_INVALID: 'Porte inconnue : choisissez une porte de cet événement.',
} as const;
export type GateProblemCode = keyof typeof GATE_PROBLEM_MESSAGES;

export function isGateProblemCode(value: unknown): value is GateProblemCode {
    return typeof value === 'string' && Object.prototype.hasOwnProperty.call(GATE_PROBLEM_MESSAGES, value);
}

/** Même motif que le point d'entrée nommé de GET /api/controller/scans (« Porte », « Portail », « Entrée », « Accès », « Guichet »). */
const NAMED_GATE = /^(porte|portail|entr[ée]e|acc[èe]s|guichet)\b/i;

/**
 * Porte dans une phrase (« Déjà utilisé à 21:14, porte Nord ») : un nom qui se nomme déjà (« Porte Nord », « Entrée VIP »)
 * est gardé tel quel, sinon « porte {nom} ».
 */
export function gatePhrase(name: string): string {
    const value = name.trim();
    return NAMED_GATE.test(value) ? value : `porte ${value}`;
}

// ── Lot 9 ter (9t.16, contrat C.2.3, X2, arbitrage 19) — couleur de la catégorie au scanner ──

/**
 * Palette fermée des couleurs de catégorie (seule liste du lot, X2) : mêmes clés, dans le même ordre, que la contrainte
 * ticket_categories_scan_color_check (supabase/migrations/20261110000009_lot9ter_zones.sql). Jamais rouge, vert ni
 * orange (confusion avec le verdict) ; jetons --scan-cat-<clé>-bg / -fg d'app/globals.css.
 */
export const SCAN_CATEGORY_COLORS = ['BLANC', 'OR', 'ARGENT', 'ROSE', 'TURQUOISE', 'BLEU', 'VIOLET', 'NOIR'] as const;
export type ScanCategoryColor = (typeof SCAN_CATEGORY_COLORS)[number];

export const SCAN_CATEGORY_COLOR_LABELS: Record<ScanCategoryColor, string> = {
    BLANC: 'Blanc',
    OR: 'Or',
    ARGENT: 'Argent',
    ROSE: 'Rose',
    TURQUOISE: 'Turquoise',
    BLEU: 'Bleu nuit',
    VIOLET: 'Violet',
    NOIR: 'Noir',
};

export function isScanCategoryColor(value: unknown): value is ScanCategoryColor {
    return typeof value === 'string' && (SCAN_CATEGORY_COLORS as readonly string[]).includes(value);
}
