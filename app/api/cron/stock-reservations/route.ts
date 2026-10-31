import { NextRequest, NextResponse } from 'next/server';
import { rpcWithRetry } from '@/lib/payments/rpc';
import { refuseUnlessCron } from '@/lib/security/cron-auth';

export const dynamic = 'force-dynamic';

/**
 * Lot 2.4 — purge des réservations de stock échues (stock_reservations_expire).
 * Planification : toutes les 5 minutes (vercel.json, ou pg_cron + pg_net, voir
 * docs/deploiement-projet-neuf.md). Protégée par CRON_SECRET (Authorization: Bearer).
 */
async function run(req: NextRequest) {
    const refused = refuseUnlessCron(req);
    if (refused) return refused;
    const { data, error } = await rpcWithRetry<{ expired: number }>('stock_reservations_expire', {});
    if (error) {
        console.error('[cron stock-reservations] purge impossible :', error.message);
        return NextResponse.json({ error: 'Purge impossible.' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, ...data });
}

export const GET = run;
export const POST = run;
