import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/restaurants/reserve-table
 * Crée une réservation de table en base avec gestion d'acompte
 */
export async function POST(req: NextRequest) {
    try {
        const supabase = getServiceRoleClient();
        const authHeader = req.headers.get('authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

        let userId: string | null = null;
        if (token) {
            const { data: { user } } = await supabase.auth.getUser(token);
            userId = user?.id || null;
        }

        let body: {
            partnerId: string;
            tableId?: string;
            zoneId?: string;
            reservationDate: string;
            reservationTime: string;
            guestCount: number;
            isPlatformPayment: boolean;
            clientId?: string;
        };

        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
        }

        const effectiveUserId = userId || body.clientId;
        if (!effectiveUserId) {
            return NextResponse.json({ error: 'Connexion requise pour réserver une table.' }, { status: 401 });
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
                client_id: effectiveUserId,
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
