import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { requireActiveSession } from '@/lib/auth/session';
import { guardFeature } from '@/lib/features/flags';

export const dynamic = 'force-dynamic';

/**
 * POST /api/restaurants/reserve-table
 * Crée une réservation de table en base avec gestion d'acompte.
 * Lot 4.0 : session ACTIVE obligatoire (401 sans session, 403 compte non actif) ; le client est
 * toujours le compte de la session, un `clientId` envoyé dans le corps est ignoré.
 * Point ouvert (hors lot 4.0) : `tableId` n'est pas rapproché de `partnerId`, aucun contrôle de
 * conflit ni de capacité, et une réservation hors plateforme passe SUCCESS sans encaissement.
 */
export async function POST(req: NextRequest) {
    try {
        const session = await requireActiveSession(req);
        if (session.response) return session.response;
        // Lot 7 (7.3, D56) : session d'abord, puis interrupteur (404 si le service est fermé)
        const closed = await guardFeature('tables', 'POST /api/restaurants/reserve-table');
        if (closed) return closed;
        const clientId = session.user.id;
        const supabase = getServiceRoleClient();

        let body: {
            partnerId: string;
            tableId?: string;
            zoneId?: string;
            reservationDate: string;
            reservationTime: string;
            guestCount: number;
            isPlatformPayment: boolean;
        };

        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
        }

        const { partnerId, reservationDate, reservationTime, guestCount, isPlatformPayment } = body;
        if (!partnerId || !reservationDate || !reservationTime || !guestCount || guestCount <= 0) {
            return NextResponse.json({ error: 'Paramètres de réservation invalides.' }, { status: 400 });
        }

        // 1. Trouver une table disponible pour ce partenaire
        let selectedTableId = body.tableId;
        if (!selectedTableId) {
            const { data: availableTable } = await supabase
                .from('restaurant_tables')
                .select('id')
                .eq('partner_id', partnerId)
                .gte('capacity', guestCount)
                .eq('is_active', true)
                .limit(1)
                .maybeSingle();

            if (availableTable) {
                selectedTableId = availableTable.id;
            } else {
                // Fallback n'importe quelle table active du partenaire
                const { data: anyTable } = await supabase
                    .from('restaurant_tables')
                    .select('id')
                    .eq('partner_id', partnerId)
                    .eq('is_active', true)
                    .limit(1)
                    .maybeSingle();

                if (anyTable) {
                    selectedTableId = anyTable.id;
                }
            }
        }

        const depositPerPerson = 5000;
        const depositAmount = isPlatformPayment ? depositPerPerson * guestCount : 0;

        // 2. Insertion de la réservation de table
        const { data: reservation, error: resErr } = await supabase
            .from('table_reservations')
            .insert({
                partner_id: partnerId,
                table_id: selectedTableId || null,
                client_id: clientId,
                reservation_date: reservationDate,
                reservation_time: reservationTime,
                guest_count: guestCount,
                deposit_amount: depositAmount,
                status: 'EN_ATTENTE',
                payment_status: isPlatformPayment ? 'PENDING' : 'SUCCESS',
            })
            .select('*')
            .single();

        if (resErr || !reservation) {
            console.error('[API /api/restaurants/reserve-table] Erreur insertion:', resErr);
            return NextResponse.json({ error: 'Impossible d\'enregistrer la réservation.' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            reservation: {
                id: reservation.id,
                depositAmount,
                depositFormatted: `${depositAmount.toLocaleString('fr-FR')} FCFA`,
                guestCount,
                reservationDate,
                reservationTime,
            },
        });
    } catch (err: unknown) {
        console.error('[API /api/restaurants/reserve-table] Exception:', err);
        return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
    }
}
