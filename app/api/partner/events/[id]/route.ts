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

        // Validation croisée jauge serveur (§35)
        if (body.ticket_categories?.length > 0 && body.capacity && body.capacity > 0) {
            const totalQuota = body.ticket_categories.reduce((sum: number, cat: any) => sum + Number(cat.total_quantity), 0);
            if (totalQuota > Number(body.capacity)) {
                return NextResponse.json(
                    { error: `La somme des quotas de billets (${totalQuota}) dépasse la capacité maximale (${body.capacity}).` },
                    { status: 400 }
                );
            }
        }

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
