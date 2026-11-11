/**
 * Lot 6 (contrat F2.1, F2.2) — formats des SMS, partagés par tous les modèles du catalogue.
 *
 * Un SMS GSM-7 tient en 160 septets ; un seul caractère hors de l'alphabet GSM 03.38 fait passer tout
 * le message en UCS-2 (70 caractères, 67 par segment ensuite). Les textes fixes des modèles n'utilisent
 * donc que l'alphabet GSM-7 de base (é è à ù ì ò É Ç admis ; « » ’ ° ç ê â ô î û ï ë œ et les espaces
 * insécables interdits), et chaque valeur saisie (titre, lieu, nom, motif…) passe par smsVar :
 * translittération vers GSM-7, caractère hors GSM-7 retiré (lot 9 bis, R27), espaces repliés, troncature avec « ... ».
 *
 * Dates à l'heure de Dakar (UTC+0 toute l'année) : « sam. 15 nov. à 20:00 » ; montants avec une espace
 * SIMPLE entre les milliers (« 5 000 F CFA ») : l'insécable U+00A0 n'existe pas en GSM-7. L'in-app, le
 * push et l'email gardent lib/format.ts (insécable U+00A0).
 */

const DAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'] as const;
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'aout', 'sept.', 'oct.', 'nov.', 'déc.'] as const;

/** Alphabet GSM-7 de base (GSM 03.38), sans le caractère d'échappement 0x1B. */
export const GSM7_BASIC = new Set(Array.from(
    '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
));
/** Table d'extension GSM-7 : chaque caractère coûte deux septets (échappement + code). */
export const GSM7_EXTENSION = new Set(Array.from('\f^{}\\[~]|€'));

export class SmsFormatError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SmsFormatError';
    }
}

function toDate(value: string | Date): Date {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) throw new SmsFormatError(`Date illisible pour un SMS : ${JSON.stringify(value)}`);
    return d;
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Heure à Dakar : « 20:00 ». Africa/Dakar = UTC+0 sans heure d'été : l'heure UTC est l'heure locale. */
export function smsTime(value: string | Date): string {
    const d = toDate(value);
    return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

/** Date courte à Dakar : « 15 nov. à 20:00 ». */
export function smsShortDateTime(value: string | Date): string {
    const d = toDate(value);
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} à ${smsTime(d)}`;
}

/** Date avec le jour à Dakar : « sam. 15 nov. à 20:00 » (21 caractères au plus). */
export function smsDateTime(value: string | Date): string {
    const d = toDate(value);
    return `${DAYS[d.getUTCDay()]} ${smsShortDateTime(d)}`;
}

/** Montant en francs CFA entiers, espace simple entre les milliers : « 5 000 F CFA ». */
export function smsAmount(amount: number): string {
    if (typeof amount !== 'number' || !Number.isFinite(amount)) throw new SmsFormatError(`Montant illisible pour un SMS : ${JSON.stringify(amount)}`);
    const n = Math.round(amount);
    const digits = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${n < 0 ? '-' : ''}${digits} F CFA`;
}

export interface SmsMeasure {
    encoding: 'GSM7' | 'UCS2';
    /** GSM-7 : septets ; UCS-2 : unités UTF-16. */
    length: number;
    segments: number;
}

/** Encodage, longueur et nombre de segments d'un SMS (GSM 03.38 ; 153 et 67 par segment au-delà d'un). */
export function smsSegments(text: string): SmsMeasure {
    let septets = 0;
    for (const ch of Array.from(text)) {
        if (GSM7_BASIC.has(ch)) septets += 1;
        else if (GSM7_EXTENSION.has(ch)) septets += 2;
        else {
            const units = text.length;
            return { encoding: 'UCS2', length: units, segments: units <= 70 ? 1 : Math.ceil(units / 67) };
        }
    }
    return { encoding: 'GSM7', length: septets, segments: septets <= 160 ? 1 : Math.ceil(septets / 153) };
}

