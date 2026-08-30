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
        const type = body.type || 'table';

        if (type === 'zone') {
            const zone = await TableService.updateZone(id, user.id, body);
            return NextResponse.json({ success: true, zone });
        } else {
            const table = await TableService.updateTable(id, user.id, body);
            return NextResponse.json({ success: true, table });
        }
    } catch (error: unknown) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Erreur modification.' },
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
        if (!user || user.role !== 'PARTENAIRE') {
            return NextResponse.json({ error: 'Non autorise.' }, { status: 403 });
        }

        const { id } = await params;
        const url = new URL(request.url);
        const type = url.searchParams.get('type') || 'table';

        if (type === 'zone') {
            await TableService.deleteZone(id, user.id);
        } else {
            await TableService.deleteTable(id, user.id);
        }

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Erreur suppression.' },
            { status: 400 }
        );
    }
}
