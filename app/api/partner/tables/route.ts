import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser } from '@/lib/auth/session';
import { TableService } from '@/lib/tables/table.service';

export async function GET(request: NextRequest) {
    try {
        const user = await getServerSessionUser(request);
        if (!user || (user.role !== 'PARTENAIRE' && user.role !== 'SUPERADMIN' && user.role !== 'ADMIN')) {
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
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Erreur recuperation.' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const user = await getServerSessionUser(request);
        if (!user || user.role !== 'PARTENAIRE') {
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
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Erreur creation.' },
            { status: 400 }
        );
    }
}
