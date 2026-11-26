/**
 * Lot 12c — repérage, pour l'écran de l'administration, des mots de la liste dans un texte : même règle que la base
 * (private.order_review_words) — minuscules, sans accents, mot entier ou pluriel en s ou x (« vin », « vins », pas
 * « vinaigrette »). Sert seulement à surligner : la décision « à vérifier » est prise en base.
 */

export interface TextPart { text: string; match: boolean }

/** Un caractère sans accent ni majuscule (œ → oe). */
function foldChar(c: string): string {
    const low = c.toLowerCase();
    if (low === 'œ') return 'oe';
    if (low === 'æ') return 'ae';
    if (low === 'ß') return 'ss';
    if (low === '’') return '\'';
    return low.normalize('NFD').replace(/\p{M}/gu, '');
}

export function foldText(s: string): string {
    return Array.from(s).map(foldChar).join('');
}

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Découpe un texte en morceaux, les mots de la liste trouvés marqués `match`. */
export function highlightWords(text: string, words: readonly string[]): TextPart[] {
    const chars = Array.from(text);
    let folded = '';
    const origin: number[] = [];
    chars.forEach((c, i) => {
        const f = foldChar(c);
        for (let k = 0; k < f.length; k += 1) origin.push(i);
        folded += f;
    });
    const keys = words.map((w) => foldText(w).trim()).filter((w) => /^[a-z0-9][a-z0-9 '-]*$/.test(w));
    if (keys.length === 0 || !text) return [{ text, match: false }];
    const re = new RegExp(`(^|[^a-z0-9])(${keys.map(escapeRegExp).join('|')})(s|x)?(?=[^a-z0-9]|$)`, 'g');
    const marked = new Array<boolean>(chars.length).fill(false);
    for (let m = re.exec(folded); m; m = re.exec(folded)) {
        const start = m.index + m[1].length;
        const end = m.index + m[0].length;
        for (let p = start; p < end; p += 1) marked[origin[p]] = true;
        if (m[0].length === 0) re.lastIndex += 1;
    }
    const parts: TextPart[] = [];
    chars.forEach((c, i) => {
        const last = parts[parts.length - 1];
        if (last && last.match === marked[i]) last.text += c;
        else parts.push({ text: c, match: marked[i] });
    });
    return parts;
}
