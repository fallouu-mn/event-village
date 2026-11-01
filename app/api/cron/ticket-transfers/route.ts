import { NextRequest, NextResponse } from 'next/server';
import { refuseUnlessCron } from '@/lib/security/cron-auth';
import { TicketTransferService } from '@/lib/tickets/ticket-transfer.service';

export const dynamic = 'force-dynamic';

/**
 * GET or POST /api/cron/ticket-transfers
 * Expiration des transferts PENDING dont le délai de 48 h est dépassé (RPC ticket_transfers_expire :
 * EXPIRED et billet déverrouillé dans la même transaction). Idempotent. Protégé par CRON_SECRET
 * (refuseUnlessCron), sans repli sur une autre clé.
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
        const result = await TicketTransferService.expireOverdueTransfers();
        console.log(`[Cron Ticket Transfers] ${result.expiredCount} transfert(s) expiré(s).`);
        return NextResponse.json({
            success: true,
            message: `Traitement terminé. ${result.expiredCount} transfert(s) expiré(s).`,
            expiredCount: result.expiredCount,
            transferIds: result.transferIds,
        });
    } catch (err: unknown) {
        console.error('[Cron Ticket Transfers] erreur :', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Erreur lors de l’expiration des transferts.' }, { status: 500 });
    }
}
