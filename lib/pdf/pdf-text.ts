/**
 * Lot 9 bis, tâche 41 (R77 ; contrat 5.41, D-txt 2) — texte d'un PDF écrit à la main (police Helvetica, encodage
 * WinAnsi), une seule fonction pour le billet et le rapport de clôture.
 *
 * Le document est assemblé puis écrit en latin1 : tout caractère jusqu'à U+00FF (é, è, à, ç, É, Ô, «, »…) y garde son
 * octet, qui est aussi celui de WinAnsi. Seuls les caractères au-delà sont ramenés à une forme lisible (’ → ', … → ...,
 * œ → oe) ; ce qui reste au-delà de U+00FF devient « ? » au lieu d'un octet tronqué. Les caractères de contrôle C1
 * (U+0080 à U+009F, glyphes différents en WinAnsi) et les sauts de ligne sont remplacés aussi. Les parenthèses et la
 * barre oblique inverse sont échappées (chaîne PDF entre parenthèses).
 */

const REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
    [/[   - ]/g, ' '],
    [/[\r\n\t]+/g, ' '],
    [/[‘’‚′]/g, '\''],
    [/[“”„″]/g, '"'],
    [/[‐‑‒–−]/g, '-'],
    [/[—―]/g, '--'],
    [/…/g, '...'],
    [/œ/g, 'oe'],
    [/Œ/g, 'OE'],
    [/€/g, 'EUR'],
];

/** Chaîne prête à placer entre parenthèses dans un opérateur Tj d'un PDF WinAnsi. */
export function pdfText(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return '';
    let s = String(value);
    for (const [re, to] of REPLACEMENTS) s = s.replace(re, to);
    // Un caractère par point de code (un emoji donne un seul « ? »).
    s = Array.from(s, (ch) => {
        const cp = ch.codePointAt(0) ?? 0;
        return cp > 0xff || (cp >= 0x80 && cp <= 0x9f) ? '?' : ch;
    }).join('');
    return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/** Montant en francs CFA pour un PDF (séparateurs de milliers en espaces simples), suffixe « F CFA » par défaut. */
export function pdfAmount(n: number, suffix = 'F CFA'): string {
    return pdfText(`${n.toLocaleString('fr-FR')} ${suffix}`);
}
