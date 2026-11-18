import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { guardFeature } from '@/lib/features/flags';
import { refusalStatus, tableCancellationText, tableStateLabel } from '@/lib/tables/booking';

export const dynamic = 'force-dynamic';

/**
 * POST /api/restaurants/reserve-table { venueId, date, time, guests, tableId?, zoneId?, notes? }
 * Lot 4.0 : session ACTIVE obligatoire ; le client est toujours le compte de la session.
 * Lot 11a (T1, T2, T3, T5, T6) : une seule fonction en base, table_reserve, fait tout sous le verrou de
 * l'établissement : établissement validé et partenaire VALIDE, table de cet établissement et de la bonne capacité (ou
 * la plus petite libre qui convient), date à venir, horaires d'ouverture, aucun chevauchement, demandes en attente
 * limitées, acompte et frais calculés en base. Aucun montant n'est lu dans le corps ; la table ou la zone choisie
 * n'est qu'un choix, vérifié par la base.
 */
export async function POST(req: NextRequest) {
    try {
        const session = await requireActiveSession(req);
        if (session.response) return session.response;
        // Lot 7 (7.3, D56) : session d'abord, puis interrupteur (404 si le service est fermé)
        const closed = await guardFeature('tables', 'POST /api/restaurants/reserve-table');
        if (closed) return closed;

        let body: Record<string, unknown>;
        try {
            body = (await req.json()) as Record<string, unknown>;
        } catch {
            return NextResponse.json({ error: 'Demande illisible. Réessayez.', code: 'INVALID_BODY' }, { status: 400 });
        }
        const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

        const { data, error } = await getServiceRoleClient().rpc('table_reserve', {
            p: {
                client_id: session.user.id,
                venue_id: text(body.venueId),
                date: text(body.date),
                time: text(body.time),
                guests: typeof body.guests === 'number' || typeof body.guests === 'string' ? body.guests : null,
                table_id: text(body.tableId),
                zone_id: text(body.zoneId),
                notes: text(body.notes),
            },
        });
        if (error) throw new Error(`table_reserve : ${error.message}`);
        const r = data as Record<string, unknown>;
        if (r?.ok !== true) {
            return NextResponse.json({ error: r?.message ?? 'Réservation impossible pour le moment.', code: r?.code }, { status: refusalStatus(r?.code) });
        }
        return NextResponse.json({
            success: true,
            reservation: {
                id: r.reservation_id,
                state: tableStateLabel(r.booking_state),
                venueName: r.venue_name,
                tableNumber: r.table_number,
                guests: r.guests,
                date: r.date,
                time: r.time,
                endTime: r.end_time,
                depositAmount: Number(r.deposit_amount),
                serviceFee: Number(r.service_fee_amount),
                totalToPay: Number(r.total_amount),
                holdExpiresAt: r.hold_expires_at ?? null,
                responseDueAt: r.response_due_at ?? null,
                cancellation: tableCancellationText(r.deposit_amount, r.cancel_free_hours),
            },
        });
    } catch (err: unknown) {
        return apiFailure('POST /api/restaurants/reserve-table', err, { message: 'Réservation impossible pour le moment. Réessayez.', code: 'TABLE_RESERVE_FAILED' });
    }
}
