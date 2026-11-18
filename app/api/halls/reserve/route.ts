import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { requireActiveSession } from '@/lib/auth/session';
import { guardFeature } from '@/lib/features/flags';
import { apiFailure } from '@/lib/api/public-error';
import { bookingStateLabel, cancellationText, fcfa, refusalStatus, type CancellationTerms } from '@/lib/halls/booking';

export const dynamic = 'force-dynamic';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

/**
 * POST /api/halls/reserve — réserve une salle et tient la date le temps de payer (halls.hold_minutes, 15 min).
 * Lot 10a (S1 à S3) : une seule fonction en base, hall_reserve, vérifie la salle, son partenaire, la date et
 * l'absence de chevauchement, et calcule prix, frais, acompte et total ; le corps de la requête ne fixe aucun montant
 * (un montant envoyé est ignoré). Le client est toujours le compte de la session (lot 4.0).
 * Corps : { hallId, startDate (AAAA-MM-JJ), mode? « JOUR » (défaut) ou « HEURE », units? (jours ou heures),
 *           durationDays? (ancien nom de units à la journée), startTime? (HH:MM, à l'heure), notes? }.
 */
export async function POST(req: NextRequest) {
    try {
        const session = await requireActiveSession(req);
        if (session.response) return session.response;
        // Lot 7 (7.3, D56) : session d'abord, puis interrupteur (404 si le service est fermé)
        const closed = await guardFeature('halls', 'POST /api/halls/reserve');
        if (closed) return closed;

        let body: Record<string, unknown>;
        try {
            body = (await req.json()) as Record<string, unknown>;
        } catch {
            return NextResponse.json({ error: 'Demande illisible. Rechargez la page et réessayez.' }, { status: 400 });
        }
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return NextResponse.json({ error: 'Demande illisible. Rechargez la page et réessayez.' }, { status: 400 });
        }
        const mode = body.mode === 'HEURE' ? 'HEURE' : 'JOUR';
        const units = Number(body.units ?? body.durationDays);
        const startDate = typeof body.startDate === 'string' ? body.startDate : '';
        const startTime = typeof body.startTime === 'string' ? body.startTime : '';
        if (typeof body.hallId !== 'string' || !DATE.test(startDate) || !Number.isInteger(units)
            || (mode === 'HEURE' && !TIME.test(startTime))) {
            return NextResponse.json({ error: 'Choisissez la salle, la date et la durée de la réservation.' }, { status: 400 });
        }

        const { data, error } = await getServiceRoleClient().rpc('hall_reserve', {
            p: {
                client_id: session.user.id,
                hall_id: body.hallId,
                mode,
                start_date: startDate,
                units,
                start_time: mode === 'HEURE' ? startTime : null,
                notes: typeof body.notes === 'string' ? body.notes : null,
            },
        });
        if (error) throw new Error(`hall_reserve : ${error.message}`);
        const r = data as Record<string, unknown>;
        if (r?.ok !== true) {
            return NextResponse.json({ error: r?.message ?? 'Réservation impossible pour le moment.', code: r?.code }, { status: refusalStatus(r?.code) });
        }
        const terms = r.cancellation_terms as CancellationTerms;
        return NextResponse.json({
            success: true,
            reservation: {
                id: r.reservation_id,
                state: bookingStateLabel(r.booking_state),
                holdExpiresAt: r.hold_expires_at,
                startDate: r.start_date,
                endDate: r.end_date,
                startTime: r.start_time,
                endTime: r.end_time,
                priceAmount: Number(r.price_amount),
                serviceFee: Number(r.service_fee_amount),
                totalAmount: Number(r.total_amount),
                depositAmount: Number(r.deposit_amount),
                balanceAmount: Number(r.balance_amount),
                balanceDueAt: r.balance_due_at,
                fullPaymentRequired: r.full_payment_required === true,
                totalFormatted: fcfa(r.total_amount),
                depositFormatted: fcfa(r.deposit_amount),
                balanceFormatted: fcfa(r.balance_amount),
                cancellation: cancellationText(terms),
            },
        });
    } catch (err: unknown) {
        return apiFailure('POST /api/halls/reserve', err, { message: 'Réservation non enregistrée. Réessayez.', code: 'HALL_RESERVATION_SAVE_FAILED' });
    }
}
