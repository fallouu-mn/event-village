/**
 * Finition 3b (E-35) — catalogue des réglages de la plateforme, lu par l'écran (/admin/finance-settings) et par la route
 * (refus en français). Module pur (sans `next/server`), lisible par un composant client.
 *
 *  - SETTING_SECTIONS : thèmes de la page, dans l'ordre, avec leur ancre (sommaire).
 *  - SETTING_BOUNDS : bornes des réglages numériques, IDENTIQUES à la base (fin_setting_valid, migration 20261117000002) ;
 *    tests/parcours/f3b-reglages.test.ts compare chaque borne à la base et refuse un réglage numérique oublié. La base
 *    reste la seule garde : l'écran vérifie seulement avant l'envoi, pour dire l'erreur sous le champ.
 *  - settingRisk : alerte sur une valeur admise mais risquée (revue d'ergonomie, section 5.6), sans bloquer.
 */

export const SETTING_SECTIONS: ReadonlyArray<{ prefix: string; anchor: string; title: string }> = [
    { prefix: 'finance.', anchor: 'finance', title: 'Finance' },
    { prefix: 'access.', anchor: 'controle', title: 'Contrôle d’accès' },
    { prefix: 'support.', anchor: 'support', title: 'Contact du support' },
    { prefix: 'notif.', anchor: 'notifications', title: 'Notifications et SMS' },
    { prefix: 'features.', anchor: 'services', title: 'Services en préparation' },
    // Lot 10a : réservation de salles (prix, acompte, délais, annulation, validation)
    { prefix: 'halls.', anchor: 'salles', title: 'Salles de fête' },
    // Lot 11a : réservation de tables (frais, créneau, attentes, absence, annulation, validation)
    { prefix: 'tables.', anchor: 'tables', title: 'Restaurants et tables' },
];

export interface SettingBounds {
    min: number;
    max: number;
    /** Nombre entier attendu. */
    integer: boolean;
    /** Plus petit écart entre deux valeurs (sert au contrôle « juste en dehors » des tests). */
    step: number;
    /** Libellé de l'écran (identique à celui de la page, vérifié par tests/schema/f3b-ecrans.test.ts). */
    label: string;
    /** Unité affichée après la valeur. */
    unit?: string;
}

const int = (min: number, max: number, label: string, unit?: string): SettingBounds => ({ min, max, integer: true, step: 1, label, unit });
const rate = (min: number, max: number, label: string): SettingBounds => ({ min, max, integer: false, step: 0.01, label, unit: '%' });

