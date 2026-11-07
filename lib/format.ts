/**
 * Lot 5 (contrat B) — formats d'affichage partagés par les écrans (client et serveur).
 *  - dates et heures en Africa/Dakar (UTC+0 toute l'année) : « sam. 15 nov. 2026 à 20:00 » ;
 *  - montants en francs CFA entiers : « 5 000 F CFA » ;
 *  - pourcentages : « 42 % ».
 * Espaces : insécable (U+00A0) entre les milliers, devant « % » et entre le montant et « F CFA », pour
 * qu'aucune valeur ne soit coupée en fin de ligne. Intl (fr-FR) produit une insécable fine (U+202F),
 * mais Plus Jakarta Sans la dessine à 0,09 em (1,4 px à 16 px) : « 351 000 » se lisait « 351000 »
 * (relecture des captures du run 50, mesuré dans Chromium). L'insécable U+00A0 y fait 0,175 em,
 * plus l'espacement des mots de app/globals.css : séparateur visible à toutes les tailles.
 * Valeur absente ou illisible → « — » (jamais « NaN », « Invalid Date » ni la valeur brute).
 */

export const DAKAR_TIME_ZONE = 'Africa/Dakar';
export const MISSING_VALUE = '—';

const NBSP = ' ';
const NARROW_NBSP_RE = new RegExp(String.fromCharCode(0x202f), 'g');

/** Remplace l'insécable fine d'Intl (invisible avec Plus Jakarta Sans) par l'insécable U+00A0. */
function visibleSpaces(formatted: string): string {
    return formatted.replace(NARROW_NBSP_RE, NBSP);
}

const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', {
    timeZone: DAKAR_TIME_ZONE, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
});
const SHORT_DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', {
    timeZone: DAKAR_TIME_ZONE, day: 'numeric', month: 'short', year: 'numeric',
});
const TIME_FORMAT = new Intl.DateTimeFormat('fr-FR', {
    timeZone: DAKAR_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const INTEGER_FORMAT = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const PRECISE_FORMAT = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

type DateInput = Date | string | number | null | undefined;

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d+)?)?$/;

/**
 * Date JS d'une valeur : Date, horodatage, ISO complet, ou date seule « AAAA-MM-JJ » (lue comme minuit à
 * Dakar, donc minuit UTC). null si illisible.
 */
export function toDate(input: DateInput): Date | null {
    if (input === null || input === undefined || input === '') return null;
    const d = input instanceof Date
        ? input
        : typeof input === 'string' && DATE_ONLY_RE.test(input)
            ? new Date(`${input}T00:00:00Z`)
            : new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
}

/** Date et heure à Dakar : « sam. 15 nov. 2026 à 20:00 ». */
export function formatDateTime(input: DateInput): string {
    const d = toDate(input);
    return d ? `${DATE_FORMAT.format(d)} à ${TIME_FORMAT.format(d)}` : MISSING_VALUE;
}

/** Date seule à Dakar : « sam. 15 nov. 2026 ». */
export function formatDate(input: DateInput): string {
    const d = toDate(input);
    return d ? DATE_FORMAT.format(d) : MISSING_VALUE;
}

/** Date courte à Dakar, sans jour de la semaine : « 15 nov. 2026 » (tableaux denses). */
export function formatShortDate(input: DateInput): string {
    const d = toDate(input);
    return d ? SHORT_DATE_FORMAT.format(d) : MISSING_VALUE;
}

/** Heure à Dakar : « 20:00 ». */
export function formatTime(input: DateInput): string {
    const d = toDate(input);
    return d ? TIME_FORMAT.format(d) : MISSING_VALUE;
}

/**
 * Date et heure d'un événement à partir des colonnes `start_date` (« AAAA-MM-JJ ») et `start_time`
 * (« HH:mm » ou « HH:mm:ss »), déjà exprimées à Dakar : « sam. 15 nov. 2026 à 20:00 ». Sans heure
 * valide : la date seule.
 */
export function formatEventDateTime(date: string | null | undefined, time?: string | null): string {
    if (!date || !DATE_ONLY_RE.test(date)) return MISSING_VALUE;
    const m = time ? TIME_RE.exec(time) : null;
    if (!m) return formatDate(date);
    return formatDateTime(`${date}T${m[1]}:${m[2]}:00Z`);
}

/**
 * Valeur ISO « AAAA-MM-JJTHH:mm » d'un horodatage, à Dakar, pour un champ `datetime-local` et pour
 * l'attribut `dateTime` d'un élément <time>.
 */
export function toDakarDateTimeLocal(input: DateInput): string {
    const d = toDate(input);
    if (!d) return '';
    // Africa/Dakar = UTC+0 sans heure d'été : l'heure UTC est l'heure locale.
    return d.toISOString().slice(0, 16);
}

/** Entier formaté en français : « 12 345 ». */
export function formatInteger(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return MISSING_VALUE;
    return visibleSpaces(INTEGER_FORMAT.format(Math.round(value)));
}

/** Montant en francs CFA entiers : « 5 000 F CFA ». */
export function formatFcfa(amount: number | null | undefined): string {
    if (amount === null || amount === undefined || !Number.isFinite(amount)) return MISSING_VALUE;
    return `${formatInteger(amount)}${NBSP}F${NBSP}CFA`;
}

/**
 * Montant en francs CFA avec ses décimales (2 au plus) : « 19,7 F CFA ». Pour les rapprochements financiers, où les
 * frais de l'agrégateur et les nets ne sont pas entiers ; partout ailleurs, formatFcfa.
 */
export function formatFcfaPrecise(amount: number | null | undefined): string {
    if (amount === null || amount === undefined || !Number.isFinite(amount)) return MISSING_VALUE;
    return `${visibleSpaces(PRECISE_FORMAT.format(amount))}${NBSP}F${NBSP}CFA`;
}

/**
 * Pourcentage d'un ratio (0,42 → « 42 % »). `digits` décimales au plus (0 par défaut). Ratio absent,
 * infini ou NaN (division par zéro) → « — ».
 */
export function formatPercent(ratio: number | null | undefined, digits = 0): string {
    if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return MISSING_VALUE;
    return visibleSpaces(
        new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(ratio),
    );
}

/** Ratio part / total protégé contre la division par zéro (null si total ≤ 0). */
export function ratio(part: number, total: number): number | null {
    return total > 0 && Number.isFinite(part) ? part / total : null;
}
