import { NextRequest, NextResponse } from 'next/server';
import { rpcWithRetry } from '@/lib/payments/rpc';
import { refuseUnlessCron } from '@/lib/security/cron-auth';

export const dynamic = 'force-dynamic';

/**
 * Lot 3.5 — commissions de parrainage arrivées à échéance : PENDING → AVAILABLE
 * (referral_commissions_release). Le grand livre les rend déjà disponibles à leur date ;
 * ce passage met le statut affiché en cohérence. Planification : une fois par heure
 * (docs/deploiement-projet-neuf.md §7). Protégée par CRON_SECRET (Authorization: Bearer).
 */
async function run(req: NextRequest) {
    const refused = refuseUnlessCron(req);
    if (refused) return refused;
    const { data, error } = await rpcWithRetry<{ released: number }>('referral_commissions_release', {});
    if (error) {
        console.error('[cron referral-commissions] libération impossible :', error.message);
        return NextResponse.json({ error: 'Libération des commissions impossible.' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, ...data });
}

export const GET = run;
export const POST = run;
