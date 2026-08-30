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
        const status = url.searchParams.get('status') || undefined;
        const date = url.searchParams.get('date') || undefined;

        const reservations = await TableService.getPartnerReservations(user.id, { status, date });
        return NextResponse.json({ success: true, reservations });
    } catch (error: unknown) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Erreur recuperation reservations.' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const user = await getServerSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Non autorise.' }, { status: 401 });
        }

        const body = await request.json();
        body.clientId = user.id;

        const reservation = await TableService.createReservation(body);
        return NextResponse.json({ success: true, reservation }, { status: 201 });
    } catch (error: unknown) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Erreur creation reservation.' },
            { status: 400 }
        );
    }
}
