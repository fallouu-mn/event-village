import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser } from '@/lib/auth/session';
import { HallService } from '@/lib/halls/hall.service';

/**
 * GET /api/partner/halls/[id]
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const hall = await HallService.getHallById(id);
        return NextResponse.json({ success: true, hall });
    } catch (error: unknown) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Salle introuvable.' },
            { status: 404 }
        );
    }
}

/**
 * PUT /api/partner/halls/[id]
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
        const updated = await HallService.updateHall(id, user.id, body);

        return NextResponse.json({ success: true, hall: updated });
    } catch (error: unknown) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Échec modification.' },
            { status: 400 }
        );
    }
}

/**
 * DELETE /api/partner/halls/[id]
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
        const result = await HallService.deleteHall(id, user.id);

        return NextResponse.json(result);
    } catch (error: unknown) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Échec suppression.' },
            { status: 400 }
        );
    }
}
