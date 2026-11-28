import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { guardFeature } from '@/lib/features/flags';
import { UUID_RE, invalidBody, orderRefusal, readJson } from '@/lib/orders/booking';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/partner/products/[id]/details { allergens: string[], spiceLevel: 0 | 1 | 2 | 3 | null } — lot 12d : allergènes
 * (liste fermée des 14 allergènes courants) et niveau de piment d'un produit de la partenaire (order_product_details_set ;
 * produit archivé : refus). Affichés sur la fiche du plat côté client (order_venue_menu).
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await requireActiveSession(request);
        if (session.response) return session.response;
        const closed = await guardFeature('orders', 'PUT /api/partner/products/[id]/details');
        if (closed) return closed;
        if (!serverIsPartner(session.user)) return NextResponse.json({ error: 'Réservé aux partenaires.' }, { status: 403 });
        const { id } = await params;
        if (!UUID_RE.test(id)) {
            return NextResponse.json({ success: false, error: 'Ce produit n’existe pas ou n’est pas le vôtre.', code: 'PRODUCT_NOT_FOUND' }, { status: 404 });
        }
        const body = await readJson(request);
        if (!body) return invalidBody();
        const { data, error } = await getServiceRoleClient().rpc('order_product_details_set', {
            p: {
                actor_id: session.user.id, product_id: id,
                allergens: Array.isArray(body.allergens) ? body.allergens.slice(0, 20) : body.allergens ?? null,
                spice_level: body.spiceLevel === undefined ? null : body.spiceLevel,
            },
        });
        if (error) throw new Error(`order_product_details_set : ${error.message}`);
        const r = data as Record<string, unknown>;
        if (r?.ok !== true) return orderRefusal(r, 'Allergènes non enregistrés.');
        return NextResponse.json({ success: true, productId: r.product_id, allergens: r.allergens ?? [], spiceLevel: r.spice_level ?? null });
    } catch (error: unknown) {
        return apiFailure('PUT /api/partner/products/[id]/details', error, { message: 'Allergènes non enregistrés. Réessayez.', code: 'PRODUCT_DETAILS_FAILED', status: 500 });
    }
}
