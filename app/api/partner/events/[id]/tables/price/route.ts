import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { pricePerPerson } from '@/lib/event-tables/report.server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/events/[id]/tables/price?price=150000&seats=6 — lot 11c-c : « soit … F par personne » pendant la
 * saisie d'un type de table pas encore enregistré, calculé par le serveur avec la règle de la base
 * (private.event_table_prices). Organisatrice connectée ; rien n'est lu ni écrit en base. Saisie hors des bornes
 * (prix entier de 1 F à 100 000 000 F, 2 à 20 places) : 400.
 */
export async function GET(request: NextRequest) {
    const session = await requireActiveSession(request);
    if (session.response) return session.response;
    if (!serverIsPartner(session.user)) {
        return NextResponse.json({ success: false, error: 'Accès réservé aux organisateurs.', code: 'FORBIDDEN' }, { status: 403 });
    }
    const q = request.nextUrl.searchParams;
    const preview = pricePerPerson(q.get('price'), q.get('seats'));
    if (!preview) {
        return NextResponse.json({ success: false, error: 'Indiquez un prix entier et 2 à 20 places.', code: 'INVALID_INPUT' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json({ success: true, ...preview }, { headers: { 'Cache-Control': 'no-store' } });
}
