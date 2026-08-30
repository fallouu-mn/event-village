import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser } from '@/lib/auth/session';
import { HallService } from '@/lib/halls/hall.service';

/**
 * POST /api/partner/halls/reservations/[id]/status
 * Confirmation ou annulation d'une réservation de salle
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getServerSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        const { action, reason } = body;

        let result;
        if (action === 'CONFIRM') {
            result = await HallService.confirmReservation(id, user.id);
        } else if (action === 'CANCEL') {
            result = await HallService.cancelReservation(id, user.id, reason);
        } else {
            return NextResponse.json({ error: 'Action non reconnue (CONFIRM ou CANCEL requis).' }, { status: 400 });
        }

        return NextResponse.json({ success: true, reservation: result });
    } catch (error: unknown) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Erreur traitement réservation.' },
            { status: 400 }
        );
    }
}
