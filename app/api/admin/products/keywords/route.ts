import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { invalidBody, orderRefusal, readJson } from '@/lib/orders/booking';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/admin/products/keywords { keywords: string[], reason } — lot 12c : liste des mots qui mettent un produit « à
 * vérifier » (réglage orders.review_keywords), par order_review_keywords_set : super-administrateur actif (vérifié ici
 * puis en base), 1 à 100 mots distincts de 2 à 40 lettres, motif historisé (platform_settings_history). La liste vaut
 * pour les produits enregistrés à partir de maintenant ; les produits déjà en vente ne sont pas revus.
 */
export async function PUT(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { requireSuperadmin: true });
    if (!auth.authorized) return auth.errorResponse!;
    try {
        const body = await readJson(req);
        if (!body) return invalidBody();
        const keywords = Array.isArray(body.keywords)
            ? body.keywords.filter((w): w is string => typeof w === 'string').map((w) => w.trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 101)
            : null;
        if (!keywords) {
            return NextResponse.json({ success: false, error: 'Indiquez la liste des mots.', code: 'INVALID_VALUE' }, { status: 400 });
        }
        const { data, error } = await getServiceRoleClient().rpc('order_review_keywords_set', {
            p_value: { value: keywords }, p_actor: auth.user!.id, p_reason: typeof body.reason === 'string' ? body.reason : '',
        });
        if (error) throw new Error(`order_review_keywords_set : ${error.message}`);
        const r = (data ?? {}) as Record<string, unknown>;
        if (r.ok !== true) {
            return r.code === 'INVALID_VALUE' || r.code === 'REASON_REQUIRED'
                ? NextResponse.json({ success: false, error: r.message, code: r.code }, { status: 400 })
                : orderRefusal(r, 'Liste non enregistrée.');
        }
        return NextResponse.json({ success: true, keywords: r.value });
    } catch (err: unknown) {
        return apiFailure('PUT /api/admin/products/keywords', err, { message: 'Liste non enregistrée. Réessayez.', code: 'KEYWORDS_SAVE_FAILED' });
    }
}
