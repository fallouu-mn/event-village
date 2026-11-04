import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { rpcWithRetry } from '@/lib/payments/rpc';

export const dynamic = 'force-dynamic';

/** Préfixes des réglages exposés par cette route (validation des valeurs : finance_setting_set). */
const SETTING_KEYS_FILTER = 'key.like.finance.%,key.like.access.%,key.like.notif.%,key.like.features.%';

/**
 * Lot 3 — réglages financiers (clés finance.*), lot 4 — réglages du contrôle d'accès (clés access.*),
 * lot 6 — réglages des notifications (clés notif.*, rappels et SMS), lot 7 — interrupteurs des services hors
 * billetterie (clés features.*) : historisés, jamais rétroactifs.
 * GET : valeurs courantes et 100 dernières modifications (ADMIN ou SUPERADMIN).
 * PUT : modification d'une clé, SUPERADMIN uniquement ; validation et historique en base
 *       (finance_setting_set) : la route ne fait aucun calcul et n'a aucune valeur par défaut.
 */
export async function GET(req: NextRequest) {
    const auth = await verifyAdminAuth(req);
    if (!auth.authorized) return auth.errorResponse!;
    const supabase = getServiceRoleClient();
    const [{ data: settings, error }, { data: history, error: histErr }] = await Promise.all([
        supabase.from('platform_settings').select('key, value, description, updated_by, updated_at').or(SETTING_KEYS_FILTER).order('key'),
        supabase.from('platform_settings_history').select('key, old_value, new_value, changed_by, reason, changed_at')
            .or(SETTING_KEYS_FILTER).order('changed_at', { ascending: false }).limit(100),
    ]);
    if (error || histErr) {
        console.error('[API /api/admin/finance-settings] lecture impossible :', error?.message ?? histErr?.message);
        return NextResponse.json({ error: 'Réglages indisponibles.' }, { status: 500 });
    }
    return NextResponse.json({
        settings: (settings ?? []).map((s) => ({ ...s, value: (s.value as { value?: unknown })?.value })),
        history: history ?? [],
    });
}

const PutSchema = z.object({
    key: z.string().regex(/^(finance|access|notif|features)\.[A-Za-z0-9_.]+$/),
    value: z.union([z.number(), z.boolean(), z.string()]),
    reason: z.string().trim().min(3).max(300),
});

export async function PUT(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { requireSuperadmin: true });
    if (!auth.authorized) return auth.errorResponse!;
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 });
    }
    const parsed = PutSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Réglage invalide (clé finance.*, access.*, notif.* ou features.*, valeur, motif d’au moins 3 caractères).', details: parsed.error.flatten() }, { status: 400 });
    }
    const { data, error } = await rpcWithRetry<{ ok: boolean; code?: string; message?: string; key?: string; value?: unknown }>('finance_setting_set', {
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
        return NextResponse.json({ error: data.message, code: data.code }, { status });
    }
    return NextResponse.json({ ok: true, key: data.key, value: data.value });
}
