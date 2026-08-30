import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser } from '@/lib/auth/session';
import { EventService, EventStatus } from '@/lib/events/event.service';

/**
 * POST /api/partner/events/[id]/status
 * Transition de statut avec validation des permissions RBAC
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
        const { status, reason } = body as { status: EventStatus; reason?: string };

        if (!status) {
            return NextResponse.json({ error: 'Le nouveau statut est obligatoire.' }, { status: 400 });
        }

        const updatedEvent = await EventService.changeEventStatus(
            id,
            user.id,
            status,
            user.role,
            reason
        );

        return NextResponse.json({ success: true, event: updatedEvent });
    } catch (error: unknown) {
        console.error('[API partner/events/[id]/status POST] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Erreur lors du changement de statut.' },
            { status: 400 }
        );
    }
}
