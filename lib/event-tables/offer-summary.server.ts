/**
 * Lot 11c-b — résumé de l'offre de tables pour la fiche publique d'un événement (page serveur, mise en cache 60 s).
 *
 * La bascule « Billets | Tables » n'apparaît que si le service est ouvert (features.event_tables_enabled) et qu'au moins un
 * type de table est en vente : event_table_offer répond `open` vrai avec des types. Le résumé ne contient que le nombre de
 * types et le plus petit prix d'une table, lus en base ; tout le reste (prix, frais, tables restantes, plan) est relu par
 * l'onglet « Tables » à son ouverture (GET /api/events/[id]/tables). Une panne de lecture est journalisée et la fiche
 * s'affiche sans l'onglet (la billetterie reste) : un service facultatif ne doit pas faire tomber la fiche.
 */
import { callTables } from './event-tables.server';

export interface TablesSummary {
    types: number;
    fromPrice: number;
}

export async function readTablesSummary(eventId: string): Promise<TablesSummary | null> {
    try {
        const offer = await callTables('event_table_offer', { event_id: eventId });
        if (offer.ok !== true || offer.open !== true || !Array.isArray(offer.types) || offer.types.length === 0) return null;
        const prices = (offer.types as Array<Record<string, unknown>>).map((t) => Number(t.price)).filter((p) => Number.isFinite(p) && p > 0);
        if (prices.length === 0) return null;
        return { types: offer.types.length, fromPrice: Math.min(...prices) };
    } catch (err) {
        console.error('[fiche] offre de tables illisible : onglet « Tables » non affiché :', err instanceof Error ? err.message : String(err));
        return null;
    }
}
