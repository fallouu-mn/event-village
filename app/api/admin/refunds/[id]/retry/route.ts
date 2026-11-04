import { NextRequest, NextResponse } from 'next/server';
import { EventCancellationService } from '@/lib/events/event-cancellation.service';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';

/**
 * POST /api/admin/refunds/[id]/retry — relance d'un remboursement en échec.
 * Lot 7 (7.0 c, contrat 3.7) : permission dédiée refunds.manage (le SUPERADMIN a toutes les permissions) ;
 * compte ACTIF exigé par verifyAdminAuth (D18).
 */
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const auth = await verifyAdminAuth(request, { requiredPermission: 'refunds.manage' });
    if (!auth.authorized || !auth.user) {
        return auth.errorResponse ?? NextResponse.json({ error: 'Accès réservé aux administrateurs.' }, { status: 403 });
    }

    try {
        const result = await EventCancellationService.retryRefund(params.id, auth.user.id);
        return NextResponse.json(result);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[Admin Refund Retry] Error:', message);
        if (message.includes('introuvable')) {
            return NextResponse.json({ error: 'Remboursement introuvable.' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Relance du remboursement momentanément impossible.' }, { status: 500 });
    }
}
