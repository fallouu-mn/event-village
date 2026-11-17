/**
 * Finition 3b (E-29) — lignes de « À faire aujourd'hui » et droit d'agir de chacune.
 *
 * Une ligne n'apparaît que si l'administrateur a le droit d'AGIR dessus (la route ne demande à la base que ces lignes).
 * L'ordre est celui de l'écran : l'argent que des personnes attendent d'abord. Module pur (sans `next/server`), lisible
 * par un composant client. Finition 3d (point 5) : à l'écran, versements à reprendre et créances ne font plus qu'une
 * ligne (todoMoneyLine, plus bas).
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

/**
 * Finition 3d (point 5, décision 12 de la 3b) — « À faire aujourd'hui » n'a plus qu'une ligne pour l'argent :
 * « Argent qui attend : {n} versements à reprendre, {n} créances », qui mène au bloc « Argent qui attend » (le détail).
 * La route et la base ne changent pas : les deux lignes (to_resume, debts) sont lues comme avant, puis réunies ici.
 * Seules les parties ouvertes aux droits de l'administrateur apparaissent ; un compteur illisible le dit, jamais 0 ; tout
 * à zéro : la ligne rejoint le groupe « À jour ».
 */
export const MONEY_KEYS: readonly TodoLineKey[] = ['to_resume', 'debts'];

export interface MoneyPart {
    key: 'to_resume' | 'debts';
    /** Nombre ; null si le compteur est illisible. */
    count: number | null;
    amount: number | null;
    unavailable: boolean;
}

export interface MoneyLine {
    /** Vrai s'il y a quelque chose à reprendre ou un compteur illisible : une carte ; faux : groupe « À jour ». */
    due: boolean;
    title: string;
    parts: MoneyPart[];
}

const MONEY_WORDS = {
    to_resume: { one: 'versement à reprendre', many: 'versements à reprendre', none: 'aucun versement à reprendre' },
    debts: { one: 'créance', many: 'créances', none: 'aucune créance' },
} as const;

/** « 1 234 » : chiffres groupés par trois (espace fine insécable), comme à l'écran. */
function groupDigits(n: number): string {
    return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function moneyPartText(p: MoneyPart): string {
    const w = MONEY_WORDS[p.key];
    if (p.unavailable) return `${w.many} (compteur indisponible)`;
    const n = p.count ?? 0;
    if (n <= 0) return w.none;
    return `${groupDigits(n)} ${n > 1 ? w.many : w.one}`;
}

export function todoMoneyLine(reply: TodoReply): MoneyLine | null {
    const parts: MoneyPart[] = [];
    for (const key of ['to_resume', 'debts'] as const) {
        if (!reply.allowed.includes(key)) continue;
        const line = reply.lines.find((l) => l.key === key);
        if (line?.unavailable === true) parts.push({ key, count: null, amount: null, unavailable: true });
        else if (line) parts.push({ key, count: Number(line.count ?? 0), amount: line.amount ?? null, unavailable: false });
        else parts.push({ key, count: 0, amount: 0, unavailable: false });
    }
    if (parts.length === 0) return null;
    const due = parts.some((p) => p.unavailable || (p.count ?? 0) > 0);
    return { due, title: `Argent qui attend : ${parts.map(moneyPartText).join(', ')}`, parts };
}
