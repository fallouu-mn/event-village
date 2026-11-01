import { NextRequest, NextResponse } from 'next/server';
import { refuseUnlessCron } from '@/lib/security/cron-auth';
import { paymentService } from '@/lib/payments/payment.service';

export const dynamic = 'force-dynamic';

/**
 * GET or POST /api/cron/moratoriums
 * Expiration des moratoires de 48 h dépassés. Protégé par CRON_SECRET (refuseUnlessCron), sans repli
 * sur une autre clé.
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
        const result = await paymentService.expireOverdueMoratoriums();
        console.log(`[Cron Moratoriums] ${result.expiredCount} réservation(s) expirée(s).`);
        return NextResponse.json({
            success: true,
            message: `Traitement terminé. ${result.expiredCount} réservation(s) expirée(s).`,
            expiredCount: result.expiredCount,
            reservationIds: result.reservationIds,
        });
    } catch (err: unknown) {
        console.error('[Cron Moratoriums] erreur :', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Erreur lors de l’expiration des moratoires.' }, { status: 500 });
    }
}
