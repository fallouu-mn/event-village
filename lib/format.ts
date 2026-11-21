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

/**
 * Design 1e (vitesse) : aucun formateur Intl construit au chargement du module (profil du run 526 : 52 ms au téléphone de
 * référence sur Mes billets). Nombres : formateur fr-FR construit à son premier usage, puis gardé (0 ou 2 décimales).
 * Dates de Dakar écrites sans Intl : Africa/Dakar = UTC+0 toute l'année, sans heure d'été (voir toDakarDateTimeLocal),
 * donc jour, mois, année, heure et minute sont ceux de l'heure UTC, avec les abréviations d'Intl fr-FR (« sam. 14 nov.
 * 2026 », « 14 nov. 2026 », « 08:05 ») ; comparé instant par instant à Intl par tests/schema/design1e-vitesse.test.ts (le
 * premier Intl.DateTimeFormat coûtait 35 ms, profil du run 552). Écriture compacte : ce module est dans le JavaScript de
 * chaque page (budget de /billet/hors-ligne, run 557).
 */
const numberFormats: Intl.NumberFormat[] = [];
const numberFormat = (digits: 0 | 2): Intl.NumberFormat => (numberFormats[digits] ??= new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits }));
const WEEKDAYS = 'dim. lun. mar. mer. jeu. ven. sam.'.split(' ');
const MONTHS = 'janv. févr. mars avr. mai juin juil. août sept. oct. nov. déc.'.split(' ');
const SHORT_DATE_FORMAT = (d: Date): string => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
const DATE_FORMAT = (d: Date): string => `${WEEKDAYS[d.getUTCDay()]} ${SHORT_DATE_FORMAT(d)}`;
const TIME_FORMAT = (d: Date): string => d.toISOString().slice(11, 16);

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
    return d ? `${DATE_FORMAT(d)} à ${TIME_FORMAT(d)}` : MISSING_VALUE;
}

/** Date seule à Dakar : « sam. 15 nov. 2026 ». */
export function formatDate(input: DateInput): string {
    const d = toDate(input);
    return d ? DATE_FORMAT(d) : MISSING_VALUE;
}

/** Date courte à Dakar, sans jour de la semaine : « 15 nov. 2026 » (tableaux denses). */
export function formatShortDate(input: DateInput): string {
    const d = toDate(input);
    return d ? SHORT_DATE_FORMAT(d) : MISSING_VALUE;
}

/** Heure à Dakar : « 20:00 ». */
export function formatTime(input: DateInput): string {
    const d = toDate(input);
    return d ? TIME_FORMAT(d) : MISSING_VALUE;
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

/**
 * Chiffres d'un entier groupés par trois, séparés par l'insécable visible : même texte qu'Intl fr-FR après visibleSpaces
 * (« -12 345 », zéro signé « -0 » compris ; vérifié valeur par valeur par tests/schema/design1e-vitesse.test.ts).
 */
function groupDigits(rounded: number): string {
    const negative = rounded < 0 || Object.is(rounded, -0);
    const digits = String(Math.abs(rounded));
    let out = '';
    for (let i = 0; i < digits.length; i += 1) {
        if (i > 0 && (digits.length - i) % 3 === 0) out += NBSP;
        out += digits[i];
    }
    return negative ? `-${out}` : out;
}

/**
 * Entier formaté en français : « 12 345 ». Design 1e (vitesse) : sans Intl pour un entier ordinaire (le premier
 * Intl.NumberFormat coûtait 43 à 45 ms au téléphone de référence, au premier prix affiché de la fiche et de Mes billets) ;
 * Intl seulement au-delà de 10^21 (écriture scientifique de String).
 */
export function formatInteger(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return MISSING_VALUE;
    const rounded = Math.round(value);
    if (Math.abs(rounded) >= 1e21) return visibleSpaces(numberFormat(0).format(rounded));
    return groupDigits(rounded);
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
    return `${visibleSpaces(numberFormat(2).format(amount))}${NBSP}F${NBSP}CFA`;
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
