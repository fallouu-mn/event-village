/**
 * Design 1d (point 4) — comptes à rebours, calculés dans le navigateur APRÈS le chargement (comme withClock : jamais
 * dans une page en cache, le premier rendu ne dépend pas de l'heure). Module sans dépendance (navigateur et serveur).
 *
 * Début d'un événement :
 *  - plus de 7 jours avant : rien (la date seule, déjà affichée) ;
 *  - de 7 jours à 24 h avant : « Commence dans 2 j 4 h » ;
 *  - le dernier jour (moins de 24 h) : heures, minutes et secondes, « Commence dans 3 h 12 min 05 s » ;
 *  - entre le début et la fin retenue : « En cours » ; après la fin : rien.
 * Fin des ventes proche (48 h au plus) : « Ventes closes dans 1 j 4 h », puis heures, minutes et secondes.
 * Paiement en attente : « 12 min 05 s pour finir le paiement ».
 * Lecteurs d'écran : `spoken` ne change qu'à la minute (jamais chaque seconde), en mots entiers.
 */

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Au-delà, la date seule. */
export const COUNTDOWN_DAYS_LIMIT = 7 * DAY;
/** Fin des ventes annoncée 48 h avant au plus. */
export const SALE_CLOSE_WARNING = 48 * HOUR;

export type CountdownKind = 'none' | 'days' | 'clock' | 'live';

export interface Countdown {
    kind: CountdownKind;
    /** Texte affiché (peut changer chaque seconde), null : rien à afficher. */
    text: string | null;
    /** Texte des lecteurs d'écran, à la minute près, null : rien. */
    spoken: string | null;
    /** Délai avant le prochain recalcul utile (ms), null : plus rien ne changera. */
    nextIn: number | null;
}

const NONE: Countdown = { kind: 'none', text: null, spoken: null, nextIn: null };

function two(n: number): string {
    return String(n).padStart(2, '0');
}

function plural(n: number, one: string, many: string): string {
    return `${n} ${n > 1 ? many : one}`;
}

/** « 2 j 4 h » ; « 3 j » quand l'heure est ronde. */
export function daysHoursText(ms: number): string {
    const days = Math.floor(ms / DAY);
    const hours = Math.floor((ms % DAY) / HOUR);
    return hours > 0 ? `${days} j ${hours} h` : `${days} j`;
}

/** « 3 h 12 min 05 s », « 12 min 05 s », « 45 s ». */
export function clockText(ms: number): string {
    const total = Math.max(0, Math.ceil(ms / SECOND));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${h} h ${two(m)} min ${two(s)} s`;
    if (m > 0) return `${m} min ${two(s)} s`;
    return `${s} s`;
}

/** En mots, à la minute près (arrondi à la minute supérieure) : « 2 jours et 4 heures », « 3 heures et 12 minutes ». */
export function spokenDuration(ms: number): string {
    const minutes = Math.max(1, Math.ceil(ms / MINUTE));
    const days = Math.floor(minutes / (24 * 60));
    const hours = Math.floor((minutes % (24 * 60)) / 60);
    const mins = minutes % 60;
    if (days > 0) return hours > 0 ? `${plural(days, 'jour', 'jours')} et ${plural(hours, 'heure', 'heures')}` : plural(days, 'jour', 'jours');
    if (hours > 0) return mins > 0 ? `${plural(hours, 'heure', 'heures')} et ${plural(mins, 'minute', 'minutes')}` : plural(hours, 'heure', 'heures');
    return plural(mins, 'minute', 'minutes');
}

/** Délai jusqu'à la prochaine minute pleine du compte (ms), au moins 1 s. */
function untilNextMinute(ms: number): number {
    const rest = ms % MINUTE;
    return Math.max(SECOND, rest === 0 ? MINUTE : rest);
}

function remaining(prefix: string, ms: number, limit: number): Countdown {
    if (ms <= 0 || ms > limit) return NONE;
    if (ms >= DAY) {
        return {
            kind: 'days',
            text: `${prefix} ${daysHoursText(ms)}`,
            spoken: `${prefix} ${spokenDuration(ms)}`,
            nextIn: Math.min(untilNextMinute(ms), ms - DAY + SECOND),
        };
    }
    return { kind: 'clock', text: `${prefix} ${clockText(ms)}`, spoken: `${prefix} ${spokenDuration(ms)}`, nextIn: SECOND };
}

/** Compte à rebours du début d'un événement à l'heure `now` (ms) ; instants ISO du début et de la fin retenue. */
export function eventCountdown(now: number, startsAt: string | null | undefined, endsAt: string | null | undefined): Countdown {
    const start = Date.parse(startsAt ?? '');
    const end = Date.parse(endsAt ?? '');
    if (!Number.isFinite(start)) return NONE;
    if (now >= start) {
        if (Number.isFinite(end) && now < end) return { kind: 'live', text: 'En cours', spoken: 'En cours', nextIn: Math.max(SECOND, end - now) };
        return NONE;
    }
    const left = start - now;
    if (left > COUNTDOWN_DAYS_LIMIT) return { ...NONE, nextIn: left - COUNTDOWN_DAYS_LIMIT + SECOND };
    return remaining('Commence dans', left, COUNTDOWN_DAYS_LIMIT);
}

/** Fin des ventes proche (48 h au plus) : « Ventes closes dans … » ; rien avant, rien après. */
export function saleCloseCountdown(now: number, saleEnd: string | null | undefined): Countdown {
    const end = Date.parse(saleEnd ?? '');
    if (!Number.isFinite(end) || end <= now) return NONE;
    const left = end - now;
    if (left > SALE_CLOSE_WARNING) return { ...NONE, nextIn: left - SALE_CLOSE_WARNING + SECOND };
    return remaining('Ventes closes dans', left, SALE_CLOSE_WARNING);
}

/** Temps restant pour finir un paiement en attente : « 12 min 05 s pour finir le paiement ». */
export function paymentCountdown(now: number, expiresAt: string | null | undefined): Countdown {
    const end = Date.parse(expiresAt ?? '');
    if (!Number.isFinite(end)) return NONE;
    const left = end - now;
    if (left <= 0) return { kind: 'clock', text: 'Délai de paiement dépassé', spoken: 'Délai de paiement dépassé', nextIn: null };
    return {
        kind: 'clock',
        text: `${clockText(left)} pour finir le paiement`,
        spoken: `${spokenDuration(left)} pour finir le paiement`,
        nextIn: SECOND,
    };
}

/**
 * Carte d'un événement (accueil, Explorer, favoris) : même seuils que la fiche, mais à la minute (une seule minuterie
 * pour toutes les cartes de la page, jamais une par seconde) : « Commence dans 2 j 4 h », « Commence dans 3 h 12 min »,
 * « Commence dans 12 min », « En cours » ; rien à plus de 7 jours ni après la fin.
 */
export function cardCountdown(now: number, startsAt: string | null | undefined, endsAt: string | null | undefined): Countdown {
    const full = eventCountdown(now, startsAt, endsAt);
    if (full.kind !== 'clock') return full;
    const left = Date.parse(startsAt ?? '') - now;
    const minutes = Math.max(1, Math.ceil(left / MINUTE));
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const text = h > 0 ? `Commence dans ${h} h ${two(m)} min` : `Commence dans ${m} min`;
    return { kind: 'clock', text, spoken: full.spoken, nextIn: untilNextMinute(left) };
}
