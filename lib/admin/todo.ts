/**
 * Finition 3b (E-29) — lignes de « À faire aujourd'hui » et droit d'agir de chacune.
 *
 * Une ligne n'apparaît que si l'administrateur a le droit d'AGIR dessus (la route ne demande à la base que ces lignes).
 * L'ordre est celui de l'écran : l'argent que des personnes attendent d'abord. Module pur (sans `next/server`), lisible
 * par un composant client.
 */

export type TodoLineKey =
    | 'to_resume'
    | 'events_to_validate'
    | 'partners_to_validate'
    | 'events_suspended'
    | 'cash_discrepancies'
    | 'failed_sends'
    | 'sms_cap'
    | 'debts';

export const TODO_LINES: ReadonlyArray<{ key: TodoLineKey; permission: string }> = [
    { key: 'to_resume', permission: 'refunds.manage' },
    { key: 'events_to_validate', permission: 'events.write' },
    { key: 'partners_to_validate', permission: 'partners.validate' },
    { key: 'events_suspended', permission: 'events.write' },
    { key: 'cash_discrepancies', permission: 'events.write' },
    { key: 'failed_sends', permission: 'notifications.write' },
    { key: 'sms_cap', permission: 'notifications.read' },
    { key: 'debts', permission: 'payments.read' },
];

/** Lignes ouvertes à ces droits, dans l'ordre de l'écran. */
export function todoLinesFor(permissions: readonly string[]): TodoLineKey[] {
    return TODO_LINES.filter((l) => permissions.includes(l.permission)).map((l) => l.key);
}

export interface TodoLine {
    key: TodoLineKey;
    /** Compteur (pour sms_cap : SMS optionnels envoyés aujourd'hui). Absent si la ligne est indisponible. */
    count?: number;
    /** Lecture en échec : « Compteur indisponible », jamais 0. */
    unavailable?: boolean;
    amount?: number;
    oldest_at?: string | null;
    resubmitted?: number;
    past?: number;
    upcoming?: number;
    events_count?: number;
    events?: Array<{ event_id: string; title: string; count: number }>;
    cap?: number | null;
}

export interface TodoReply {
    /** Lignes à traiter (compteur > 0, alerte du plafond, ou indisponibles), dans l'ordre de l'écran. */
    lines: TodoLine[];
    /** Lignes ouvertes mais sans rien à faire (« À jour »). */
    upToDate: TodoLineKey[];
    /** Lignes ouvertes à cet administrateur. */
    allowed: TodoLineKey[];
    /** Vrai si des lignes lui sont fermées faute de droit. */
    partial: boolean;
    computedAt: string | null;
}
