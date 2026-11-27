import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { UUID_RE, orderRefusal, readJson } from '@/lib/orders/booking';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/products/[id]/regulation { regulated: boolean, reason } — vérification d'un produit par l'administration
 * (décision du client : case de la partenaire + vérification par l'administration). Droit partners.validate (ou
 * Superadmin), vérifié par la route puis par order_product_regulation_decide en base ; motif obligatoire ; journal. Un
 * produit réglementé (case de la partenaire OU décision de l'administration) n'est jamais commandé, payé ni livré en
 * ligne ; « non réglementé » ne décoche pas la case de la partenaire.
 */
// Contre-vérification du lot 12c (T2) : reviewedAt obligatoire (version affichée : date de la demande, sinon date de la fiche).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'partners.validate' });
    if (!auth.authorized) return auth.errorResponse!;
    try {
        const { id } = await params;
        if (!UUID_RE.test(id)) {
            return NextResponse.json({ success: false, error: 'Produit introuvable.', code: 'PRODUCT_NOT_FOUND' }, { status: 404 });
        }
        const body = await readJson(req);
        if (!body || typeof body.regulated !== 'boolean') {
            return NextResponse.json({ success: false, error: 'Indiquez si le produit est réglementé ou non.', code: 'INVALID_DECISION' }, { status: 400 });
        }
        // Contre-vérification du lot 12c (T2) : la page envoie la version du produit qu'elle affiche ; la base refuse une
        // décision sur une version modifiée depuis (REVIEW_CHANGED) et la page se recharge.
        if (typeof body.reviewedAt !== 'string' || Number.isNaN(Date.parse(body.reviewedAt))) {
            return NextResponse.json({ success: false, error: 'Rechargez la page avant de décider.', code: 'REVIEW_VERSION_REQUIRED' }, { status: 400 });
        }
        const { data, error } = await getServiceRoleClient().rpc('order_product_regulation_decide', {
            p: {
                actor_id: auth.user!.id, product_id: id, regulated: body.regulated, reason: typeof body.reason === 'string' ? body.reason : '',
                reviewed_at: body.reviewedAt,
            },
        });
        if (error) throw new Error(`order_product_regulation_decide : ${error.message}`);
        const r = data as Record<string, unknown>;
        if (r?.code === 'REVIEW_CHANGED') {
            return NextResponse.json({ success: false, error: String(r.message ?? 'Ce produit a changé pendant votre lecture : relisez-le.'), code: 'REVIEW_CHANGED' }, { status: 409 });
        }
        if (r?.ok !== true) return orderRefusal(r, 'Vérification non enregistrée.');
        return NextResponse.json({
            success: true,
            message: r.regulated ? 'Produit réglementé : il reste affiché avec son prix, mais ne se commande plus en ligne.' : 'Produit vérifié : il peut être commandé en ligne.',
            product: { id, regulated: r.regulated === true },
        });
    } catch (err: unknown) {
        return apiFailure('POST /api/admin/products/[id]/regulation', err, { message: 'Vérification non enregistrée. Réessayez.', code: 'PRODUCT_REGULATION_FAILED' });
    }
}
