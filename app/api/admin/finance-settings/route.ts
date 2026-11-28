import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { observedCashoutFeeRates } from '@/lib/admin/finance-reconciliation';
import { apiFailure } from '@/lib/api/public-error';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { rpcWithRetry } from '@/lib/payments/rpc';
import { settingRefusal } from '@/lib/settings/catalog';
import { invalidatePublicEvent } from '@/lib/events/public-cache.server';

export const dynamic = 'force-dynamic';

/** Préfixes des réglages exposés par cette route (validation des valeurs : finance_setting_set). */
// Lot 9 quinquies (B1) : + support.* (contact du support)
const SETTING_KEYS_FILTER = 'key.like.finance.%,key.like.access.%,key.like.notif.%,key.like.features.%,key.like.support.%,key.like.halls.%,key.like.tables.%,key.like.orders.%,key.like.event_tables.%';
/**
 * Lot 12c : liste des mots qui mettent un produit « à vérifier » (une liste, pas un nombre) : lue et modifiée sur la page
 * « Produits à vérifier » (GET /api/admin/products/review, PUT /api/admin/products/keywords → order_review_keywords_set),
 * jamais ici (finance_setting_set ne la connaît pas : elle n'est pas recopiée, règle S1 de cv12a-3).
 */
const OWN_PAGE_KEYS = ['orders.review_keywords'];

/**
 * Lot 3 — réglages financiers (clés finance.*), lot 4 — réglages du contrôle d'accès (clés access.*),
 * lot 6 — réglages des notifications (clés notif.*, rappels et SMS), lot 7 — interrupteurs des services hors
 * billetterie (clés features.*) : historisés, jamais rétroactifs.
 * GET : valeurs courantes et 100 dernières modifications (ADMIN ou SUPERADMIN).
 * PUT : modification d'une clé, SUPERADMIN uniquement ; validation et historique en base
 *       (finance_setting_set) : la route ne fait aucun calcul et n'a aucune valeur par défaut.
 */
