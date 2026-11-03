import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { TicketTransferService, type TransferRefusal } from '@/lib/tickets/ticket-transfer.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/tickets/transfers/[id]/claim — lot 6, contrat B3 et B4 : le destinataire connecté accepte un
 * transfert par son identifiant (RPC ticket_transfer_accept, tout ou rien) : identité vérifiée en base
 * (numéro du compte vérifié par code), identité du billet régénérée, avis à l'expéditeur et au
 * destinataire mis en file. Refus : 404 TRANSFER_NOT_FOUND (absent ou adressé à un autre compte, même
 * réponse), 403 PHONE_NOT_VERIFIED, 409 TRANSFER_NOT_PENDING, 410 TRANSFER_EXPIRED, 400 SELF_TRANSFER.
 */
export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> | { id: string } }
) {
    const activeSession = await requireActiveSession(req);
    if (activeSession.response) return activeSession.response;

    const resolvedParams = await Promise.resolve(context?.params);
    const transferId = resolvedParams?.id ?? '';
    try {
        const claim = await TicketTransferService.acceptTransfer(activeSession.user.id, transferId);
        return NextResponse.json({ success: true, message: 'Billet ajouté à vos billets.', claim });
    } catch (err: unknown) {
        const refusal = err as Partial<TransferRefusal>;
        if (typeof refusal?.statusCode === 'number') {
            return NextResponse.json({ error: refusal.message, code: refusal.code ?? 'CLAIM_REFUSED' }, { status: refusal.statusCode });
        }
        console.error(`[POST /api/tickets/transfers/${transferId}/claim] erreur :`, err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Acceptation du billet momentanément impossible. Réessayez.', code: 'CLAIM_FAILED' }, { status: 500 });
    }
}
