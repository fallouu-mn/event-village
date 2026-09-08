import { NextRequest, NextResponse } from 'next/server';
import { TicketTransferService } from '@/lib/tickets/ticket-transfer.service';

export const dynamic = 'force-dynamic';

/**
 * GET or POST /api/cron/ticket-transfers
 * Déclenchement automatique / périodique de l'expiration des transferts PENDING de 48h dépassés.
 * Idempotent et sécurisé par token CRON_SECRET dans le header Authorization.
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

        const result = await TicketTransferService.expireOverdueTransfers();
        console.log(`[Cron Ticket Transfers] Traité avec succès : ${result.expiredCount} transfert(s) expiré(s).`);

        return NextResponse.json({
            success: true,
            message: `Traitement terminé. ${result.expiredCount} transfert(s) expiré(s).`,
            expiredCount: result.expiredCount,
            transferIds: result.transferIds,
        });
    } catch (err: unknown) {
        console.error('[Cron Ticket Transfers] Erreur:', err);
        return NextResponse.json({ error: 'Erreur lors de l\'exécution du cron d\'expiration des transferts.' }, { status: 500 });
    }
}
