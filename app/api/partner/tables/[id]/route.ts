import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { TableService } from '@/lib/tables/table.service';
import { guardFeature } from '@/lib/features/flags';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        // Lot 7 (7.3, D56) : session d'abord, puis interrupteur (404 si le service est fermé)
        const closed = await guardFeature('tables', '/api/partner/tables/[id]');
        if (closed) return closed;
        const user = activeSession.user;
        if (!user || !serverIsPartner(user)) {
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
        return apiFailure('PATCH /api/partner/tables/[id]', error, { message: 'Table ou zone non enregistrée. Réessayez.', code: 'TABLE_SAVE_FAILED', status: 400 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        // Lot 7 (7.3, D56) : session d'abord, puis interrupteur (404 si le service est fermé)
        const closed = await guardFeature('tables', '/api/partner/tables/[id]');
        if (closed) return closed;
        const user = activeSession.user;
        if (!user || !serverIsPartner(user)) {
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
        return apiFailure('DELETE /api/partner/tables/[id]', error, { message: 'Table ou zone non supprimée. Réessayez.', code: 'TABLE_DELETE_FAILED', status: 400 });
    }
}
