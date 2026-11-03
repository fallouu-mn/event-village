import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { TicketTransferService, type TransferRefusal } from '@/lib/tickets/ticket-transfer.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/tickets/transfers/[id]/cancel
 * Annulation d'un transfert PENDING par son émetteur : CANCELLED, billet déverrouillé et avis au
 * destinataire mis en file dans la même transaction (RPC ticket_transfer_cancel), secrets du billet
 * inchangés. Lot 6 : `recipient_notification` (QUEUED) remplace `recipient_notified`.
 */
export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> | { id: string } }
) {
    const activeSession = await requireActiveSession(req);
    if (activeSession.response) return activeSession.response;
    const user = activeSession.user;

    const resolvedParams = await Promise.resolve(context?.params);
    const transferId = resolvedParams?.id;
    if (!transferId) {
        return NextResponse.json({ error: 'Identifiant de transfert manquant.', code: 'TRANSFER_ID_REQUIRED' }, { status: 400 });
    }

    try {
        const result = await TicketTransferService.cancelTransfer(user.id, transferId);
        return NextResponse.json({ success: true, message: result.message, recipient_notification: result.recipient_notification, transfer: result });
    } catch (err: unknown) {
        const refusal = err as Partial<TransferRefusal>;
        if (typeof refusal?.statusCode === 'number') {
            return NextResponse.json({ error: refusal.message, code: refusal.code ?? 'CANCEL_REFUSED' }, { status: refusal.statusCode });
        }
        console.error(`[POST /api/tickets/transfers/${transferId}/cancel] erreur :`, err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Annulation momentanément impossible. Réessayez.', code: 'CANCEL_FAILED' }, { status: 500 });
    }
}
