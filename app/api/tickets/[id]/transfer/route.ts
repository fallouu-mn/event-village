import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser } from '@/lib/auth/session';
import { InitiateTransferSchema } from '@/lib/validations/transfer';
import { TicketTransferService } from '@/lib/tickets/ticket-transfer.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/tickets/[id]/transfer
 * Initie le transfert sécurisé d'un billet VALIDE vers un destinataire (téléphone ou email).
 * Verrouille le billet de façon atomique (transfer_locked = true) et génère le claim token sécurisé.
 */
export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> | { id: string } }
) {
    try {
        // 1. Authentification
        const user = await getServerSessionUser(req);
        if (!user) {
            return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
        }

        const resolvedParams = await Promise.resolve(context?.params);
        const ticketId = resolvedParams?.id;
        if (!ticketId) {
            return NextResponse.json({ error: 'Identifiant de billet requis.' }, { status: 400 });
        }

        // 2. Validation du payload
        let body: unknown;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
        }

        const parseResult = InitiateTransferSchema.safeParse(body);
        if (!parseResult.success) {
            return NextResponse.json({
                error: parseResult.error.errors[0]?.message || 'Données de transfert invalides.',
            }, { status: 400 });
        }

        // 3. Exécution du transfert atomique
        const transferResult = await TicketTransferService.initiateTransfer(
            user.id,
            ticketId,
            parseResult.data.recipient
        );

        // 4. Réponse assainie avec claim_url pour partage WhatsApp / Messagerie
        const sanitizedTransfer = {
            transfer_id: transferResult.transfer_id,
            ticket_id: transferResult.ticket_id,
            ticket_number: transferResult.ticket_number,
            recipient: transferResult.recipient,
            recipient_type: transferResult.recipient_type,
            expires_at: transferResult.expires_at,
            event_title: transferResult.event_title,
            claim_url: transferResult.claim_url,
        };

        return NextResponse.json({
            success: true,
            message: `Transfert initié avec succès vers ${transferResult.recipient}.`,
            transfer: sanitizedTransfer,
        });

    } catch (err: any) {
        console.error('[POST /api/tickets/[id]/transfer] Erreur:', err?.message || err);
        const status = err?.statusCode || 500;
        return NextResponse.json({
            error: err?.message || 'Erreur interne lors de l\'initiation du transfert.',
        }, { status });
    }
}
