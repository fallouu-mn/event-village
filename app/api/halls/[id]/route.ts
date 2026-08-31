import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/halls/[id]
 * Récupère le détail complet d'une salle pour devis et réservation
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const hallId = params.id;
        if (!hallId) {
            return NextResponse.json({ error: 'ID salle requis.' }, { status: 400 });
        }

        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(hallId);
        if (!isUuid) {
            return NextResponse.json({ error: 'Salle introuvable.' }, { status: 404 });
        }

        const supabase = getServiceRoleClient();

        const { data: hall, error } = await supabase
            .from('halls')
            .select(`
                id,
                name,
                description,
                capacity,
                price_per_day,
                deposit_percentage,
                images,
                is_active,
                partner_id,
                partners(id, company_name, commercial_name)
            `)
            .eq('id', hallId)
            .maybeSingle();

        if (error || !hall) {
            return NextResponse.json({ error: 'Salle introuvable.' }, { status: 404 });
        }

        const price = Number(hall.price_per_day);
        const image = (hall.images && hall.images.length > 0)
            ? hall.images[0]
            : 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800&auto=format&fit=crop&q=80';

        const partnerData = Array.isArray(hall.partners) ? hall.partners[0] : hall.partners;

        return NextResponse.json({
            hall: {
                id: hall.id,
                name: hall.name,
                partnerId: hall.partner_id,
                partnerName: partnerData?.commercial_name || partnerData?.company_name || 'Espace Réception',
                location: 'Dakar & Environs, Sénégal',
                areaSqm: Math.max(150, Math.floor(hall.capacity * 1.5)),
                capacitySeated: Math.max(50, Math.floor(hall.capacity * 0.7)),
                capacityCocktail: hall.capacity,
                pricePerDay: price,
                priceFormatted: `${price.toLocaleString('fr-FR')} FCFA`,
                depositRate: (hall.deposit_percentage || 30) / 100,
                depositPercentage: hall.deposit_percentage || 30,
                imageUrl: image,
                description: hall.description || 'Cadre d’exception pour vos réceptions, conférences et événements privés.',
                amenities: [
                    'Climatisation centrale haut rendement',
                    'Vidéoprojecteur HD & Écran de projection',
                    'Régie sonore et microphones sans fil',
                    'Wifi haut débit pour les invités',
                    'Espace traiteur et office de réchauffage',
                    'Service de gardiennage et sécurité',
                    'Parking privatif surveillé',
                ],
            },
        });
    } catch (err: unknown) {
        console.error('[API /api/halls/[id]] Exception:', err);
        return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
    }
}
