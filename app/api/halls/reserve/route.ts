import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/halls/reserve
 * Crée une intention de réservation de salle avec calcul d'acompte et moratoire 48h (CDC V3)
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
            hallId: string;
            startDate: string;
            durationDays: number;
            clientId?: string;
        };

        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
        }

        const effectiveUserId = userId || body.clientId;
        if (!effectiveUserId) {
            return NextResponse.json({ error: 'Connexion requise pour réserver une salle.' }, { status: 401 });
        }

        const { hallId, startDate, durationDays } = body;
        if (!hallId || !startDate || !durationDays || durationDays <= 0) {
            return NextResponse.json({ error: 'Paramètres de réservation invalides.' }, { status: 400 });
        }

        // 1. Récupération de la salle
        const { data: hall, error: hallErr } = await supabase
            .from('halls')
            .select('*')
            .eq('id', hallId)
            .single();

        if (hallErr || !hall) {
            return NextResponse.json({ error: 'Salle introuvable.' }, { status: 404 });
        }

        // 2. Calcul des dates et des montants
        const start = new Date(startDate);
        const end = new Date(start);
        end.setDate(end.getDate() + (durationDays - 1));
        const endDateStr = end.toISOString().split('T')[0];

        const totalAmount = Number(hall.price_per_day) * durationDays;
        const depositRate = (hall.deposit_percentage || 30) / 100;
        const depositAmount = Math.round(totalAmount * depositRate);
        const balanceAmount = totalAmount - depositAmount;

        // Moratoire 48h
        const moratoriumDate = new Date();
        moratoriumDate.setDate(moratoriumDate.getDate() + 2);
        const moratoriumDateStr = moratoriumDate.toISOString().split('T')[0];

        // 3. Vérification de conflit de dates sur la salle
        const { data: conflicts } = await supabase
            .from('hall_reservations')
            .select('id')
            .eq('hall_id', hallId)
            .in('status', ['EN_ATTENTE', 'CONFIRMEE'])
            .lte('start_date', endDateStr)
            .gte('end_date', startDate);

        if (conflicts && conflicts.length > 0) {
            return NextResponse.json(
                { error: 'Cette salle est déjà réservée pour les dates sélectionnées.' },
                { status: 409 }
            );
        }

        // 4. Insertion de la réservation en base
        const { data: reservation, error: resErr } = await supabase
            .from('hall_reservations')
            .insert({
                hall_id: hallId,
                partner_id: hall.partner_id,
                client_id: effectiveUserId,
                start_date: startDate,
                end_date: endDateStr,
                total_amount: totalAmount,
                deposit_amount: depositAmount,
                balance_amount: balanceAmount,
                moratorium_date: moratoriumDateStr,
                status: 'EN_ATTENTE',
                payment_status: 'PENDING',
            })
            .select('*')
            .single();

        if (resErr || !reservation) {
            console.error('[API /api/halls/reserve] Erreur création réservation:', resErr);
            return NextResponse.json({ error: 'Impossible d\'enregistrer la réservation.' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            reservation: {
                id: reservation.id,
                totalAmount,
                depositAmount,
                balanceAmount,
                depositFormatted: `${depositAmount.toLocaleString('fr-FR')} FCFA`,
                totalFormatted: `${totalAmount.toLocaleString('fr-FR')} FCFA`,
                moratoriumDate: moratoriumDateStr,
            },
        });
    } catch (err: unknown) {
        console.error('[API /api/halls/reserve] Exception:', err);
        return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
    }
}
