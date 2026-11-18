import { NextRequest, NextResponse } from 'next/server';
import { refuseUnlessCron } from '@/lib/security/cron-auth';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { sendTableRefunds } from '@/lib/tables/refunds';

export const dynamic = 'force-dynamic';

/**
 * GET or POST /api/cron/tables — réservations de table, toutes les 5 minutes. Protégé par CRON_SECRET
 * (refuseUnlessCron). Lot 11a (T5) : tout se fait en base, par table_reservations_tick (idempotente) :
 *  - acompte non payé à la fin de l'attente (15 min) : la table est rendue, le client prévenu ;
 *  - demande sans réponse de l'établissement dans le délai (2 h, sans dépasser l'heure) : annulée, tout rendu ;
 *  - client absent 30 minutes après l'heure : « Absent », table libérée, acompte gardé par l'établissement ;
 *  - rappel au client 3 h avant l'heure.
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
        const { data, error } = await getServiceRoleClient().rpc('table_reservations_tick');
        if (error) throw new Error(error.message);
        const r = data as { expired_holds: number; unanswered: number; no_shows: number; reminders: number; cashout_ids: string[] };
        await sendTableRefunds(r.cashout_ids);
        console.log(`[Cron Tables] ${r.expired_holds} attente(s) échue(s), ${r.unanswered} demande(s) sans réponse, ${r.no_shows} absence(s), ${r.reminders} rappel(s).`);
        return NextResponse.json({
            success: true, expiredHolds: r.expired_holds, unanswered: r.unanswered, noShows: r.no_shows, reminders: r.reminders,
        });
    } catch (err: unknown) {
        console.error('[Cron Tables] erreur :', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Le traitement des réservations de table a échoué.' }, { status: 500 });
    }
}
