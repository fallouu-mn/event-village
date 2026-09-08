import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser } from '@/lib/auth/session';
import { TicketTransferService } from '@/lib/tickets/ticket-transfer.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/tickets/transfers/[id]/cancel
 * Annulation d'un transfert PENDING par son émetteur (propriétaire initial).
 * Déverrouille le billet de manière atomique sans modifier ses secrets QR.
 */
export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> | { id: string } }
) {
    try {
        // 1. Authentification
        const user = await getServerSessionUser(req);
        if (!user) {
            return NextResponse.json({
                error: 'Authentification requise.',
            }, { status: 401 });
        }

        const resolvedParams = await Promise.resolve(context?.params);
        const transferId = resolvedParams?.id;

        if (!transferId) {
            return NextResponse.json({ error: 'Identifiant de transfert manquant.' }, { status: 400 });
        }

        // 2. Annulation atomique
        const result = await TicketTransferService.cancelTransfer(user.id, transferId);

        return NextResponse.json({
            success: true,
            message: result.message,
            transfer: result,
        });
    } catch (err: any) {
        console.error('[POST /api/tickets/transfers/[id]/cancel] Erreur:', err?.message || err);
        const status = err?.statusCode || 500;
        return NextResponse.json({
            error: err?.message || 'Erreur interne lors de l\'annulation du transfert.',
        }, { status });
    }
}
