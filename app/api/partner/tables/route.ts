import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { TableService } from '@/lib/tables/table.service';
import { guardFeature } from '@/lib/features/flags';

export async function GET(request: NextRequest) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        // Lot 7 (7.3, D56) : session d'abord, puis interrupteur (404 si le service est fermé)
        const closed = await guardFeature('tables', '/api/partner/tables');
        if (closed) return closed;
        const user = activeSession.user;
        if (!user || !serverIsPartner(user)) {
            return NextResponse.json({ error: 'Non autorise.' }, { status: 401 });
        }

        const url = new URL(request.url);
        const type = url.searchParams.get('type') || 'tables';

        if (type === 'zones') {
            const zones = await TableService.getPartnerZones(user.id);
            return NextResponse.json({ success: true, zones });
        } else {
            const tables = await TableService.getPartnerTables(user.id);
            return NextResponse.json({ success: true, tables });
        }
    } catch (error: unknown) {
        return apiFailure('GET /api/partner/tables', error, { message: 'Tables momentanément indisponibles.', code: 'TABLES_UNAVAILABLE', status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        // Lot 7 (7.3, D56) : session d'abord, puis interrupteur (404 si le service est fermé)
        const closed = await guardFeature('tables', '/api/partner/tables');
        if (closed) return closed;
        const user = activeSession.user;
        if (!user || !serverIsPartner(user)) {
            return NextResponse.json({ error: 'Seul un partenaire peut creer.' }, { status: 403 });
        }

        const body = await request.json();
        const type = body.type || 'table';

        if (type === 'zone') {
            const zone = await TableService.createZone(user.id, body);
            return NextResponse.json({ success: true, zone }, { status: 201 });
        } else {
            const table = await TableService.createTable(user.id, body);
            return NextResponse.json({ success: true, table }, { status: 201 });
        }
    } catch (error: unknown) {
        return apiFailure('POST /api/partner/tables', error, { message: 'Table ou zone non enregistrée. Réessayez.', code: 'TABLE_SAVE_FAILED', status: 400 });
    }
}
