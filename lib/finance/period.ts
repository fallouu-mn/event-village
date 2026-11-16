/**
 * Finition 3a (E-30) — période de la page Finance, calculée par le serveur en heure de Dakar.
 *
 * Une seule période pour toute la page : « Aujourd'hui », « 7 derniers jours », « 30 derniers jours », « Ce mois-ci »,
 * « Mois dernier » ou des dates libres (du … au …, bornes comprises). Chaque période est un intervalle [from, to[ en
 * instants UTC : du début du premier jour (minuit à Dakar) au début du jour qui suit le dernier. Les jours sont ceux du
 * calendrier de Dakar (Africa/Dakar), lus par Intl : aucun calcul de fuseau codé en dur.
 * Module pur (aucune dépendance serveur) : lu par les routes /api/admin/finance/* et par l'écran (libellés).
 */

export const PERIOD_KEYS = ['today', '7d', '30d', 'month', 'prev-month', 'custom'] as const;
export type PeriodKey = typeof PERIOD_KEYS[number];

export const DEFAULT_PERIOD: PeriodKey = 'month';

export const PERIOD_LABELS: Readonly<Record<PeriodKey, string>> = {
    today: 'Aujourd’hui',
    '7d': '7 derniers jours',
    '30d': '30 derniers jours',
    month: 'Ce mois-ci',
    'prev-month': 'Mois dernier',
    custom: 'Dates choisies',
};

/** Première date admise pour des dates libres, et plus longue période admise (en jours, bornes comprises). */
export const CUSTOM_MIN_DATE = '2020-01-01';
export const CUSTOM_MAX_DAYS = 366;

export interface FinancePeriod {
    key: PeriodKey;
    /** Début, instant UTC ISO (minuit à Dakar du premier jour). */
    from: string;
    /** Fin exclue, instant UTC ISO (minuit à Dakar du jour qui suit le dernier). */
    to: string;
    /** Premier et dernier jour, AAAA-MM-JJ du calendrier de Dakar (bornes comprises). */
    firstDay: string;
    lastDay: string;
    /** Libellé court (« Ce mois-ci ») et phrase des dates (« du 1er au 16 novembre 2026 »). */
    label: string;
    range: string;
}

export type PeriodResult = { ok: true; period: FinancePeriod } | { ok: false; error: string };

const TZ = 'Africa/Dakar';
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

interface Day { y: number; m: number; d: number }

/** Jour du calendrier de Dakar d'un instant. */
export function dakarDay(at: Date): Day {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    return { y: get('year'), m: get('month'), d: get('day') };
}

/** Écart de Dakar avec UTC à un instant, en minutes (0 aujourd'hui ; lu, jamais supposé). */
function dakarOffsetMinutes(at: Date): number {
    const name = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'longOffset' })
        .formatToParts(at).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
    const m = /^GMT(?:([+-])(\d{2}):?(\d{2}))?$/.exec(name);
    if (!m || !m[1]) return 0;
    const minutes = Number(m[2]) * 60 + Number(m[3]);
    return m[1] === '-' ? -minutes : minutes;
}

/** Instant UTC de minuit à Dakar pour un jour du calendrier (jour normalisé : le 32 octobre devient le 1er novembre). */
function dakarMidnight(day: Day): Date {
    const guess = new Date(Date.UTC(day.y, day.m - 1, day.d));
    return new Date(guess.getTime() - dakarOffsetMinutes(guess) * 60_000);
}

