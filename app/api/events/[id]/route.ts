import { NextRequest, NextResponse } from 'next/server';
import { buildPublicEventDetail } from '@/lib/events/event-detail.server';

export const dynamic = 'force-dynamic';

const NOT_FOUND = () => NextResponse.json({ error: 'Événement introuvable.' }, { status: 404 });

/**
 * GET /api/events/[id] — fiche publique (lot 5, contrat E), lue maintenant, sans cache : c'est elle que relit la
 * billetterie de la page à chaque signal du temps réel et à chaque ouverture ou fin de vente.
 *  - BROUILLON, EN_ATTENTE, VALIDE, TERMINE sans publication, inconnu, identifiant illisible : 404 pour tous ;
 *  - PUBLIE, SUSPENDU, ANNULE, TERMINE : 200 { event } — règles et champs dans lib/events/event-detail.server.ts
 *    (source unique, partagée avec la page préparée par le serveur) ; design 1b : `scanColor` par catégorie,
 *    `counterSale` (guichet sur place, un booléen), `refund` (ligne « Remboursement » seulement si une règle vraie
 *    s'applique), `startsAt` et `endsAt`.
 */
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        const event = await buildPublicEventDetail(params.id);
        if (!event) return NOT_FOUND();
        return NextResponse.json({ event }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err: unknown) {
        console.error('[API /api/events/[id]] lecture de la fiche impossible :', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Impossible de charger l’événement.' }, { status: 500 });
    }
}
