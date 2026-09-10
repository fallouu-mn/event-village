import { NextRequest, NextResponse } from 'next/server';
import { EventCancellationService } from '@/lib/events/event-cancellation.service';
import { getServerSessionUser } from '@/lib/auth/session';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const user = await getServerSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
        }

        const summary = await EventCancellationService.getEventCancellationSummary(
            params.id,
            user.id,
            user.role || 'PARTENAIRE'
        );

        return NextResponse.json(summary);
    } catch (error: any) {
        console.error('[Partner Cancellation Summary] Error:', error);
        if (error.message?.includes('Non autorisé')) {
            return NextResponse.json({ error: error.message }, { status: 403 });
        }
        if (error.message?.includes('introuvable')) {
            return NextResponse.json({ error: error.message }, { status: 404 });
        }
        return NextResponse.json({ error: error.message || 'Erreur interne du serveur' }, { status: 500 });
    }
}
