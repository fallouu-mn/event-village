/**
 * Lot 11c-b — table d'un billet, pour « Mes billets » (GET /api/tickets) et la page de suivi d'un paiement.
 *
 * Une place de table est un billet relié à sa vente (tickets.event_table_booking_id). Pour chaque billet relié, le serveur
 * donne :
 *  - `label` : « Table 12 · Carré VIP » (zone de la table, sinon type), même texte que le badge du scanner
 *    (public.event_table_badge) ;
 *  - `bookingId` : identifiant de la vente, SEULEMENT si le compte qui lit est le titulaire (ouvre « Ma table ») ;
 *  - `invitedBy` : « Awa D. » (prénom et initiale du titulaire, même forme que private.event_table_person), SEULEMENT
 *    pour un invité (le billet est à un autre compte que le titulaire).
 * Rien d'autre du titulaire ni des autres invités n'est lu ni renvoyé. Lecture par la clé de service (route serveur),
 * après le contrôle de session de la route ; une erreur de lecture est levée (la route répond 500).
 */
import { getServiceRoleClient } from '@/lib/supabase/server';
import { callTables } from './event-tables.server';

export interface TicketTableInfo {
    label: string;
    bookingId: string | null;
    invitedBy: string | null;
}

interface BookingRow {
    id: string;
    holder_id: string;
    table_number: number;
    ticket_categories: { name: string | null } | null;
    event_tables: { event_zones: { name: string | null } | null } | null;
}

/** Prénom et initiale du nom (« Awa D. »), ou null si le compte n'a pas de prénom ni de nom. */
export function personShortName(firstName: unknown, lastName: unknown): string | null {
    const first = typeof firstName === 'string' ? firstName.trim() : '';
    const last = typeof lastName === 'string' ? lastName.trim() : '';
    const text = `${first}${last ? `${first ? ' ' : ''}${last.charAt(0).toLocaleUpperCase('fr-FR')}.` : ''}`.trim();
    return text || null;
}

/** Table de chaque billet relié à une vente de table (clé : identifiant du billet). */
export async function ticketTablesOf(
    readerId: string,
    tickets: ReadonlyArray<{ id: string; event_table_booking_id?: string | null }>,
): Promise<Map<string, TicketTableInfo>> {
    const out = new Map<string, TicketTableInfo>();
    const bookingIds = Array.from(new Set(tickets.map((t) => t.event_table_booking_id).filter((v): v is string => typeof v === 'string' && v.length > 0)));
    if (bookingIds.length === 0) return out;
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase
        .from('event_table_bookings')
        .select('id, holder_id, table_number, ticket_categories(name), event_tables(event_zones(name))')
        .in('id', bookingIds);
    if (error) throw new Error(`tables des billets : ${error.message}`);
    const bookings = new Map<string, BookingRow>();
    for (const row of (data ?? []) as unknown as BookingRow[]) bookings.set(String(row.id), row);

    const holderIds = Array.from(new Set(Array.from(bookings.values()).map((b) => String(b.holder_id)).filter((id) => id !== readerId)));
    const names = new Map<string, string | null>();
    if (holderIds.length > 0) {
        const { data: users, error: usersErr } = await supabase.from('users').select('id, first_name, last_name').in('id', holderIds);
        if (usersErr) throw new Error(`titulaires des tables : ${usersErr.message}`);
        for (const u of users ?? []) names.set(String(u.id), personShortName(u.first_name, u.last_name));
    }

    for (const t of tickets) {
        const booking = t.event_table_booking_id ? bookings.get(t.event_table_booking_id) : undefined;
        if (!booking) continue;
        const place = booking.event_tables?.event_zones?.name || booking.ticket_categories?.name || null;
        const holder = String(booking.holder_id);
        out.set(t.id, {
            label: `Table ${booking.table_number}${place ? ` · ${place}` : ''}`,
            bookingId: holder === readerId ? String(booking.id) : null,
            invitedBy: holder === readerId ? null : (names.get(holder) ?? null),
        });
    }
    return out;
}

/**
 * Contre-vérification du lot 11c-b (T2) — tables dont le compte est TITULAIRE, d'après les ventes (event_table_bookings
 * actives), même s'il a envoyé toutes ses places et n'a plus aucun billet de la table : Mes billets garde alors l'onglet
 * « Tables », et le remboursement ouvert par un report de plus de 24 h (fenêtre et montant de la base, event_table_mine)
 * reste annoncé. Rien d'autre n'est lu ; le compte est celui de la session de la route.
 */
export interface HolderTables {
    holder: boolean;
    held: Array<{ bookingId: string; eventId: string }>;
    refundOpen: Array<{ bookingId: string; eventId: string; eventTitle: string; amount: number; until: string | null }>;
}

export async function holderTablesOf(userId: string): Promise<HolderTables> {
    const { data, error } = await getServiceRoleClient()
        .from('event_table_bookings')
        .select('id, event_id')
        .eq('holder_id', userId)
        .eq('status', 'ACTIVE')
        .limit(200);
    if (error) throw new Error(`tables du titulaire : ${error.message}`);
    const held = (data ?? []).map((b) => ({ bookingId: String(b.id), eventId: String(b.event_id) }));
    if (held.length === 0) return { holder: false, held, refundOpen: [] };
    const mine = await callTables('event_table_mine', { actor_id: userId });
    if (mine.ok !== true || !Array.isArray(mine.items)) throw new Error(`event_table_mine : réponse inattendue ${JSON.stringify(mine).slice(0, 200)}`);
    const refundOpen = (mine.items as Array<Record<string, unknown>>).flatMap((item) => {
        const refund = (item.refund ?? null) as { open?: unknown; amount?: unknown; until?: unknown } | null;
        const event = (item.event ?? null) as { id?: unknown; title?: unknown } | null;
        if (item.status !== 'ACTIVE' || refund?.open !== true || !event) return [];
        const amount = Number(refund.amount);
        if (!Number.isFinite(amount)) return [];
        return [{
            bookingId: String(item.booking_id), eventId: String(event.id), eventTitle: String(event.title ?? ''), amount,
            until: typeof refund.until === 'string' ? refund.until : null,
        }];
    });
    return { holder: true, held, refundOpen };
}
