import { NextRequest, NextResponse } from 'next/server';
import { EventCancellationService } from '@/lib/events/event-cancellation.service';
import { getServerSessionUser, serverHasAnyRole } from '@/lib/auth/session';

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const user = await getServerSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
        }

        if (!serverHasAnyRole(user, ['ADMIN', 'SUPERADMIN'])) {
            return NextResponse.json({ error: 'Accès réservé aux administrateurs.' }, { status: 403 });
        }

        const result = await EventCancellationService.retryRefund(
            params.id,
            user.id
        );

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('[Admin Refund Retry] Error:', error);
        if (error.message?.includes('introuvable')) {
            return NextResponse.json({ error: error.message }, { status: 404 });
        }
        return NextResponse.json({ error: error.message || 'Erreur interne du serveur' }, { status: 500 });
    }
}
