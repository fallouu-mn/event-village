import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { InitiateTransferSchema } from '@/lib/validations/transfer';
import { TicketTransferService, type TransferRefusal } from '@/lib/tickets/ticket-transfer.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/tickets/[id]/transfer
 * Initie le transfert d'un billet VALIDE vers un destinataire (téléphone ou email) : transfert PENDING
 * et verrou du billet posés dans la même transaction (RPC ticket_transfer_initiate), puis lien de
 * réclamation envoyé au destinataire. `recipient_notified` dit si cet envoi a réussi (un échec ne
 * casse pas le transfert : le lien reste partageable).
 */
export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> | { id: string } }
) {
    const activeSession = await requireActiveSession(req);
    if (activeSession.response) return activeSession.response;
    const user = activeSession.user;

    const resolvedParams = await Promise.resolve(context?.params);
    const ticketId = resolvedParams?.id;
    if (!ticketId) {
        return NextResponse.json({ error: 'Identifiant de billet requis.', code: 'TICKET_ID_REQUIRED' }, { status: 400 });
    }

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Corps JSON invalide.', code: 'INVALID_BODY' }, { status: 400 });
    }
    const parseResult = InitiateTransferSchema.safeParse(body);
    if (!parseResult.success) {
        return NextResponse.json({
            error: parseResult.error.errors[0]?.message || 'Données de transfert invalides.',
            code: 'INVALID_BODY',
        }, { status: 400 });
    }

    try {
        const result = await TicketTransferService.initiateTransfer(user.id, ticketId, parseResult.data.recipient);
        const transfer = {
            transfer_id: result.transfer_id,
            ticket_id: result.ticket_id,
            ticket_number: result.ticket_number,
            recipient: result.recipient,
            recipient_type: result.recipient_type,
            expires_at: result.expires_at,
            event_title: result.event_title,
            claim_url: result.claim_url,
            recipient_notified: result.recipient_notified,
        };
        return NextResponse.json({
            success: true,
            message: result.recipient_notified
                ? `Transfert initié : le lien de réclamation a été envoyé à ${result.recipient}.`
                : `Transfert initié, mais le lien n’a pas pu être envoyé à ${result.recipient} : partagez-le vous-même.`,
            recipient_notified: result.recipient_notified,
            transfer,
        });
    } catch (err: unknown) {
        const refusal = err as Partial<TransferRefusal>;
        if (typeof refusal?.statusCode === 'number') {
            return NextResponse.json({ error: refusal.message, code: refusal.code ?? 'TRANSFER_REFUSED' }, { status: refusal.statusCode });
        }
        console.error(`[POST /api/tickets/${ticketId}/transfer] erreur :`, err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Transfert momentanément impossible. Réessayez.', code: 'TRANSFER_FAILED' }, { status: 500 });
    }
}