/**
 * Translittération vers l'alphabet GSM-7 de base des caractères courants en français et dans les saisies
 * (lettres accentuées absentes de l'alphabet, guillemets et apostrophes typographiques, tirets, points de
 * suspension, espaces insécables). Les lettres présentes dans l'alphabet (é è à ù ì ò É Ç ä ö ñ ü…) sont
 * gardées ; lot 9 bis (R27) : un caractère d'une autre écriture ou un émoji est retiré par smsVar (avant : gardé,
 * le SMS partait en UCS-2 sur plusieurs segments).
 */
const TRANSLITERATION: Readonly<Record<string, string>> = {
    'ê': 'e', 'ë': 'e', 'ē': 'e', 'ę': 'e', 'ė': 'e',
    'â': 'a', 'á': 'a', 'ã': 'a', 'ā': 'a', 'ą': 'a',
    'î': 'i', 'ï': 'i', 'í': 'i', 'ī': 'i',
    'ô': 'o', 'ó': 'o', 'õ': 'o', 'ō': 'o',
    'û': 'u', 'ú': 'u', 'ū': 'u',
    'ç': 'c', 'ć': 'c', 'č': 'c',
    'ÿ': 'y', 'ý': 'y',
    'œ': 'oe', 'Œ': 'OE',
    'À': 'A', 'Â': 'A', 'Á': 'A', 'Ã': 'A',
    'È': 'E', 'Ê': 'E', 'Ë': 'E',
    'Ì': 'I', 'Î': 'I', 'Ï': 'I', 'Í': 'I',
    'Ò': 'O', 'Ô': 'O', 'Ó': 'O', 'Õ': 'O',
    'Ù': 'U', 'Û': 'U', 'Ú': 'U',
    'Ÿ': 'Y', 'Ý': 'Y',
    'ş': 's', 'š': 's', 'Š': 'S', 'ž': 'z', 'Ž': 'Z',
    // Lot 9 bis (R27) : lettres du wolof et des langues nationales.
    'ŋ': 'n', 'Ŋ': 'N',
    '«': '"', '»': '"', '“': '"', '”': '"', '„': '"', '‟': '"',
    '’': '\'', '‘': '\'', '‚': '\'', '‛': '\'', '′': '\'', '`': '\'', '´': '\'',
    '°': 'o', 'º': 'o', 'ª': 'a',
    '–': '-', '—': '-', '‑': '-', '‐': '-', '−': '-',
    '…': '...',
    ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', '\t': ' ',
    '•': '-', '·': '-',
};

/** Caractères invisibles retirés d'une saisie (espaces de largeur nulle, marque d'ordre des octets). */
const INVISIBLE_RE = /[​-‍⁠﻿]/g;

function septetsOf(ch: string): number {
    return GSM7_EXTENSION.has(ch) ? 2 : 1;
}

/** Caractère gardé dans une valeur de SMS : alphabet GSM-7 de base ou d'extension, ou espace (replié ensuite). */
function keptInSms(ch: string): boolean {
    return GSM7_BASIC.has(ch) || GSM7_EXTENSION.has(ch) || /\s/.test(ch);
}

/**
 * Valeur saisie prête pour un SMS : translittérée vers GSM-7, puis (lot 9 bis, R27) tout caractère resté hors de
 * l'alphabet GSM-7 (émoji, autre écriture) est retiré, pour que le SMS reste en GSM-7 et sur un segment ; espaces
 * repliés et rognés, puis troncature pour tenir en `max` septets, « ... » compris. SMS seulement : l'in-app, le push
 * et l'email gardent la valeur saisie.
 */
export function smsVar(value: string, max: number): string {
    if (!Number.isInteger(max) || max < 4) throw new SmsFormatError(`smsVar : longueur maximale invalide (${max})`);
    const chars = Array.from(String(value).replace(INVISIBLE_RE, '')).map((c) => TRANSLITERATION[c] ?? c);
    const text = Array.from(chars.join('')).filter(keptInSms).join('').replace(/\s+/g, ' ').trim();
    const all = Array.from(text);
    const total = all.reduce((n, c) => n + septetsOf(c), 0);
    if (total <= max) return text;
    const budget = max - 3;
    let used = 0;
    let out = '';
    for (const c of all) {
        const cost = septetsOf(c);
        if (used + cost > budget) break;
        out += c;
        used += cost;
    }
    return `${out.trimEnd()}...`;
}
