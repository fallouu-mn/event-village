import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/restaurants/[id]/menu
 * Récupère les plats et menus réels du partenaire
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const partnerIdOrSlug = params.id;
        const supabase = getServiceRoleClient();

        // 1. Recherche du partenaire
        let partnerId = partnerIdOrSlug;
        const { data: partner } = await supabase
            .from('partners')
            .select('id, company_name, commercial_name')
            .or(`id.eq.${partnerIdOrSlug}`)
            .maybeSingle();

        if (partner) {
            partnerId = partner.id;
        } else {
            // S'il s'agit d'un slug ou si ID non trouvé, récupérer le premier partenaire traiteur/restaurant
            const { data: fallbackPartner } = await supabase
                .from('partners')
                .select('id, company_name, commercial_name')
                .limit(1)
                .maybeSingle();

            if (fallbackPartner) {
                partnerId = fallbackPartner.id;
            }
        }

        // 2. Récupération des produits disponibles
        const { data: products, error } = await supabase
            .from('products')
            .select(`
                id,
                name,
                description,
                price,
                is_daily_special,
                status,
                images,
                partner_id,
                category_id,
                product_categories(id, name)
            `)
            .eq('partner_id', partnerId)
            .neq('status', 'INDISPONIBLE')
            .order('is_daily_special', { ascending: false });

        if (error) {
            console.error('[API /api/restaurants/[id]/menu] Erreur Supabase:', error);
            return NextResponse.json({ error: 'Impossible de charger le menu.' }, { status: 500 });
        }

        const formatted = (products || []).map((p: any) => {
            const price = Number(p.price);
            const image = (p.images && p.images.length > 0)
                ? p.images[0]
                : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80';

            return {
                id: p.id,
                name: p.name,
                category: p.product_categories?.name || 'PLATS',
                description: p.description || '',
                price,
                priceFormatted: `${price.toLocaleString('fr-FR')} FCFA`,
                imageUrl: image,
                isDailySpecial: Boolean(p.is_daily_special),
            };
        });

        return NextResponse.json({
            partnerId,
            partnerName: partner?.commercial_name || partner?.company_name || 'Restaurant & Traiteur',
            menuItems: formatted,
        });
    } catch (err: unknown) {
        console.error('[API /api/restaurants/[id]/menu] Exception:', err);
        return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
    }
}
