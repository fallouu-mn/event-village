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

/** Règle à rendre : celle de la réservation, sans le plafond. */
export type QuotaReleaseRule = Pick<QuotaRule, 'scope' | 'bucket' | 'windowSecs'>;

export type QuotaReleaseResult =
    | { ok: true; released: number; notReleased: number }
    | { ok: false; message: string };

/**
 * Lot 9 bis, tâche 43 (R98 ; contrat 5.43, B90) — rend une unité réservée quand l'action comptée n'a pas eu lieu
 * (SMS d'invitation non parti), par public.quota_release (fenêtre courante seulement). Une unité non rendue (fenêtre
 * changée entre-temps) et un échec d'appel sont journalisés et rendus explicitement : l'appelant décide, rien n'est
 * masqué ; l'action déjà faite n'est jamais annulée pour autant.
 */
export async function releaseQuota(rules: QuotaReleaseRule[], label: string): Promise<QuotaReleaseResult> {
    if (rules.length === 0) return { ok: true, released: 0, notReleased: 0 };
    try {
        const { data, error } = await getServiceRoleClient().rpc('quota_release', {
            p_rules: rules.map((r) => ({ scope: r.scope, bucket: r.bucket, window_secs: r.windowSecs })),
        });
        if (error) throw new Error(`${error.code ?? ''} ${error.message}`.trim());
        const res = data as { released?: unknown; not_released?: unknown } | null;
        const released = Number(res?.released);
        const notReleased = Number(res?.not_released);
        if (!Number.isInteger(released) || !Number.isInteger(notReleased)) throw new Error(`réponse inattendue : ${JSON.stringify(data)}`);
        if (notReleased > 0) {
            console.warn(`[QUOTA] ${label} : ${notReleased} unité(s) non rendue(s) (fenêtre changée depuis la réservation ou compteur à zéro)`);
        }
        return { ok: true, released, notReleased };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[QUOTA] ${label} : rendu de quota impossible : ${message}`);
        return { ok: false, message };
    }
}
