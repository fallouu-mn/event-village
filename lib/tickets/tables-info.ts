/**
 * Contre-vérification du lot 11c-b (T2) — tables dont le compte est titulaire, servies par GET /api/tickets d'après les
 * ventes (même s'il a envoyé toutes ses places et n'a plus aucun billet de la table), et remboursements ouverts par un
 * report de plus de 24 h (montant de la base). Lu par la page serveur de Mes billets et par sa vue ; une valeur hors
 * contrat donne « aucune table » (jamais une valeur inventée).
 */
export interface MyTablesInfo { holder: boolean; refundOpen: Array<{ bookingId: string; eventTitle: string; amount: number }> }

export function readTablesInfo(value: unknown): MyTablesInfo | null {
    if (typeof value !== 'object' || value === null) return null;
    const v = value as { holder?: unknown; refundOpen?: unknown };
    const refundOpen = Array.isArray(v.refundOpen) ? v.refundOpen.flatMap((raw: unknown) => {
        const r = (typeof raw === 'object' && raw !== null ? raw : {}) as { bookingId?: unknown; eventTitle?: unknown; amount?: unknown };
        return typeof r.bookingId === 'string' && typeof r.eventTitle === 'string' && typeof r.amount === 'number'
            ? [{ bookingId: r.bookingId, eventTitle: r.eventTitle, amount: r.amount }] : [];
    }) : [];
    return { holder: v.holder === true, refundOpen };
}
