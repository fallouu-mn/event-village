import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Row = Record<string, unknown>;

/**
 * GET /api/admin/products/review — lot 12c : page « Produits à vérifier » de l'administration (droit partners.validate,
 * ou super-administrateur) :
 *  - file : produits « à vérifier » (un mot de orders.review_keywords dans le nom, la description ou un supplément) et
 *    produits que la partenaire a marqués « réglementé » sans décision de l'administration, non archivés ; photo, texte,
 *    suppléments, mots trouvés, établissement et partenaire ;
 *  - historique : les 50 dernières décisions (journal PRODUCT_REGULATION_DECIDED) ;
 *  - liste des mots, modifiable par un super-administrateur (PUT /api/admin/products/keywords).
 * La décision passe par POST /api/admin/products/[id]/regulation (order_product_regulation_decide, motif obligatoire).
 */
export async function GET(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'partners.validate' });
    if (!auth.authorized) return auth.errorResponse!;
    try {
        const supabase = getServiceRoleClient();
        const [queueRes, historyRes, keywordsRes] = await Promise.all([
            supabase.from('products')
                .select('id, name, description, price, images, is_regulated, regulated_kind, regulated_admin, review_state, review_words, review_requested_at, created_at, venue_id, partner_id, venues:venue_id (name), partners:partner_id (company_name, commercial_name)')
                .is('archived_at', null)
                .or('review_state.eq.A_VERIFIER,and(is_regulated.eq.true,regulated_admin.is.null)')
                .order('review_requested_at', { ascending: true, nullsFirst: false })
                .order('created_at', { ascending: true })
                .limit(200),
            supabase.from('audit_logs').select('id, user_id, object_id, new_value, metadata, created_at')
                .eq('action', 'PRODUCT_REGULATION_DECIDED').order('created_at', { ascending: false }).limit(50),
            supabase.from('platform_settings').select('value, updated_at').eq('key', 'orders.review_keywords').maybeSingle(),
        ]);
        if (queueRes.error) throw new Error(`file des produits : ${queueRes.error.message}`);
        if (historyRes.error) throw new Error(`historique des décisions : ${historyRes.error.message}`);
        if (keywordsRes.error) throw new Error(`liste des mots : ${keywordsRes.error.message}`);

        const queue = (queueRes.data ?? []) as Row[];
        const ids = queue.map((p) => String(p.id));
        const optionsRes = ids.length
            ? await supabase.from('product_options').select('product_id, name, price_delta, is_active, sort_order').in('product_id', ids).order('sort_order')
            : { data: [] as Row[], error: null };
        if (optionsRes.error) throw new Error(`suppléments : ${optionsRes.error.message}`);
        const options = new Map<string, Row[]>();
        for (const o of (optionsRes.data ?? []) as Row[]) options.set(String(o.product_id), [...(options.get(String(o.product_id)) ?? []), o]);

        const history = (historyRes.data ?? []) as Row[];
        const actorIds = [...new Set(history.map((h) => h.user_id).filter((x): x is string => typeof x === 'string'))];
        const productIds = [...new Set(history.map((h) => h.object_id).filter((x): x is string => typeof x === 'string'))];
        const [actorsRes, namesRes] = await Promise.all([
            actorIds.length ? supabase.from('users').select('id, first_name, last_name').in('id', actorIds) : Promise.resolve({ data: [] as Row[], error: null }),
            productIds.length ? supabase.from('products').select('id, name').in('id', productIds) : Promise.resolve({ data: [] as Row[], error: null }),
        ]);
        if (actorsRes.error) throw new Error(`auteurs : ${actorsRes.error.message}`);
        if (namesRes.error) throw new Error(`noms des produits : ${namesRes.error.message}`);
        const actors = new Map(((actorsRes.data ?? []) as Row[]).map((u) => [String(u.id), [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Administrateur']));
        const names = new Map(((namesRes.data ?? []) as Row[]).map((p) => [String(p.id), String(p.name)]));

        const one = <T,>(v: unknown): T | null => (Array.isArray(v) ? ((v[0] as T) ?? null) : ((v as T) ?? null));
        const words = (keywordsRes.data?.value as { value?: unknown } | undefined)?.value;
        return NextResponse.json({
            success: true,
            canEditKeywords: (auth.user?.roles ?? []).includes('SUPERADMIN'),
            keywords: Array.isArray(words) ? words.filter((w): w is string => typeof w === 'string') : [],
            keywordsUpdatedAt: keywordsRes.data?.updated_at ?? null,
            queue: queue.map((p) => {
                const venue = one<{ name?: string }>(p.venues);
                const partner = one<{ company_name?: string; commercial_name?: string | null }>(p.partners);
                return {
                    id: String(p.id),
                    name: String(p.name),
                    description: (p.description as string | null) ?? null,
                    price: Number(p.price),
                    image: Array.isArray(p.images) && p.images.length > 0 ? String(p.images[0]) : null,
                    reason: p.review_state === 'A_VERIFIER' ? 'MOTS' : 'CASE',
                    words: Array.isArray(p.review_words) ? (p.review_words as string[]) : [],
                    partnerBox: p.is_regulated === true,
                    regulatedKind: (p.regulated_kind as string | null) ?? null,
                    requestedAt: (p.review_requested_at as string | null) ?? (p.created_at as string),
                    venueName: venue?.name ?? null,
                    partnerName: partner?.commercial_name || partner?.company_name || null,
                    options: (options.get(String(p.id)) ?? []).map((o) => ({ name: String(o.name), price: Number(o.price_delta), active: o.is_active !== false })),
                };
            }),
            history: history.map((h) => {
                const meta = (h.metadata ?? {}) as Row;
                const value = (h.new_value ?? {}) as Row;
                return {
                    id: String(h.id),
                    productId: (h.object_id as string | null) ?? null,
                    productName: (meta.product_name as string | undefined) ?? names.get(String(h.object_id)) ?? 'Produit retiré',
                    decision: value.regulated_admin === true ? 'REFUSE' : 'AUTORISE',
                    reason: (meta.reason as string | undefined) ?? null,
                    words: Array.isArray(meta.review_words) ? (meta.review_words as string[]) : [],
                    by: actors.get(String(h.user_id)) ?? 'Administrateur',
                    at: String(h.created_at),
                };
            }),
        }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err: unknown) {
        return apiFailure('GET /api/admin/products/review', err, { message: 'Produits à vérifier momentanément indisponibles.', code: 'PRODUCT_REVIEW_UNAVAILABLE' });
    }
}
