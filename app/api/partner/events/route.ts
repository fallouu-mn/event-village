import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser } from '@/lib/auth/session';
import { EventService } from '@/lib/events/event.service';

/**
 * GET /api/partner/events
 * Liste paginée des événements du partenaire connecté
 */
export async function GET(request: NextRequest) {
    try {
        const user = await getServerSessionUser(request);
        if (!user || (user.role !== 'PARTENAIRE' && user.role !== 'SUPERADMIN' && user.role !== 'ADMIN')) {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') || 'TOUS';
        const search = searchParams.get('search') || '';

        const events = await EventService.getPartnerEvents(user.id, { status, search });
        return NextResponse.json({ success: true, events });
    } catch (error: unknown) {
        console.error('[API partner/events GET] Error:', error instanceof Error ? error.message : 'unknown');
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Erreur lors de la récupération des événements.' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/partner/events
 * Création d'un événement par le partenaire (Statut initial : BROUILLON)
 * Le partner_id est strictement dérivé du compte connecté (jamais envoyé par le frontend)
 */
export async function POST(request: NextRequest) {
    try {
        const user = await getServerSessionUser(request);
        if (!user || user.role !== 'PARTENAIRE') {
            return NextResponse.json({ error: 'Seul un partenaire validé peut créer un événement.' }, { status: 403 });
        }

        const body = await request.json();
        const event = await EventService.createEvent(user.id, body);

        return NextResponse.json({ success: true, event }, { status: 201 });
    } catch (error: unknown) {
        console.error('[API partner/events POST] Error:', error instanceof Error ? error.message : 'unknown');
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Erreur lors de la création de l\'événement.' },
            { status: 400 }
        );
    }
}
