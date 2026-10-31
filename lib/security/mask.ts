/**
 * Lot 1C.1 — nom du titulaire d'un compte partiellement masqué, pour qu'un partenaire confirme
 * une affectation sans découvrir l'identité complète d'un tiers.
 * « Fatou Ndiaye » → « Fa*** N*** » (graphèmes, accents compris).
 */
export function maskPersonName(firstName: string | null | undefined, lastName: string | null | undefined): string {
    const first = Array.from((firstName ?? '').trim());
    const last = Array.from((lastName ?? '').trim());
    if (first.length === 0 && last.length === 0) return 'Titulaire du compte';
    const parts: string[] = [];
    if (first.length) parts.push(`${first.slice(0, 2).join('')}***`);
    if (last.length) parts.push(`${last[0]}***`);
    return parts.join(' ');
}