function addDays(day: Day, n: number): Day {
    const t = new Date(Date.UTC(day.y, day.m - 1, day.d + n));
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

function iso(day: Day): string {
    return `${String(day.y).padStart(4, '0')}-${String(day.m).padStart(2, '0')}-${String(day.d).padStart(2, '0')}`;
}

function parseDay(s: string | null | undefined): Day | null {
    const m = DATE_RE.exec((s ?? '').trim());
    if (!m) return null;
    const day = { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
    const t = new Date(Date.UTC(day.y, day.m - 1, day.d));
    if (t.getUTCFullYear() !== day.y || t.getUTCMonth() + 1 !== day.m || t.getUTCDate() !== day.d) return null;
    return day;
}

function dayNumber(day: Day): number {
    return Math.round(Date.UTC(day.y, day.m - 1, day.d) / 86_400_000);
}

/** « 1er », « 2 »… */
function dayWord(d: number): string {
    return d === 1 ? '1er' : String(d);
}

/** Phrase des dates, bornes comprises : « le 16 novembre 2026 », « du 10 au 16 novembre 2026 », « du 28 octobre au 3 novembre 2026 ». */
export function rangeText(first: Day, last: Day): string {
    if (iso(first) === iso(last)) return `le ${dayWord(first.d)} ${MONTHS[first.m - 1]} ${first.y}`;
    if (first.y === last.y && first.m === last.m) return `du ${dayWord(first.d)} au ${dayWord(last.d)} ${MONTHS[last.m - 1]} ${last.y}`;
    if (first.y === last.y) return `du ${dayWord(first.d)} ${MONTHS[first.m - 1]} au ${dayWord(last.d)} ${MONTHS[last.m - 1]} ${last.y}`;
    return `du ${dayWord(first.d)} ${MONTHS[first.m - 1]} ${first.y} au ${dayWord(last.d)} ${MONTHS[last.m - 1]} ${last.y}`;
}

function build(key: PeriodKey, first: Day, last: Day): FinancePeriod {
    return {
        key,
        from: dakarMidnight(first).toISOString(),
        to: dakarMidnight(addDays(last, 1)).toISOString(),
        firstDay: iso(first),
        lastDay: iso(last),
        label: key === 'custom' ? rangeText(first, last).replace(/^./, (c) => c.toUpperCase()) : PERIOD_LABELS[key],
        range: rangeText(first, last),
    };
}

/**
 * Période demandée (paramètres de la page : period, from, to), ou refus en français. Sans période : « Ce mois-ci ».
 * Dates libres : AAAA-MM-JJ, du ≤ au, au plus tard aujourd'hui (Dakar), au plus 366 jours, pas avant 2020.
 */
export function resolvePeriod(input: { period?: string | null; from?: string | null; to?: string | null }, now: Date = new Date()): PeriodResult {
    const key = (input.period ?? '').trim() || DEFAULT_PERIOD;
    if (!(PERIOD_KEYS as readonly string[]).includes(key)) {
        return { ok: false, error: 'Période inconnue. Choisissez une période dans la liste.' };
    }
    const today = dakarDay(now);
    switch (key as PeriodKey) {
        case 'today':
            return { ok: true, period: build('today', today, today) };
        case '7d':
            return { ok: true, period: build('7d', addDays(today, -6), today) };
        case '30d':
            return { ok: true, period: build('30d', addDays(today, -29), today) };
        case 'month':
            // Du 1er du mois à aujourd'hui (aucune opération n'est datée du futur) : « du 1er au 16 novembre 2026 »
            return { ok: true, period: build('month', { y: today.y, m: today.m, d: 1 }, today) };
        case 'prev-month': {
            const first = { y: today.m === 1 ? today.y - 1 : today.y, m: today.m === 1 ? 12 : today.m - 1, d: 1 };
            const last = addDays({ y: today.y, m: today.m, d: 1 }, -1);
            return { ok: true, period: build('prev-month', first, last) };
        }
        case 'custom': {
            const first = parseDay(input.from);
            const last = parseDay(input.to);
            if (!first || !last) return { ok: false, error: 'Indiquez deux dates valables (du … au …).' };
            if (dayNumber(first) > dayNumber(last)) return { ok: false, error: 'La date de début doit précéder la date de fin.' };
            if (dayNumber(last) > dayNumber(today)) return { ok: false, error: 'La date de fin ne peut pas dépasser aujourd’hui.' };
            if (iso(first) < CUSTOM_MIN_DATE) return { ok: false, error: 'Choisissez une date à partir du 1er janvier 2020.' };
            if (dayNumber(last) - dayNumber(first) + 1 > CUSTOM_MAX_DAYS) {
                return { ok: false, error: `Choisissez au plus ${CUSTOM_MAX_DAYS} jours.` };
            }
            return { ok: true, period: build('custom', first, last) };
        }
    }
    return { ok: false, error: 'Période inconnue. Choisissez une période dans la liste.' };
}

/** Mois en cours à Dakar (accueil de l'administration : « Gagné par Event Village, ce mois-ci »). */
export function currentMonth(now: Date = new Date()): FinancePeriod {
    const r = resolvePeriod({ period: 'month' }, now);
    if (!r.ok) throw new Error(r.error);
    return r.period;
}
