/**
 * Lot 11c-b — résumé de l'offre de tables pour la fiche publique d'un événement (page serveur, mise en cache 60 s).
 *
 * La bascule « Billets | Tables » n'apparaît que si le service est ouvert (features.event_tables_enabled) et qu'au moins un
 * type de table est en vente : event_table_offer répond `open` vrai avec des types. Le résumé ne contient que le nombre de
 * types et le plus petit prix d'une table, lus en base ; tout le reste (prix, frais, tables restantes, plan) est relu par
 * l'onglet « Tables » à son ouverture (GET /api/events/[id]/tables).
 *
 * Cache : même cache de données que la fiche (`unstable_cache`, 60 s, étiquette `fiche-publique`, invalidée par les routes
 * des tables de l'organisatrice et par l'achat d'une table). Sans lui, la lecture en base (sans cache) rendait la page
 * dynamique alors qu'elle est préparée une fois et resservie : erreur 500 de la fiche (run 694, « Page changed from static
 * to dynamic at runtime »). Une panne lève DANS la fonction mise en cache (rien n'est gardé), est journalisée, et la fiche
 * s'affiche sans l'onglet : un service facultatif ne doit pas faire tomber la fiche.
 */
import { unstable_cache } from 'next/cache';
import { callTables } from './event-tables.server';

export interface TablesSummary {
    types: number;
    fromPrice: number;
}

async function readSummary(eventId: string): Promise<TablesSummary | null> {
    const offer = await callTables('event_table_offer', { event_id: eventId });
    if (offer.ok !== true || offer.open !== true || !Array.isArray(offer.types) || offer.types.length === 0) return null;
    const prices = (offer.types as Array<Record<string, unknown>>).map((t) => Number(t.price)).filter((p) => Number.isFinite(p) && p > 0);
    if (prices.length === 0) return null;
    return { types: offer.types.length, fromPrice: Math.min(...prices) };
}

const cachedSummary = unstable_cache(readSummary, ['fiche-tables-v1'], { revalidate: 60, tags: ['fiche-publique'] });

/** Hors du serveur Next (tests en Node), le cache de données n'existe pas : lecture directe, même résultat. */
function isMissingIncrementalCache(err: unknown): boolean {
    return err instanceof Error && err.message.includes('incrementalCache missing');
}

export async function readTablesSummary(eventId: string): Promise<TablesSummary | null> {
    try {
        try {
            return await cachedSummary(eventId);
        } catch (err) {
            if (!isMissingIncrementalCache(err)) throw err;
            return await readSummary(eventId);
        }
    } catch (err) {
        console.error('[fiche] offre de tables illisible : onglet « Tables » non affiché :', err instanceof Error ? err.message : String(err));
        return null;
    }
}
