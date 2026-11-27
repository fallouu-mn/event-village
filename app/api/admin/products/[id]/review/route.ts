import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { UUID_RE, invalidBody, orderRefusal, readJson } from '@/lib/orders/booking';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/products/[id]/review { reason } — contre-vérification du lot 12c (T3) : bouton « Mettre à vérifier » de
 * l'administration, sur n'importe quel produit non archivé (une marque qu'aucune liste ne reconnaît). Droit
 * partners.validate (ou Superadmin), vérifié par la route puis par order_product_review_request en base ; motif
 * obligatoire, envoyé à la partenaire ; journal. Le produit ne se commande plus en ligne jusqu'à la décision.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'partners.validate' });
    if (!auth.authorized) return auth.errorResponse!;
    try {
        const { id } = await params;
        if (!UUID_RE.test(id)) {
            return NextResponse.json({ success: false, error: 'Produit introuvable.', code: 'PRODUCT_NOT_FOUND' }, { status: 404 });
        }
        const body = await readJson(req);
        if (!body) return invalidBody();
        const { data, error } = await getServiceRoleClient().rpc('order_product_review_request', {
            p: { actor_id: auth.user!.id, product_id: id, reason: typeof body.reason === 'string' ? body.reason : '' },
        });
        if (error) throw new Error(`order_product_review_request : ${error.message}`);
        const r = (data ?? {}) as Record<string, unknown>;
        if (r.ok !== true) {
            return r.code === 'REASON_REQUIRED'
                ? NextResponse.json({ success: false, error: r.message, code: r.code }, { status: 400 })
                : r.code === 'ALREADY_IN_REVIEW'
                    ? NextResponse.json({ success: false, error: r.message, code: r.code }, { status: 409 })
                    : orderRefusal(r, 'Produit non mis à vérifier.');
        }
        return NextResponse.json({ success: true, message: 'Produit mis à vérifier : il ne se commande plus en ligne jusqu’à votre décision.', product: { id } });
    } catch (err: unknown) {
        return apiFailure('POST /api/admin/products/[id]/review', err, { message: 'Produit non mis à vérifier. Réessayez.', code: 'PRODUCT_REVIEW_REQUEST_FAILED' });
    }
}
