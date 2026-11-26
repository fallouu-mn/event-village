/**
 * Lot 11c-c — tables d'un événement : lecture des écrans (éditeur, pilotage, administration), aperçu du prix par personne
 * et copie des tables d'un événement précédent.
 *
 * Tout nombre de places, tout montant et toute règle viennent de la base (event_table_report, migration
 * 20261215000001) : la route ne fait que relayer la réponse. Seul l'aperçu du prix par personne, pendant la saisie d'un
 * prix pas encore enregistré, est calculé ici, côté serveur, avec la règle de la base (private.event_table_prices :
 * round(prix / places), exact si la division tombe juste).
 */
import { callLot5Rpc, type RpcBody } from '@/lib/events/pilotage.service';
import { callTables, isUuid, type DbReply } from '@/lib/event-tables/event-tables.server';

/** Lecture des tables d'un événement (pilotage_access : propriétaire, ou administration avec events.read). */
export async function readTablesReport(eventId: string, actorId: string): Promise<RpcBody> {
    return callLot5Rpc('event_table_report', { event_id: eventId, actor_id: actorId }, 'Lecture des tables impossible pour le moment.');
}

/** Bornes de l'aperçu : celles de la base (places 2 à 20) ; prix entier positif raisonnable. */
const PRICE_MAX = 100_000_000;

export interface PricePreview { price: number; seats: number; price_per_person: number; price_per_person_exact: boolean }

/**
 * Prix par personne d'une table, pour l'aperçu de la saisie : même règle que private.event_table_prices
 * (round(price / seats) de PostgreSQL, arrondi au plus proche, moitié vers le haut pour un nombre positif).
 * null si la saisie n'est pas un prix ou un nombre de places que la base accepterait.
 */
export function pricePerPerson(priceRaw: unknown, seatsRaw: unknown): PricePreview | null {
    const price = typeof priceRaw === 'string' && /^\d{1,9}$/.test(priceRaw.trim()) ? Number(priceRaw.trim()) : NaN;
    const seats = typeof seatsRaw === 'string' && /^\d{1,2}$/.test(seatsRaw.trim()) ? Number(seatsRaw.trim()) : NaN;
    if (!Number.isInteger(price) || price < 1 || price > PRICE_MAX) return null;
    if (!Number.isInteger(seats) || seats < 2 || seats > 20) return null;
    return { price, seats, price_per_person: Math.round(price / seats), price_per_person_exact: price % seats === 0 };
}

type Row = Record<string, unknown>;

export interface CopyOutcome { status: number; body: Row }

/** Statut HTTP d'un refus de la copie : introuvable 404, saisie 400, tout autre refus de la base 409 (texte tel quel). */
function copyRefusalStatus(code: string | undefined): number {
    if (code === 'EVENT_NOT_FOUND') return 404;
    if (code === 'INVALID_INPUT') return 400;
    return 409;
}

/**
 * Copie des types et des tables (numéros, positions, formes) d'un événement précédent de la MÊME organisatrice vers un
 * événement qui n'a encore aucun type de table. Contre-vérification 11c-c (T2, T3) : une seule fonction en base,
 * public.event_table_copy, en une transaction, sous le verrou de l'événement cible (vérification de la cible vide sous
 * ce verrou, propriété des deux événements, garde de la billetterie, jauge en places, interrupteur) ; au moindre refus,
 * rien n'est écrit et aucun avis ne part. Deux copies simultanées : la seconde reçoit TABLES_NOT_EMPTY. La route ne fait
 * que relayer la réponse.
 */
export async function copyTablesFrom(params: { userId: string; eventId: string; fromEventId: unknown }): Promise<CopyOutcome> {
    const { userId, eventId } = params;
    if (!isUuid(params.fromEventId) || params.fromEventId === eventId) {
        return { status: 400, body: { success: false, error: 'Choisissez un autre de vos événements.', code: 'INVALID_INPUT' } };
    }
    const reply: DbReply = await callTables('event_table_copy', { event_id: eventId, actor_id: userId, from_event_id: params.fromEventId });
    if (reply.ok !== true) {
        return { status: copyRefusalStatus(reply.code), body: { success: false, error: reply.message ?? 'Copie refusée.', code: reply.code ?? 'REFUSED' } };
    }
    return { status: 200, body: { success: true, types: Number(reply.types ?? 0), tables: Number(reply.tables ?? 0) } };
}
