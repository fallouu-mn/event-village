import { NextRequest, NextResponse } from 'next/server';
import { apiFailure, PublicError } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { TicketTransferService, type TransferRefusal } from '@/lib/tickets/ticket-transfer.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/tickets/transfers/[id]/decline — lot 9 bis (R46, B55, contrat 4.3) : le destinataire connecté refuse un
 * billet (RPC ticket_transfer_decline, tout ou rien). Transfert d'un particulier : DECLINED, billet rendu libre à
 * l'expéditeur, qui est prévenu ; invitation de l'organisateur : billet annulé et place rendue, liste « Refusée ».
 * Refus identiques à ceux de l'acceptation (claim) : 404 TRANSFER_NOT_FOUND pour un tiers comme pour l'expéditeur,
 * 403 PHONE_NOT_VERIFIED, 409 TRANSFER_NOT_PENDING, 400 SELF_TRANSFER ; transfert échu : 410 TRANSFER_EXPIRED.
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
        try {
            const result = await TicketTransferService.declineTransfer(activeSession.user.id, transferId);
            return NextResponse.json({
                success: true,
                message: result.kind === 'INVITATION' ? 'Invitation refusée.' : 'Billet refusé : il reste à son expéditeur.',
                decline: result,
            });
        } catch (err: unknown) {
            const refusal = err as Partial<TransferRefusal>;
            if (typeof refusal?.statusCode === 'number' && typeof refusal.message === 'string') {
                throw new PublicError(refusal.message, refusal.code ?? 'DECLINE_REFUSED', refusal.statusCode);
            }
            throw err;
        }
    } catch (err: unknown) {
        return apiFailure(`POST /api/tickets/transfers/${transferId}/decline`, err, {
            message: 'Refus du billet momentanément impossible. Réessayez.',
            code: 'DECLINE_FAILED',
        });
    }
}
