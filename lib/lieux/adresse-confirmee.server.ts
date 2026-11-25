import { getServiceRoleClient } from '@/lib/supabase/server';

/**
 * Lot Carte B3 — adresse exacte d'un lieu dans l'avis de confirmation d'une réservation (décision du client du 21/11 :
 * l'adresse exacte n'est donnée qu'après une réservation confirmée, et seulement à cette cliente).
 *
 * Lue au moment de l'envoi (pas à la mise en file) : si la réservation n'est plus confirmée (annulée entre-temps), ou
 * si l'avis ne s'adresse pas à la cliente de la réservation, aucune adresse. Seuls les avis de confirmation
 * (HALL_RESERVATION_CONFIRMED, TABLE_RESERVATION_CONFIRMED) et les canaux lus par la cliente seule (application, email,
 * notification) la reçoivent ; le SMS garde son texte court (lien vers la réservation, où l'adresse est donnée).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** États confirmés (mêmes listes que lib/halls/queries.ts et lib/tables/queries.ts). */
const CONFIRMED: Readonly<Record<string, { table: string; place: string; key: string; states: readonly string[] }>> = {
    HALL_RESERVATION_CONFIRMED: { table: 'hall_reservations', place: 'halls', key: 'hall_id', states: ['ACOMPTE_PAYE', 'PAYEE'] },
    TABLE_RESERVATION_CONFIRMED: { table: 'table_reservations', place: 'venues', key: 'venue_id', states: ['CONFIRMEE', 'ARRIVEE'] },
};

export const ADDRESS_CHANNELS: readonly string[] = ['IN_APP', 'EMAIL', 'PUSH'];

/** Vrai pour un avis qui peut porter l'adresse (type et canal). */
export function carriesPlaceAddress(type: string, channel: string): boolean {
    return type in CONFIRMED && ADDRESS_CHANNELS.includes(channel);
}

/**
 * Adresse à ajouter à l'avis, ou null (réservation absente, plus confirmée, d'une autre cliente, lieu sans adresse).
 * Lève en cas de panne de lecture (l'appelant décide).
 */
export async function confirmedPlaceAddress(type: string, reservationId: unknown, recipientUserId: string | null): Promise<string | null> {
    const spec = CONFIRMED[type];
    if (!spec || typeof reservationId !== 'string' || !UUID_RE.test(reservationId) || !recipientUserId) return null;
    const supabase = getServiceRoleClient();
    const { data: r, error } = await supabase.from(spec.table).select(`client_id, booking_state, ${spec.key}`).eq('id', reservationId).maybeSingle();
    if (error) throw new Error(`réservation ${reservationId} illisible : ${error.message}`);
    const row = (r ?? null) as Record<string, unknown> | null;
    if (!row || row.client_id !== recipientUserId || !spec.states.includes(String(row.booking_state))) return null;
    const { data: place, error: placeErr } = await supabase.from(spec.place).select('address').eq('id', String(row[spec.key])).maybeSingle();
    if (placeErr) throw new Error(`lieu de la réservation ${reservationId} illisible : ${placeErr.message}`);
    const address = (place as { address?: unknown } | null)?.address;
    return typeof address === 'string' && address.trim().length > 0 ? address.trim().slice(0, 300) : null;
}
