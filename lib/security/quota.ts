/**
 * Lot 1C.9 — réservation de quota en base (public.quota_reserve, service_role).
 *
 * Toutes les règles d'une réservation sont consommées ensemble ou pas du tout. Un échec d'appel
 * (base injoignable, droit retiré, réponse illisible) est un REFUS (fail-closed), signalé par
 * reason 'UNAVAILABLE' et journalisé.
 */
import { getServiceRoleClient } from '@/lib/supabase/server';

export interface QuotaRule {
    scope: string;
    bucket: string;
    windowSecs: number;
    max: number;
}

export type QuotaResult =
    | { allowed: true }
    | { allowed: false; reason: 'EXCEEDED'; scope: string; bucket: string; retryAfterSeconds: number }
    | { allowed: false; reason: 'UNAVAILABLE'; message: string };

export async function reserveQuota(rules: QuotaRule[], label: string): Promise<QuotaResult> {
    if (rules.length === 0) return { allowed: true };
    try {
        const { data, error } = await getServiceRoleClient().rpc('quota_reserve', {
            p_rules: rules.map((r) => ({ scope: r.scope, bucket: r.bucket, window_secs: r.windowSecs, max: r.max })),
        });
        if (error) throw new Error(`${error.code ?? ''} ${error.message}`.trim());
        const res = data as { allowed?: unknown; scope?: unknown; bucket?: unknown; retry_after_seconds?: unknown } | null;
        if (res?.allowed === true) return { allowed: true };
        if (res?.allowed === false && typeof res.scope === 'string') {
            return {
                allowed: false,
                reason: 'EXCEEDED',
                scope: res.scope,
                bucket: String(res.bucket ?? ''),
                retryAfterSeconds: Number(res.retry_after_seconds ?? 60),
            };
        }
        throw new Error(`réponse inattendue : ${JSON.stringify(data)}`);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[QUOTA] ${label} : garde de quota indisponible, refus (fail-closed) : ${message}`);
        return { allowed: false, reason: 'UNAVAILABLE', message };
    }
}