export const SETTING_BOUNDS: Readonly<Record<string, SettingBounds>> = {
    'finance.service_fee_rate': rate(0, 50, 'Frais de service'),
    'finance.aggregator_fee_rate.WAVE': rate(0, 10, 'Frais agrégateur Wave'),
    'finance.aggregator_fee_rate.ORANGE_MONEY': rate(0, 10, 'Frais agrégateur Orange Money'),
    'finance.payout_delay_hours': int(0, 720, 'Délai après la fin de l’événement', 'h'),
    'finance.withdrawal_fee_rate': rate(0, 10, 'Frais de retrait'),
    'finance.withdrawal_min_amount': int(0, 10_000_000, 'Montant minimum de retrait', 'F CFA'),
    'finance.referral_availability_days': int(7, 14, 'Délai de validation des commissions', 'jours'),
    'finance.payment_hold_minutes': int(5, 60, 'Durée de garde des places pendant un paiement (minutes)', 'min'),
    'finance.min_paid_price': int(1, 100_000, 'Prix minimum d’un billet payant (F CFA)', 'F CFA'),
    'finance.safety_reserve_amount': int(0, 1_000_000_000, 'Montant fixe de la réserve de prudence', 'F CFA'),
    'access.scan_window_before_hours': int(0, 48, 'Ouverture du contrôle avant le début', 'h'),
    'access.scan_window_after_hours': int(0, 48, 'Fermeture du contrôle après la fin', 'h'),
    'access.low_stock_threshold': int(1, 1000, 'Seuil « bientôt complet »', 'places'),
    'access.refusal_alert_threshold': int(3, 500, 'Alerte de refus à une porte : nombre de refus', 'refus'),
    'access.refusal_alert_minutes': int(1, 60, 'Alerte de refus à une porte : durée observée', 'min'),
    'notif.reminder_j1_hour': int(6, 20, 'Heure du rappel de la veille', 'h'),
    'notif.reminder_h3_hours': int(1, 12, 'Heures avant le début', 'h'),
    'notif.sms_quiet_start': int(0, 23, 'Début de la plage sans SMS', 'h'),
    'notif.sms_quiet_end': int(0, 23, 'Fin de la plage sans SMS', 'h'),
    'notif.sms_optional_daily_cap': int(0, 1_000_000, 'Plafond quotidien des SMS optionnels', 'SMS'),
    'notif.sms_essential_daily_alert': int(1, 1_000_000, 'Seuil d’alerte des SMS indispensables du jour', 'SMS'),
    // Lot 10a : réservation de salles (bornes identiques à fin_setting_valid, migration 20261122000001)
    'halls.service_fee_rate': rate(0, 50, 'Frais de service des salles'),
    'halls.commission_rate': rate(0, 50, 'Commission sur le prix des salles'),
    'halls.deposit_default_percent': int(1, 100, 'Acompte par défaut', '%'),
    'halls.balance_due_days': int(1, 60, 'Solde à payer au plus tard avant la date', 'jours'),
    'halls.hold_minutes': int(5, 60, 'Durée de garde d’une réservation non payée', 'min'),
    // Correctifs de la contre-vérification du lot 10a (T4) : migration 20261122000010
    'halls.full_payment_margin_hours': int(1, 168, 'Paiement en une fois si le solde serait dû dans moins de', 'h'),
    'halls.cancel_partial_percent': int(1, 99, 'Part remboursée dans la tranche intermédiaire', '%'),
    'halls.cancel_souple_full_days': int(1, 365, 'Règle souple : remboursement total jusqu’à', 'jours'),
    'halls.cancel_moderee_full_days': int(1, 365, 'Règle modérée : remboursement total jusqu’à', 'jours'),
    'halls.cancel_moderee_partial_days': int(1, 365, 'Règle modérée : remboursement partiel jusqu’à', 'jours'),
    'halls.cancel_stricte_partial_days': int(1, 365, 'Règle stricte : remboursement partiel jusqu’à', 'jours'),
    // Lot 11a : réservation de tables (bornes identiques à fin_setting_valid, migration 20261123000101)
    'tables.service_fee_rate': rate(0, 50, 'Frais de service des tables'),
    'tables.commission_rate': rate(0, 50, 'Commission sur l’acompte des tables'),
    'tables.slot_minutes': { min: 30, max: 360, integer: true, step: 15, label: 'Durée d’une réservation de table par défaut', unit: 'min' },
    'tables.hold_minutes': int(5, 60, 'Durée de garde d’une table non payée', 'min'),
    'tables.response_minutes': int(15, 1440, 'Délai de réponse d’un établissement', 'min'),
    'tables.no_show_minutes': int(5, 180, 'Client absent : table libérée après', 'min'),
    'tables.cancel_free_hours': int(0, 72, 'Acompte rendu si le client annule au moins', 'h'),
    'tables.max_pending_per_client': int(1, 10, 'Réservations non payées au plus par client', 'réservations'),
    'tables.reminder_hours': int(1, 24, 'Rappel au client avant l’heure', 'h'),
};

/** Nombre écrit à la française, sans unité : « 1 000 000 », « 1,5 ». */
function fr(n: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n).replace(/ /g, ' ');
}

/**
 * Erreur à afficher sous le champ, ou null si la valeur est admise (unité du catalogue : « % », « h », « F CFA »).
 * Un réglage sans bornes (choix, interrupteur, texte) n'est contrôlé que par le serveur.
 */
export function settingBoundsError(key: string, raw: string | number): string | null {
    const b = SETTING_BOUNDS[key];
    if (!b) return null;
    const unit = b.unit;
    const text = typeof raw === 'number' ? String(raw) : raw.trim().replace(',', '.');
    if (text === '') return 'Indiquez une valeur.';
    const n = Number(text);
    if (!Number.isFinite(n)) return 'Indiquez un nombre.';
    if (b.integer && !Number.isInteger(n)) return 'Indiquez un nombre entier, sans virgule.';
    if (n < b.min || n > b.max) return `Choisissez entre ${fr(b.min)} et ${fr(b.max)}${unit ? ` ${unit}` : ''}.`;
    return null;
}

/** Phrase de refus du serveur pour une valeur hors bornes (jamais la clé technique). */
export function settingRefusal(key: string, value: unknown): string {
    const b = SETTING_BOUNDS[key];
    if (!b) return 'Cette valeur n’est pas admise pour ce réglage.';
    const unit = b.unit ? ` ${b.unit}` : '';
    const shown = typeof value === 'number' ? `${fr(value)}${unit}` : 'cette valeur';
    return `${b.label} : ${shown} n’est pas admis. Choisissez entre ${fr(b.min)} et ${fr(b.max)}${unit}.`;
}

