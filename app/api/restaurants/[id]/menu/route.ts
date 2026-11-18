import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { guardFeature } from '@/lib/features/flags';

export const dynamic = 'force-dynamic';

/**
 * GET /api/restaurants/[id]/menu
 * Récupère les plats et menus réels du partenaire.
 * Lot 11a (équivalent côté tables du trou T1 de la contre-vérification de la 10a) : seule une partenaire VALIDE est
 * servie ; un identifiant inconnu répond 404. Avant, la route prenait la première partenaire venue (même en attente ou
 * suspendue) et servait ses produits. Contre-vérification de la 11a (T6) : identifiant exact seulement, plus de nom.
 */
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        // Lot 7 (7.3, D11, D56) : GET public, interrupteur d'abord (404 si le service est fermé)
        const closed = await guardFeature('orders', 'GET /api/restaurants/[id]/menu');
        if (closed) return closed;
        const requestedId = params.id;
        const supabase = getServiceRoleClient();

        // Contre-vérification de la 11a (T6) : identifiant exact seulement. Plus aucune recherche par nom (« contient »
        // limitée à une ligne : « rest-e » désignait la première partenaire venue dont le nom contient « e »).
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedId);

        let partner: { id: string; company_name: string; commercial_name?: string | null } | null = null;

        if (isUuid) {
            const { data, error: partnerError } = await supabase
                .from('partners')
                .select('id, company_name, commercial_name')
                .eq('id', requestedId)
                .eq('status', 'VALIDE')
                .maybeSingle();
            if (partnerError) {
                console.error('[API /api/restaurants/[id]/menu] partenaire illisible :', partnerError.message);
                return NextResponse.json({ error: 'Impossible de charger le menu.' }, { status: 500 });
            }
            partner = data;
        }

        // Lot 11a : jamais de partenaire de repli ; identifiant illisible ou inconnu : 404
        if (!partner) {
            return NextResponse.json({ error: 'Ce restaurant n’existe pas ou n’est plus proposé.', code: 'RESTAURANT_NOT_FOUND' }, { status: 404 });
        }

        const partnerId = partner.id;

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
