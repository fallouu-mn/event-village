import { NextRequest, NextResponse } from 'next/server';
import { refuseUnlessCron } from '@/lib/security/cron-auth';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { sendHallRefunds } from '@/lib/halls/refunds';

export const dynamic = 'force-dynamic';

/**
 * GET or POST /api/cron/moratoriums — réservations de salle. Protégé par CRON_SECRET (refuseUnlessCron).
 * Lot 10a (S5, point 3) : tout se fait en base, par hall_reservations_tick (idempotente) :
 *  - réservations non payées dont l'attente (15 min) est échue : la date est rendue ;
 *  - solde non payé à son échéance (7 jours avant la date) : « Délai de paiement dépassé », réservation annulée,
 *    acompte remboursé selon la règle d'annulation de la salle, évaluée à l'instant de l'échéance ;
 *  - rappel du solde 3 jours avant son échéance (J-10 par défaut).
 * Les remboursements créés sont envoyés tout de suite (repris sinon par la tâche des versements).
 */
export async function GET(req: NextRequest) {
    return handleCron(req);
}

export async function POST(req: NextRequest) {
    return handleCron(req);
}

async function handleCron(req: NextRequest) {
    const refused = refuseUnlessCron(req);
    if (refused) return refused;
    try {
        const { data, error } = await getServiceRoleClient().rpc('hall_reservations_tick');
        if (error) throw new Error(error.message);
        const r = data as { expired_holds: number; deadline_passed: number; reminders: number; cashout_ids: string[] };
        await sendHallRefunds(r.cashout_ids);
        console.log(`[Cron Moratoriums] ${r.expired_holds} attente(s) échue(s), ${r.deadline_passed} délai(s) dépassé(s), ${r.reminders} rappel(s).`);
        return NextResponse.json({
            success: true,
            expiredHolds: r.expired_holds,
            deadlinePassed: r.deadline_passed,
            reminders: r.reminders,
            // Ancien champ de la réponse (lot 0), gardé pour la supervision : réservations libérées ou annulées
            expiredCount: r.expired_holds + r.deadline_passed,
        });
    } catch (err: unknown) {
        console.error('[Cron Moratoriums] erreur :', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Le traitement des réservations de salle a échoué.' }, { status: 500 });
    }
}
