import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser } from '@/lib/auth/session';
import { TableService } from '@/lib/tables/table.service';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getServerSessionUser(request);
        if (!user || user.role !== 'PARTENAIRE') {
            return NextResponse.json({ error: 'Non autorise.' }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();

        const reservation = await TableService.updateReservationStatus(id, user.id, body.status);
        return NextResponse.json({ success: true, reservation });
    } catch (error: unknown) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Erreur modification reservation.' },
            { status: 400 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getServerSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Non autorise.' }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        await TableService.cancelReservation(id, user.id, body.reason || 'Annule par le partenaire');

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Erreur annulation.' },
            { status: 400 }
        );
    }
}
