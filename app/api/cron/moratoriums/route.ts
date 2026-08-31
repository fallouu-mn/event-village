import { NextRequest, NextResponse } from 'next/server';
import { paymentService } from '@/lib/payments/payment.service';

export const dynamic = 'force-dynamic';

/**
 * GET or POST /api/cron/moratoriums
 * Déclenchement automatique / périodique de l'expiration des moratoires de 48h dépassés
 * Sécurisé par token CRON_SECRET dans le header Authorization
 */
export async function GET(req: NextRequest) {
    return handleCron(req);
}

export async function POST(req: NextRequest) {
    return handleCron(req);
}

async function handleCron(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        const expectedSecret = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
        }

        const result = await paymentService.expireOverdueMoratoriums();
        console.log(`[Cron Moratoriums] Traité avec succès : ${result.expiredCount} réservations expirées.`);

        return NextResponse.json({
            success: true,
            message: `Traitement terminé. ${result.expiredCount} réservation(s) expirée(s).`,
            expiredCount: result.expiredCount,
            reservationIds: result.reservationIds,
        });
    } catch (err: unknown) {
        console.error('[Cron Moratoriums] Erreur:', err);
        return NextResponse.json({ error: 'Erreur exécution cron moratoires' }, { status: 500 });
    }
}
