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
 *
 * Contre-vérification du lot 12c :
 *  - T2 : chaque fiche porte sa version (date de la demande, sinon date de la fiche) ; la page la renvoie avec la décision
 *    et la base refuse une décision sur une version modifiée depuis ;
 *  - T1 : le surlignage des mots est calculé par le serveur (order_review_marks_many, même pliage que la base) : plages
 *    [début, fin) en caractères du texte d'origine, pour le nom, la description, la catégorie et chaque supplément ;
 *  - T3 : motif d'une mise « à vérifier » par l'administration (reason ADMIN), dernière revue groupée des produits
 *    (journal PRODUCT_REVIEW_BACKFILL) ; ?q= cherche un produit non archivé (nom) pour « Mettre à vérifier ».
 */
export async function GET(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'partners.validate' });
    if (!auth.authorized) return auth.errorResponse!;
    try {
        const supabase = getServiceRoleClient();
        const q = (req.nextUrl.searchParams.get('q') ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
        const like = q.replace(/[%_\\,()."*]/g, ' ').trim();
        const [queueRes, historyRes, keywordsRes, batchRes, searchRes] = await Promise.all([
            supabase.from('products')
                .select('id, name, description, price, images, is_regulated, regulated_kind, regulated_admin, review_state, review_words, review_requested_at, review_note, created_at, updated_at, venue_id, partner_id, category_id, venues:venue_id (name), partners:partner_id (company_name, commercial_name), product_categories:category_id (name)')
                .is('archived_at', null)
                .or('review_state.eq.A_VERIFIER,and(is_regulated.eq.true,regulated_admin.is.null)')
                .order('review_requested_at', { ascending: true, nullsFirst: false })
                .order('created_at', { ascending: true })
                .limit(200),
            supabase.from('audit_logs').select('id, user_id, object_id, new_value, metadata, created_at')
                .eq('action', 'PRODUCT_REGULATION_DECIDED').order('created_at', { ascending: false }).limit(50),
            supabase.from('platform_settings').select('value, updated_at').eq('key', 'orders.review_keywords').maybeSingle(),
            supabase.from('audit_logs').select('metadata, created_at').eq('action', 'PRODUCT_REVIEW_BACKFILL')
                .order('created_at', { ascending: false }).limit(1).maybeSingle(),
            like.length >= 2
                ? supabase.from('products')
                    .select('id, name, price, review_state, venues:venue_id (name), partners:partner_id (company_name, commercial_name)')
                    .is('archived_at', null).ilike('name', `%${like}%`).order('name').limit(20)
                : Promise.resolve({ data: [] as Row[], error: null }),
        ]);
        if (queueRes.error) throw new Error(`file des produits : ${queueRes.error.message}`);
        if (batchRes.error) throw new Error(`dernière revue : ${batchRes.error.message}`);
        if (searchRes.error) throw new Error(`recherche : ${searchRes.error.message}`);
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

        // Surlignage servi par le serveur : un seul appel pour toute la file (nom, description, catégorie, suppléments)
        const texts: string[] = [];
        const at = (s: string | null): number => { if (!s) return -1; texts.push(s); return texts.length - 1; };
        const slots = queue.map((p) => ({
            name: at(String(p.name)),
            description: at((p.description as string | null) ?? null),
            category: at(one<{ name?: string }>(p.product_categories)?.name ?? null),
            options: (options.get(String(p.id)) ?? []).map((o) => at(String(o.name))),
        }));
        let marks: unknown[] = [];
        if (texts.length > 0) {
            const { data: m, error: mErr } = await supabase.rpc('order_review_marks_many', { p_texts: texts });
            if (mErr) throw new Error(`surlignage : ${mErr.message}`);
            marks = Array.isArray(m) ? m : [];
        }
        const rangesOf = (i: number): Array<[number, number]> => {
            const v = i >= 0 ? marks[i] : null;
            return Array.isArray(v)
                ? v.filter((r): r is [number, number] => Array.isArray(r) && r.length === 2 && r.every((x) => Number.isInteger(x) && x >= 0))
                : [];
        };
        const batchMeta = (batchRes.data?.metadata ?? null) as Row | null;
        const people = (p: Row) => {
            const partner = one<{ company_name?: string; commercial_name?: string | null }>(p.partners);
            return partner?.commercial_name || partner?.company_name || null;
        };
        return NextResponse.json({
            success: true,
            canEditKeywords: (auth.user?.roles ?? []).includes('SUPERADMIN'),
            keywords: Array.isArray(words) ? words.filter((w): w is string => typeof w === 'string') : [],
            keywordsUpdatedAt: keywordsRes.data?.updated_at ?? null,
            lastBatch: batchRes.data
                ? { count: Number(batchMeta?.count ?? 0), origin: String(batchMeta?.origin ?? ''), at: String(batchRes.data.created_at) }
                : null,
            search: like.length >= 2
                ? ((searchRes.data ?? []) as Row[]).map((p) => ({
                    id: String(p.id), name: String(p.name), price: Number(p.price), underReview: p.review_state === 'A_VERIFIER',
                    venueName: one<{ name?: string }>(p.venues)?.name ?? null, partnerName: people(p),
                }))
                : null,
            queue: queue.map((p, n) => {
                const venue = one<{ name?: string }>(p.venues);
                const slot = slots[n];
                return {
                    id: String(p.id),
                    name: String(p.name),
                    description: (p.description as string | null) ?? null,
                    price: Number(p.price),
                    image: Array.isArray(p.images) && p.images.length > 0 ? String(p.images[0]) : null,
                    reason: p.review_state === 'A_VERIFIER' ? (typeof p.review_note === 'string' ? 'ADMIN' : 'MOTS') : 'CASE',
                    note: (p.review_note as string | null) ?? null,
                    version: String((p.review_requested_at as string | null) ?? p.updated_at),
                    categoryName: one<{ name?: string }>(p.product_categories)?.name ?? null,
                    marks: {
                        name: rangesOf(slot.name),
                        description: rangesOf(slot.description),
                        category: rangesOf(slot.category),
                    },
                    words: Array.isArray(p.review_words) ? (p.review_words as string[]) : [],
                    partnerBox: p.is_regulated === true,
                    regulatedKind: (p.regulated_kind as string | null) ?? null,
                    requestedAt: (p.review_requested_at as string | null) ?? (p.created_at as string),
                    venueName: venue?.name ?? null,
                    partnerName: people(p),
                    options: (options.get(String(p.id)) ?? []).map((o, k) => ({
                        name: String(o.name), price: Number(o.price_delta), active: o.is_active !== false, marks: rangesOf(slot.options[k]),
                    })),
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
