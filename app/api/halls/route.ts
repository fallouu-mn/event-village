import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/halls
 * Récupère le catalogue public des salles de fête actives
 */
export async function GET(req: NextRequest) {
    try {
        const supabase = getServiceRoleClient();
        const { searchParams } = new URL(req.url);
        const search = searchParams.get('q')?.trim().toLowerCase();
        const locationFilter = searchParams.get('location');

        const { data: halls, error } = await supabase
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
            .eq('is_active', true)
            .order('name', { ascending: true });

        if (error) {
            console.error('[API /api/halls] Erreur Supabase:', error);
            return NextResponse.json({ error: 'Impossible de charger les salles.' }, { status: 500 });
        }

        const formatted = (halls || []).map((h: any) => {
            const price = Number(h.price_per_day);
            const image = (h.images && h.images.length > 0)
                ? h.images[0]
                : 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800&auto=format&fit=crop&q=80';

            return {
                id: h.id,
                name: h.name,
                partnerName: h.partners?.commercial_name || h.partners?.company_name || 'Espace Réception',
                location: 'Dakar & Environs, Sénégal',
                capacityMin: Math.max(50, Math.floor(h.capacity * 0.3)),
                capacityMax: h.capacity,
                areaSqm: Math.max(150, Math.floor(h.capacity * 1.5)),
                pricePerDay: price,
                priceFormatted: `${price.toLocaleString('fr-FR')} FCFA / jour`,
                depositPercentage: h.deposit_percentage || 30,
                imageUrl: image,
                amenities: ['Climatisation', 'Sonorisation & Régie', 'Éclairage d’ambiance', 'Parking sécurisé'],
                isAvailable: true,
                description: h.description || 'Magnifique salle de réception modulable pour tous vos événements.',
            };
        });

        let results = formatted;
        if (search) {
            results = results.filter(h =>
                h.name.toLowerCase().includes(search) ||
                h.partnerName.toLowerCase().includes(search) ||
                h.location.toLowerCase().includes(search)
            );
        }

        return NextResponse.json({ halls: results });
    } catch (err: unknown) {
        console.error('[API /api/halls] Exception:', err);
        return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
    }
}