/**
 * Alerte sur une valeur admise mais risquée, ou null. `all` : valeurs actuelles des autres réglages (ex. les frais de
 * service comparés aux frais SamirPay).
 */
export function settingRisk(key: string, value: unknown, all: Readonly<Record<string, unknown>> = {}): string | null {
    const n = typeof value === 'number' ? value : Number(value);
    switch (key) {
        case 'finance.service_fee_rate': {
            const fees = [all['finance.aggregator_fee_rate.WAVE'], all['finance.aggregator_fee_rate.ORANGE_MONEY']].map(Number).filter(Number.isFinite);
            const top = fees.length > 0 ? Math.max(...fees) : null;
            if (top !== null && n < top) return `En dessous des frais SamirPay de ${fr(top)} %, chaque vente coûte de l’argent à Event Village.`;
            if (n > 10) return 'Au-delà de 10 %, le prix paraît abusif aux acheteurs.';
            return null;
        }
        case 'finance.payment_hold_minutes':
            if (n <= 5) return 'Les acheteurs lents risquent d’être remboursés au lieu de recevoir leurs billets.';
            if (n >= 45) return 'Des paniers abandonnés bloquent des places pendant longtemps.';
            return null;
        case 'finance.cancellation_aggregator_fee_bearer':
            return value === 'ORGANISATEUR' ? 'Le solde du partenaire baisse à chaque remboursement et peut devenir une créance.' : null;
        case 'finance.payout_hold_enabled':
            return value === false ? 'Un partenaire peut retirer avant l’événement ; s’il est annulé, Event Village rembourse sans pouvoir reprendre l’argent.' : null;
        case 'finance.payout_delay_hours':
            return n === 0 ? 'Plus aucune marge pour une réclamation après l’événement.' : null;
        case 'finance.withdrawal_min_amount':
            return n === 0 ? 'Chaque petit retrait coûte des frais SamirPay à Event Village.' : null;
        case 'finance.withdrawal_bank_enabled':
            return value === true ? 'Aucun circuit de virement n’existe encore : ne l’activez pas.' : null;
        case 'finance.safety_reserve_mode':
            return value === 'FIXED' && Number(all['finance.safety_reserve_amount'] ?? 0) === 0
                ? 'Montant fixe à 0 : aucune réserve n’est gardée sur le compte.' : null;
        case 'finance.safety_reserve_amount':
            return n === 0 && all['finance.safety_reserve_mode'] === 'FIXED' ? 'Aucune réserve : le retirable peut compter un encaissement que SamirPay n’a pas encore réglé.' : null;
        case 'access.scan_window_before_hours':
            return n === 0 ? 'Le public ne peut pas entrer avant l’heure de début.' : null;
        case 'access.scan_window_after_hours':
            return n === 0 ? 'Un événement qui déborde ne contrôle plus les entrées après l’heure de fin.' : null;
        case 'access.counter_sale_enabled':
            return value === false ? 'Le guichet s’arrête à toutes les portes, même pendant un événement.' : null;
        case 'access.refusal_alert_threshold':
            if (n <= 3) return 'Les partenaires risquent de recevoir des alertes sans cesse.';
            if (n >= 200) return 'L’alerte ne partira presque jamais.';
            return null;
        case 'notif.reminder_j1_enabled':
            return value === false ? 'Plus aucun rappel la veille.' : null;
        case 'notif.reminder_h3_enabled':
            return value === false ? 'Plus aucun rappel avant le début.' : null;
        case 'notif.j1_sms':
        case 'notif.h3_sms':
            return value === 'ALWAYS' ? 'Un SMS facturé par détenteur et par événement.' : null;
        case 'notif.sms_optional_daily_cap':
            return n === 0 ? 'Plus aucun rappel ni aucune annonce par SMS.' : null;
        case 'notif.free_ticket_reminder_sms':
            return value === 'SAME_AS_PAID' ? 'Un événement gratuit de 2 000 inscrits coûte 2 000 SMS par rappel.' : null;
        case 'features.halls_enabled':
        case 'features.tables_enabled':
        case 'features.orders_enabled':
            return value === true ? 'Pas prêt pour la mise en ligne : ne l’activez pas sans l’accord de l’équipe technique.' : null;
        default:
            return null;
    }
}
