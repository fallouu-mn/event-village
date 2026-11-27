/**
 * Lot 12c — surlignage des mots trouvés sur l'écran de l'administration. Contre-vérification (T1) : les plages sont
 * calculées par le serveur (public.order_review_marks, même pliage que la décision « à vérifier » en base : accents,
 * caractères invisibles, lettres cyrilliques ou grecques, lettres séparées). Le navigateur ne fait que découper le texte
 * selon ces plages [début, fin), comptées en caractères (points de code) du texte d'origine.
 */

export interface TextPart { text: string; match: boolean }

/** Découpe un texte en morceaux, les plages servies par le serveur marquées `match` (plages hors du texte ignorées). */
export function splitMarked(text: string, ranges: ReadonlyArray<readonly [number, number]>): TextPart[] {
    const chars = Array.from(text);
    if (chars.length === 0 || ranges.length === 0) return [{ text, match: false }];
    const marked = new Array<boolean>(chars.length).fill(false);
    for (const [start, end] of ranges) {
        if (!Number.isInteger(start) || !Number.isInteger(end)) continue;
        for (let p = Math.max(0, start); p < Math.min(end, chars.length); p += 1) marked[p] = true;
    }
    const parts: TextPart[] = [];
    chars.forEach((c, i) => {
        const last = parts[parts.length - 1];
        if (last && last.match === marked[i]) last.text += c;
        else parts.push({ text: c, match: marked[i] });
    });
    return parts;
}