export async function GET(req: NextRequest) {
    // Lot 9 quater (B5 : AUD-37) : lecture des réglages avec la permission « Lire les réglages »
    const auth = await verifyAdminAuth(req, { requiredPermission: 'settings.read' });
    if (!auth.authorized) return auth.errorResponse!;
    const supabase = getServiceRoleClient();
    const [{ data: settings, error }, { data: history, error: histErr }, { data: defaults, error: defErr }, { data: tableDefaults, error: tdErr }] = await Promise.all([
        supabase.from('platform_settings').select('key, value, description, updated_by, updated_at').or(SETTING_KEYS_FILTER)
            .not('key', 'in', `(${OWN_PAGE_KEYS.join(',')})`).order('key'),
        supabase.from('platform_settings_history').select('key, old_value, new_value, changed_by, reason, changed_at')
            .or(SETTING_KEYS_FILTER).not('key', 'in', `(${OWN_PAGE_KEYS.join(',')})`).order('changed_at', { ascending: false }).limit(100),
        // Finition 3b (E-35) : valeur d'origine de chaque réglage (premier état de l'historique)
        supabase.rpc('platform_settings_defaults'),
        // Lot 11c-a : valeurs d'origine des réglages event_tables.* (platform_settings_defaults n'est pas recopié)
        supabase.rpc('event_tables_settings_defaults'),
    ]);
    if (error || histErr || defErr || tdErr) {
        console.error('[API /api/admin/finance-settings] lecture impossible :', error?.message ?? histErr?.message ?? defErr?.message ?? tdErr?.message);
        return NextResponse.json({ error: 'Réglages indisponibles.' }, { status: 500 });
    }
    // Finition 3b (E-35) : l'historique dit qui a changé quoi ; un changement sans compte (migration, automate) est « Automatique ».
    const authorIds = [...new Set((history ?? []).map((h) => h.changed_by).filter((id): id is string => typeof id === 'string'))];
    const names = new Map<string, string>();
    if (authorIds.length > 0) {
        const { data: authors, error: authErr } = await supabase.from('users').select('id, first_name, last_name').in('id', authorIds);
        if (authErr) {
            console.error('[API /api/admin/finance-settings] auteurs illisibles :', authErr.message);
            return NextResponse.json({ error: 'Réglages indisponibles.' }, { status: 500 });
        }
        for (const a of authors ?? []) names.set(String(a.id), `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || 'Compte sans nom');
    }
    // Lot 9 bis (H7, X5, B29) : frais SamirPay réels constatés sur 90 jours, pour l'avertissement de l'écran
    // quand le taux de retrait réglé leur est inférieur (null tant qu'aucun frais réel n'est connu).
    let observed: Awaited<ReturnType<typeof observedCashoutFeeRates>>;
    try {
        observed = await observedCashoutFeeRates();
    } catch (err) {
        return apiFailure('GET /api/admin/finance-settings', err, { message: 'Réglages indisponibles.', code: 'SETTINGS_UNAVAILABLE', status: 500 });
    }
    return NextResponse.json({
        settings: (settings ?? []).map((s) => ({ ...s, value: (s.value as { value?: unknown })?.value })),
        history: (history ?? []).map((h) => ({
            ...h,
            author: h.changed_by ? (names.get(String(h.changed_by)) ?? 'Compte supprimé') : 'Automatique',
        })),
        defaults: { ...((defaults ?? {}) as Record<string, unknown>), ...((tableDefaults ?? {}) as Record<string, unknown>) },
        observed_cashout_fee_rate: observed.rate,
        observed_cashout_fee_max: observed.max,
    });
}

// Contre-vérification de la 11a (T7) : réglages des salles (halls.*) et des tables (tables.*) acceptés, comme par la
// lecture et la page ; la validation reste celle de la base (finance_setting_set → fin_setting_valid). Lot 12a : réglages
// des commandes (orders.*) acceptés de même
const PutSchema = z.object({
    key: z.string().regex(/^(finance|access|notif|features|support|halls|tables|orders|event_tables)\.[A-Za-z0-9_.]+$/),
    value: z.union([z.number(), z.boolean(), z.string().max(254)]),
    reason: z.string().trim().min(3).max(300),
});

export async function PUT(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { requireSuperadmin: true });
    if (!auth.authorized) return auth.errorResponse!;
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Demande illisible. Rechargez la page, puis réessayez.' }, { status: 400 });
    }
    const parsed = PutSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Réglage invalide (clé finance.*, access.*, notif.*, features.*, support.*, halls.*, tables.* ou orders.*, valeur, motif d’au moins 3 caractères).', details: parsed.error.flatten() }, { status: 400 });
    }
    // Lot 11c-a : les deux réglages des tables d'un événement passent par event_tables_setting_set (mêmes règles ; la suite
    // d'audit cv12a-3 interdit une nouvelle recopie de finance_setting_set)
    const setter = parsed.data.key === 'features.event_tables_enabled' || parsed.data.key.startsWith('event_tables.') ? 'event_tables_setting_set' : 'finance_setting_set';
    const { data, error } = await rpcWithRetry<{ ok: boolean; code?: string; message?: string; key?: string; value?: unknown }>(setter, {
        p_key: parsed.data.key,
        p_value: { value: parsed.data.value },
        p_actor: auth.user!.id,
        p_reason: parsed.data.reason,
    });
    if (error || !data) {
        console.error('[API /api/admin/finance-settings] écriture impossible :', error?.message);
        return NextResponse.json({ error: 'Réglage non enregistré.' }, { status: 500 });
    }
    if (!data.ok) {
        const status = data.code === 'FORBIDDEN' ? 403 : 400;
        // Finition 3b (E-35) : refus en français, avec le nom du réglage et ses bornes, jamais la clé technique.
        const message = data.code === 'INVALID_VALUE' ? settingRefusal(parsed.data.key, parsed.data.value)
            : data.code === 'UNKNOWN_KEY' ? 'Ce réglage n’existe pas.'
            : data.message;
        return NextResponse.json({ error: message, code: data.code }, { status });
    }
    // Contre-vérification du lot 11c-b (O1) : ouvrir ou fermer le service des tables d'un événement change la bascule
    // « Billets | Tables » des fiches en cache (page et résumé, étiquette fiche-publique) : invalidées tout de suite
    if (parsed.data.key === 'features.event_tables_enabled') invalidatePublicEvent(null, 'service des tables ouvert ou fermé');
    return NextResponse.json({ ok: true, key: data.key, value: data.value });
}
