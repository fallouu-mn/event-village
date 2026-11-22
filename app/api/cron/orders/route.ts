import { NextRequest, NextResponse } from 'next/server';
import { refuseUnlessCron } from '@/lib/security/cron-auth';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { sendOrderRefunds } from '@/lib/orders/booking';

export const dynamic = 'force-dynamic';

/**
 * GET or POST /api/cron/orders — commandes, toutes les 5 minutes (tâche ev_orders). Protégé par CRON_SECRET
 * (refuseUnlessCron). Lot 12a : tout se fait en base, par order_tick (idempotente, rejouable en parallèle sous les
 * verrous des établissements) :
 *  - commande non payée à la fin de l'attente (15 min) : close, produits et portions rendus, client prévenu ;
 *  - commande sans réponse de la partenaire dans le délai (15 min) : annulée, tout rendu ;
 *  - commande prête à retirer : client prévenu 2 h avant la clôture, puis close sans remboursement 24 h après l'heure
 *    prévue ;
 *  - adresse, téléphone et consignes du client masqués 7 jours après la remise (ou la fin de la commande).
 * Les remboursements créés sont envoyés tout de suite (repris sinon par la tâche des versements, qui ne relance jamais un
 * versement incertain).
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
        const { data, error } = await getServiceRoleClient().rpc('order_tick');
        if (error) throw new Error(error.message);
        const r = data as { expired_holds: number; unanswered: number; pickup_warnings: number; not_collected: number; contacts_masked: number; cashout_ids: string[] };
        await sendOrderRefunds(r.cashout_ids);
        console.log(`[Cron Commandes] ${r.expired_holds} attente(s) échue(s), ${r.unanswered} sans réponse, ${r.pickup_warnings} rappel(s) de retrait, ${r.not_collected} non retirée(s), ${r.contacts_masked} coordonnée(s) masquée(s).`);
        return NextResponse.json({
            success: true, expiredHolds: r.expired_holds, unanswered: r.unanswered, pickupWarnings: r.pickup_warnings,
            notCollected: r.not_collected, contactsMasked: r.contacts_masked,
        });
    } catch (err: unknown) {
        console.error('[Cron Commandes] erreur :', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Le traitement des commandes a échoué.' }, { status: 500 });
    }
}
