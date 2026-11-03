import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { TicketTransferService, type TransferRefusal } from '@/lib/tickets/ticket-transfer.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tickets/transfers/incoming — lot 6, contrat B4 : billets qui attendent le compte connecté
 * (transferts PENDING non échus vers son numéro vérifié par code), expéditeur masqué « Prénom N. ».
 * Un numéro non vérifié ne montre aucun détail : phoneVerificationRequired seulement.
 */
export async function GET(req: NextRequest) {
    const activeSession = await requireActiveSession(req);
    if (activeSession.response) return activeSession.response;
    try {
        const result = await TicketTransferService.listIncoming(activeSession.user.id);
        return NextResponse.json(
            { items: result.items, phoneVerificationRequired: result.phoneVerificationRequired },
            { headers: { 'Cache-Control': 'no-store' } });
    } catch (err: unknown) {
        const refusal = err as Partial<TransferRefusal>;
        if (typeof refusal?.statusCode === 'number') {
            return NextResponse.json({ error: refusal.message, code: refusal.code ?? 'INCOMING_REFUSED' }, { status: refusal.statusCode });
        }
        console.error('[GET /api/tickets/transfers/incoming] erreur :', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Lecture des billets reçus momentanément impossible. Réessayez.', code: 'INCOMING_FAILED' }, { status: 500 });
    }
}
