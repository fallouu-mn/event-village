import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser } from '@/lib/auth/session';
import { EventService } from '@/lib/events/event.service';

/**
 * GET /api/partner/events/[id]
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getServerSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
        }

        const { id } = await params;
        const event = await EventService.getEventById(
            id,
            user.role === 'SUPERADMIN' || user.role === 'ADMIN' ? undefined : user.id
        );

        return NextResponse.json({ success: true, event });
    } catch (error: unknown) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Événement introuvable.' },
            { status: 404 }
        );
    }
}

/**
 * PUT /api/partner/events/[id]
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getServerSessionUser(request);
        if (!user || user.role !== 'PARTENAIRE') {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();
        const updated = await EventService.updateEvent(id, user.id, body);

        return NextResponse.json({ success: true, event: updated });
    } catch (error: unknown) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Échec de la modification.' },
            { status: 400 }
        );
    }
}

/**
 * DELETE /api/partner/events/[id]
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getServerSessionUser(request);
        if (!user || user.role !== 'PARTENAIRE') {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }

        const { id } = await params;
        const result = await EventService.deleteEvent(id, user.id);

        return NextResponse.json(result);
    } catch (error: unknown) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Échec de la suppression.' },
            { status: 400 }
        );
    }
}
